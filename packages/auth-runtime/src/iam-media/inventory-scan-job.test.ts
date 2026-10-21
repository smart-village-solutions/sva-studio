import { withStudioJobRepository } from '../plugin-operations/repository.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaScanLimits } from '@sva/media';
import { MediaScanError, scanConfiguredMedia } from './clamav.js';
import {
  createMediaInventoryScanHandler,
  getMediaInventoryScan,
  scheduleMediaInventoryScan,
} from './inventory-scan-job.js';

vi.mock('../plugin-operations/repository.js', () => ({ withStudioJobRepository: vi.fn() }));
vi.mock('./clamav.js', async (actual) => ({
  ...(await actual<typeof import('./clamav.js')>()),
  scanConfiguredMedia: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(scanConfiguredMedia).mockReset().mockResolvedValue(undefined);
});
const setup = (inputPayload: Record<string, unknown> = { limit: 25 }) => {
  const storage = {
    listObjects: vi.fn(async () => ({
      items: [1, 2, 3].map((n) => ({
        storageKey: `tenant-a/${n}.txt`,
        byteSize: 3,
        lastModified: null,
      })),
      nextCursor: 'next-page',
    })),
    statObject: vi.fn(async () => ({ byteSize: 3 })),
    readObject: vi.fn(async () => ({
      body: Uint8Array.from([1, 2, 3]),
      byteSize: 3,
      etag: 'observed',
    })),
    writeObject: vi.fn(),
    deleteObject: vi.fn(),
  };
  const emitAuditEvent = vi.fn();
  const resolveStoragePort = vi.fn(async () => storage);
  const handler = createMediaInventoryScanHandler({ resolveStoragePort, emitAuditEvent });
  const run = () =>
    handler({
      job: { id: 'job-1', instanceId: 'tenant-a', inputPayload },
      progressReporter: { reportProgress: vi.fn() },
    } as never);
  return { storage, run, emitAuditEvent, resolveStoragePort };
};
describe('manual read-only inventory scan', () => {
  it.each([
    null,
    { source: 'plugin', jobTypeId: 'media.scan-existing' },
    { source: 'host', jobTypeId: 'media.process-upload' },
  ])('does not expose unrelated jobs as reports: %j', async (job) => {
    const getJobById = vi.fn(async () => job);
    vi.mocked(withStudioJobRepository).mockImplementation(async (instanceId, work) => {
      expect(instanceId).toBe('tenant-a');
      return work({ getJobById } as never);
    });
    expect(await getMediaInventoryScan('tenant-a', 'job-1')).toBeNull();
    expect(getJobById).toHaveBeenCalledWith('tenant-a', 'job-1');
  });
  it('reads only the stored report from the matching host job', async () => {
    const report = { entries: [], nextCursor: null, completedAt: 'now' };
    vi.mocked(withStudioJobRepository).mockImplementation(async (_, work) =>
      work({
        getJobById: async () => ({
          id: 'job-1',
          source: 'host',
          jobTypeId: 'media.scan-existing',
          status: 'succeeded',
          resultPayload: { plugin: { report } },
        }),
      } as never)
    );
    expect(await getMediaInventoryScan('tenant-a', 'job-1')).toEqual({
      id: 'job-1',
      status: 'succeeded',
      report,
    });
  });
  it('reports clean, infected and incomplete files without writing or deleting anything', async () => {
    const { storage, run, emitAuditEvent } = setup({ limit: 3, cursor: 'previous-page' });
    vi.mocked(scanConfiguredMedia)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new MediaScanError('media_scan_infected'))
      .mockRejectedValueOnce(new MediaScanError('media_scan_incomplete'));
    const result = await run();
    expect(result).toMatchObject({
      resultPayload: {
        plugin: {
          report: {
            nextCursor: 'next-page',
            entries: [
              { verdict: 'clean', etag: 'observed' },
              { verdict: 'infected' },
              { verdict: 'unscannable', reason: 'scan_incomplete' },
            ],
          },
        },
      },
    });
    expect(storage.listObjects).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      limit: 3,
      cursor: 'previous-page',
    });
    expect(storage.readObject).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/1.txt',
      maxBytes: mediaScanLimits.maxBytes,
    });
    expect(storage.writeObject).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(JSON.stringify(emitAuditEvent.mock.calls)).not.toContain('tenant-a/1.txt');
  });
  it.each(['media_scan_unavailable', 'media_scan_stale'] as const)(
    'does not repeat a systemic %s for remaining files',
    async (code) => {
      const { run, storage } = setup();
      vi.mocked(scanConfiguredMedia).mockRejectedValue(new MediaScanError(code));
      const result = await run();
      expect(scanConfiguredMedia).toHaveBeenCalledOnce();
      expect(storage.readObject).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        resultPayload: {
          plugin: {
            report: {
              entries: [
                { verdict: 'unscannable' },
                { verdict: 'unscannable' },
                { verdict: 'unscannable' },
              ],
            },
          },
        },
      });
    }
  );
  it('does not download large files and handles growth after the listing', async () => {
    const { storage, run } = setup();
    storage.listObjects.mockResolvedValue({
      items: [
        {
          storageKey: 'tenant-a/large',
          byteSize: mediaScanLimits.maxBytes + 1,
          lastModified: null,
        },
        { storageKey: 'tenant-a/grown', byteSize: 3, lastModified: null },
      ],
      nextCursor: null,
    } as never);
    storage.statObject.mockResolvedValue({ byteSize: mediaScanLimits.maxBytes + 1 });
    expect(await run()).toMatchObject({
      resultPayload: {
        plugin: { report: { entries: [{ reason: 'size_limit' }, { reason: 'size_limit' }] } },
      },
    });
    expect(storage.readObject).not.toHaveBeenCalled();
    expect(scanConfiguredMedia).not.toHaveBeenCalled();
  });
  it('rejects an unbounded job before resolving storage', async () => {
    const { run, resolveStoragePort } = setup({ limit: 26 });
    await expect(run()).rejects.toThrow('media_inventory_invalid');
    expect(resolveStoragePort).not.toHaveBeenCalled();
  });
  it('redacts read and listing failures', async () => {
    const { storage, run } = setup();
    storage.readObject.mockRejectedValue(new Error('signed-url-secret'));
    expect(JSON.stringify(await run())).not.toContain('signed-url-secret');
    storage.listObjects.mockRejectedValue(new Error('signed-url-secret'));
    await expect(run()).rejects.toThrow('media_inventory_scan_failed');
  });
  it('creates the job, queued event and enqueue inside the existing transaction callback', async () => {
    const jobs = { createJob: vi.fn(async (input) => input), appendJobEvent: vi.fn() };
    const enqueue = vi.fn();
    expect(
      await scheduleMediaInventoryScan(
        { instanceId: 'tenant-a', jobId: 'job-1', limit: 3 },
        async (instanceId, work) => {
          expect(instanceId).toBe('tenant-a');
          return work({ jobs, enqueue } as never);
        }
      )
    ).toEqual({ id: 'job-1', status: 'queued' });
    expect(jobs.createJob).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'host', maxAttempts: 1, jobTypeId: 'media.scan-existing' })
    );
    expect(jobs.appendJobEvent).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledOnce();
  });
});
