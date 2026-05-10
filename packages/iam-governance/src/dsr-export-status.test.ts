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

  it('falls back to JSON status responses for unknown formats and missing requesters', async () => {
    const missingRequesterQuery = vi.fn<QueryClient['query']>().mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const handlers = createDsrExportStatusHandlers(createDeps());

    const missingRequesterResponse = await handlers.getSelfExportStatus({
      client: { query: missingRequesterQuery },
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-missing',
      jobId: 'job-1',
    });

    expect(missingRequesterResponse.status).toBe(404);
    await expect(readBody(missingRequesterResponse)).resolves.toEqual({ error: 'account_not_found' });

    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'account-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [completedJob] });

    const invalidFormatResponse = await handlers.getSelfExportStatus({
      client: { query },
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      jobId: 'job-1',
      downloadFormat: 'yaml',
    });

    expect(invalidFormatResponse.status).toBe(200);
    await expect(readBody(invalidFormatResponse)).resolves.toMatchObject({
      id: 'job-1',
      status: 'completed',
    });
  });

  it('downloads json and xml exports and fails closed when the row is unexpectedly empty', async () => {
    const handlers = createDsrExportStatusHandlers(createDeps());
    const jsonQuery = vi.fn<QueryClient['query']>().mockResolvedValueOnce({ rowCount: 1, rows: [completedJob] });
    const xmlQuery = vi.fn<QueryClient['query']>().mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ ...completedJob, format: 'xml', payload_xml: '<root />' }],
    });
    const emptyRowQuery = vi.fn<QueryClient['query']>().mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const jsonResponse = await handlers.getAdminExportStatus({
      client: { query: jsonQuery },
      instanceId: 'de-musterhausen',
      jobId: 'job-1',
      downloadFormat: 'json',
    });
    expect(jsonResponse.headers.get('Content-Type')).toBe('application/json');
    await expect(jsonResponse.text()).resolves.toContain('"ok": true');

    const xmlResponse = await handlers.getAdminExportStatus({
      client: { query: xmlQuery },
      instanceId: 'de-musterhausen',
      jobId: 'job-1',
      downloadFormat: 'xml',
    });
    expect(xmlResponse.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    await expect(xmlResponse.text()).resolves.toContain('<root />');

    const emptyRowResponse = await handlers.getAdminExportStatus({
      client: { query: emptyRowQuery },
      instanceId: 'de-musterhausen',
      jobId: 'job-empty',
    });
    expect(emptyRowResponse.status).toBe(404);
    await expect(readBody(emptyRowResponse)).resolves.toEqual({ error: 'export_job_not_found' });
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
