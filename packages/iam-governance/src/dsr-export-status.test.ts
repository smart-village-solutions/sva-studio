import { describe, expect, it, vi } from 'vitest';

import { createDsrExportStatusHandlers, type DsrExportStatusDeps } from './dsr-export-status.js';
import type { QueryClient } from './query-client.js';

const createDeps = (): DsrExportStatusDeps => ({
  jsonResponse: vi.fn((status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  textResponse: vi.fn((status, body, contentType) =>
    new Response(body, {
      status,
      headers: { 'Content-Type': contentType },
    })
  ),
  isExportFormat: (value): value is 'json' | 'csv' | 'xml' =>
    value === 'json' || value === 'csv' || value === 'xml',
});

const completedJob = {
  id: 'job-1',
  format: 'json' as const,
  status: 'completed',
  error_message: null,
  payload_json: { ok: true },
  payload_csv: 'field,value\nok,true',
  payload_xml: '<dataExport><ok>true</ok></dataExport>',
  created_at: '2026-01-01T00:00:00.000Z',
  completed_at: '2026-01-01T00:01:00.000Z',
};

const readBody = async (response: Response) => JSON.parse(await response.text());

describe('dsr-export-status', () => {
  it('returns self export job status for the requesting account', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'account-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [completedJob] });
    const handlers = createDsrExportStatusHandlers(createDeps());

    const response = await handlers.getSelfExportStatus({
      client: { query },
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      jobId: 'job-1',
    });
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: 'job-1', status: 'completed', completedAt: completedJob.completed_at });
    expect(query.mock.calls[1]?.[1]).toEqual(['de-musterhausen', 'job-1', 'account-1']);
  });

  it('downloads completed self export jobs in requested formats', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'account-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [completedJob] });
    const handlers = createDsrExportStatusHandlers(createDeps());

    const response = await handlers.getSelfExportStatus({
      client: { query },
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      jobId: 'job-1',
      downloadFormat: 'csv',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    await expect(response.text()).resolves.toContain('ok,true');
  });

  it('returns export_job_not_found for unknown admin jobs', async () => {
    const query = vi.fn<QueryClient['query']>().mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const handlers = createDsrExportStatusHandlers(createDeps());

    const response = await handlers.getAdminExportStatus({
      client: { query },
      instanceId: 'de-musterhausen',
      jobId: 'job-missing',
    });
    const body = await readBody(response);

    expect(response.status).toBe(404);
    expect(body.error).toBe('export_job_not_found');
  });
});
