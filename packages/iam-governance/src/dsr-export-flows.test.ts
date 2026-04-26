import { describe, expect, it, vi } from 'vitest';

import { createDsrExportFlows, type DsrExportFlowDeps } from './dsr-export-flows.js';
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
    expect(deps.completeIdempotency).not.toHaveBeenCalled();
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
