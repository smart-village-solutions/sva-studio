import { describe, expect, it, vi } from 'vitest';

vi.mock('./dsr-export-payload.js', () => ({
  collectDsrExportPayload: vi.fn(async () => ({
    exportedAt: '2026-05-15T12:00:00.000Z',
    account: { id: 'account-1' },
  })),
  serializeDsrExportPayload: vi.fn((format: string) => `serialized-${format}`),
}));

import { createDsrExportFlows, type DsrExportFlowDeps } from './dsr-export-flows.js';
import { collectDsrExportPayload, serializeDsrExportPayload } from './dsr-export-payload.js';
import type { QueryClient } from './query-client.js';

const accountRow = {
  id: 'account-1',
  keycloak_subject: 'kc-user-1',
  email_ciphertext: null,
  display_name_ciphertext: null,
  is_blocked: false,
  soft_deleted_at: null,
  delete_after: null,
  permanently_deleted_at: null,
  processing_restricted_at: null,
  processing_restriction_reason: null,
  non_essential_processing_opt_out_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const readBody = async (response: Response) => JSON.parse(await response.text());

const createDeps = (): DsrExportFlowDeps => ({
  reserveIdempotency: vi.fn(async () => ({ status: 'reserved' })),
  completeIdempotency: vi.fn(async () => undefined),
  toPayloadHash: vi.fn(() => 'payload-hash'),
  createAsyncStudioJob: vi.fn(async () => ({ id: 'studio-job-1' })),
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
});

describe('dsr-export-flows', () => {
  it('queues async self exports and completes idempotency', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 1, rows: [accountRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'job-1', status: 'queued' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'request-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const deps = createDeps();
    const flows = createDsrExportFlows(deps);

    const response = await flows.runSelfExport({
      client: { query },
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      exportRequest: { format: 'json', async: true },
      idempotencyKey: 'idem-1',
    });
    const body = await readBody(response);

    expect(response.status).toBe(202);
    expect(body).toEqual({ exportJobId: 'job-1', status: 'queued', format: 'json' });
    expect(deps.createAsyncStudioJob).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        exportJobId: 'job-1',
        requestedByAccountId: 'account-1',
        targetAccountId: 'account-1',
        format: 'json',
      })
    );
    expect(deps.reserveIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: 'account-1',
        endpoint: 'POST:/iam/me/data-export',
        idempotencyKey: 'idem-1',
      })
    );
    expect(deps.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ responseStatus: 202, responseBody: body })
    );
  });

  it('replays completed text exports from idempotency without creating another request', async () => {
    const query = vi.fn<QueryClient['query']>().mockResolvedValueOnce({ rowCount: 1, rows: [accountRow] });
    const deps = createDeps();
    vi.mocked(deps.reserveIdempotency).mockResolvedValueOnce({
      status: 'replay',
      responseStatus: 200,
      responseBody: { kind: 'text', body: '{"ok":true}', contentType: 'application/json' },
    });
    const flows = createDsrExportFlows(deps);

    const response = await flows.runSelfExport({
      client: { query },
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      exportRequest: { format: 'json', async: false },
      idempotencyKey: 'idem-1',
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('{"ok":true}');
    expect(query).toHaveBeenCalledTimes(1);
    expect(deps.createAsyncStudioJob).not.toHaveBeenCalled();
    expect(deps.completeIdempotency).not.toHaveBeenCalled();
  });

  it('returns an idempotency conflict for self exports', async () => {
    const query = vi.fn<QueryClient['query']>().mockResolvedValueOnce({ rowCount: 1, rows: [accountRow] });
    const deps = createDeps();
    vi.mocked(deps.reserveIdempotency).mockResolvedValueOnce({
      status: 'conflict',
      message: 'Payload mismatch',
    });
    const flows = createDsrExportFlows(deps);

    const response = await flows.runSelfExport({
      client: { query },
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      exportRequest: { format: 'json', async: false },
      idempotencyKey: 'idem-1',
    });
    const body = await readBody(response);

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'idempotency_key_reuse',
      message: 'Payload mismatch',
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(deps.createAsyncStudioJob).not.toHaveBeenCalled();
    expect(deps.completeIdempotency).not.toHaveBeenCalled();
  });

  it('fails async self exports cleanly when the studio job cannot be enqueued', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 1, rows: [accountRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'job-1', status: 'queued' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const deps = createDeps();
    vi.mocked(deps.createAsyncStudioJob).mockRejectedValueOnce(new Error('queue_down'));
    const flows = createDsrExportFlows(deps);

    const response = await flows.runSelfExport({
      client: { query },
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      exportRequest: { format: 'json', async: true },
      idempotencyKey: 'idem-1',
    });
    const body = await readBody(response);

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: 'export_job_queue_failed' });
    expect(query.mock.calls.at(-1)?.[0]).toContain("status = 'failed'");
    expect(query.mock.calls.at(-1)?.[1]).toEqual(['job-1', 'queue_down']);
  });

  it('delivers sync self exports as JSON text responses and stores the replay payload as text', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 1, rows: [accountRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'request-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const deps = createDeps();
    const flows = createDsrExportFlows(deps);

    const response = await flows.runSelfExport({
      client: { query },
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      exportRequest: { format: 'json', async: false },
      idempotencyKey: 'idem-1',
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(body).toBe(
      JSON.stringify(
        {
          exportedAt: '2026-05-15T12:00:00.000Z',
          account: { id: 'account-1' },
        },
        null,
        2
      )
    );
    expect(vi.mocked(collectDsrExportPayload)).toHaveBeenCalledWith(
      { query },
      expect.objectContaining({ format: 'json', instanceId: 'de-musterhausen' })
    );
    expect(deps.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        responseBody: {
          kind: 'text',
          body,
          contentType: 'application/json',
        },
      })
    );
  });

  it('replays structured admin exports through jsonResponse', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 1, rows: [accountRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...accountRow, id: 'account-2', keycloak_subject: 'kc-target-1' }] });
    const deps = createDeps();
    vi.mocked(deps.reserveIdempotency).mockResolvedValueOnce({
      status: 'replay',
      responseStatus: 200,
      responseBody: { exportJobId: 'job-1', status: 'queued' },
    });
    const flows = createDsrExportFlows(deps);

    const response = await flows.runAdminExport({
      client: { query },
      instanceId: 'de-musterhausen',
      actorKeycloakSubject: 'kc-admin-1',
      exportRequest: { format: 'json', async: false, targetKeycloakSubject: 'kc-target-1' },
      idempotencyKey: 'idem-admin-1',
    });
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({ exportJobId: 'job-1', status: 'queued' });
    expect(deps.textResponse).not.toHaveBeenCalled();
  });

  it('delivers sync admin exports as CSV text responses', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 1, rows: [accountRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...accountRow, id: 'account-2', keycloak_subject: 'kc-target-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const deps = createDeps();
    const flows = createDsrExportFlows(deps);

    const response = await flows.runAdminExport({
      client: { query },
      instanceId: 'de-musterhausen',
      actorKeycloakSubject: 'kc-admin-1',
      exportRequest: { format: 'csv', async: false, targetKeycloakSubject: 'kc-target-1' },
      idempotencyKey: 'idem-admin-1',
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(body).toBe('serialized-csv');
    expect(vi.mocked(serializeDsrExportPayload)).toHaveBeenCalledWith('csv', {
      exportedAt: '2026-05-15T12:00:00.000Z',
      account: { id: 'account-1' },
    });
    expect(deps.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: 'account-1',
        responseBody: {
          kind: 'text',
          body: 'serialized-csv',
          contentType: 'text/csv; charset=utf-8',
        },
      })
    );
  });

  it('falls back to the target account for sync admin XML exports when the actor account is missing', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...accountRow, id: 'account-2', keycloak_subject: 'kc-target-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const deps = createDeps();
    const flows = createDsrExportFlows(deps);

    const response = await flows.runAdminExport({
      client: { query },
      instanceId: 'de-musterhausen',
      actorKeycloakSubject: 'kc-missing-admin',
      exportRequest: { format: 'xml', async: false, targetKeycloakSubject: 'kc-target-1' },
      idempotencyKey: 'idem-admin-xml-1',
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(body).toBe('serialized-xml');
    expect(deps.reserveIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ actorAccountId: 'account-2' })
    );
    expect(deps.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: 'account-2',
        responseBody: {
          kind: 'text',
          body: 'serialized-xml',
          contentType: 'application/xml; charset=utf-8',
        },
      })
    );
  });

  it('returns target_account_not_found for admin exports without a target account', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 1, rows: [accountRow] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const flows = createDsrExportFlows(createDeps());

    const response = await flows.runAdminExport({
      client: { query },
      instanceId: 'de-musterhausen',
      actorKeycloakSubject: 'kc-admin-1',
      exportRequest: { format: 'json', async: false, targetKeycloakSubject: 'kc-missing' },
      idempotencyKey: 'idem-admin-1',
    });
    const body = await readBody(response);

    expect(response.status).toBe(404);
    expect(body.error).toBe('target_account_not_found');
  });
});
