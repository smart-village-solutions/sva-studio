import { afterEach, describe, expect, it, vi } from 'vitest';
import { MainserverApiError } from '@sva/plugin-sdk';
import {
  getJob,
  removeJob,
  saveJob,
  listJobs,
  listJobCategories,
  readJobPending,
  jobRequestHash,
  jobRejection,
} from '../src/jobs.api.js';
import { createJobDefaults } from '../src/contract.js';
afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
describe('Job HTTP client', () => {
  it('sends create/update with exact operation and context binding headers', async () => {
    const job = { ...createJobDefaults('2026-11-01'), title: 'Road' };
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: { id: '42', input: job } }), {
          headers: { 'Content-Type': 'application/json', 'X-SVA-Context-Binding': 'bound' },
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    await getJob('42', 'user');
    await saveJob('42', { job, baseFingerprint: 'a'.repeat(64) }, 'user', 'operation-1');
    await saveJob(undefined, { job }, 'user', 'operation-2');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/mainserver/jobs/42');
    const update = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(update.headers).get('X-SVA-Context-Binding')).toBe('bound');
    expect(new Headers(update.headers).get('X-SVA-Operation-Id')).toBe('operation-1');
    expect(update.method).toBe('PATCH');
    expect(JSON.parse(update.body as string)).toMatchObject({
      job,
      baseFingerprint: 'a'.repeat(64),
    });
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe('POST');
  });
  it('encodes filters and requests categories compatible with jobs', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: [] }), {
          headers: { 'Content-Type': 'application/json' },
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    await listJobs({ search: 'Straße & Brücke', page: 2 });
    await listJobCategories();
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('X-SVA-Acting-Principal-Type')
    ).toBe('user');
    expect(
      new URL(fetchMock.mock.calls[0]?.[0] as string, 'https://test.local').searchParams.get(
        'search'
      )
    ).toBe('Straße & Brücke');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('dataType=generic_item_job');
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('X-SVA-Acting-Principal-Type')
    ).toBe('user');
    await listJobs({ page: 1 }, 'organization');
    expect(
      new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('X-SVA-Acting-Principal-Type')
    ).toBe('organization');
    await listJobCategories('organization');
    expect(
      new Headers(fetchMock.mock.calls[3]?.[1]?.headers).get('X-SVA-Acting-Principal-Type')
    ).toBe('organization');
  });
  it('keeps invalid persisted markers inert and hashes the exact request body', async () => {
    for (const value of ['{', 'null', '1', '{}', '{"operationId":1,"inputHash":"x"}']) {
      sessionStorage.setItem('pending', value);
      expect(readJobPending('pending')).toBeUndefined();
    }
    sessionStorage.setItem(
      'pending',
      JSON.stringify({ operationId: 'op', inputHash: 'a'.repeat(64), id: '42' })
    );
    expect(readJobPending('pending')).toMatchObject({ id: '42' });
    expect(await jobRequestHash({ recover: true, inputHash: 'a'.repeat(64) })).toMatch(
      /^[a-f0-9]{64}$/
    );
    expect(jobRejection(new MainserverApiError('forbidden'))).toBe('forbidden');
    expect(jobRejection(new MainserverApiError('job_outcome_unknown'))).toBeUndefined();
    expect(jobRejection(new TypeError())).toBeUndefined();
  });
  it('obtains a fresh delete context after reload and sends the original operation without retries', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: '42' } }), {
          headers: { 'X-SVA-Context-Binding': 'fresh' },
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: '42', deleted: true } })));
    vi.stubGlobal('fetch', mock);
    const body = { recover: true as const, inputHash: 'a'.repeat(64) };
    await expect(removeJob('42', body, 'organization', 'delete-operation')).resolves.toMatchObject({
      deleted: true,
    });
    expect(mock.mock.calls[0]?.[0]).toBe('/api/v1/mainserver/jobs/42?context=delete');
    const request = mock.mock.calls[1]?.[1] as RequestInit;
    expect(request.method).toBe('DELETE');
    expect(JSON.parse(request.body as string)).toEqual(body);
    expect(new Headers(request.headers).get('X-SVA-Context-Binding')).toBe('fresh');
    expect(new Headers(request.headers).get('X-SVA-Operation-Id')).toBe('delete-operation');
    expect(new Headers(request.headers).get('X-SVA-Acting-Principal-Type')).toBe('organization');
  });
});
