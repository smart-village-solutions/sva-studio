import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toPayloadHash } from './iam-account-management/api-helpers';

const state = vi.hoisted(() => ({
  workspaceContext: {
    workspaceId: 'de-musterhausen',
    requestId: 'req-legal-texts',
    traceId: 'trace-legal-texts',
  } as { workspaceId?: string; requestId?: string; traceId?: string },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    isLevelEnabled: vi.fn(() => true),
  },
  user: {
    id: 'kc-admin-1',
    name: 'Admin User',
    roles: ['system_admin'],
    instanceId: 'de-musterhausen',
  },
  queryLog: [] as Array<{ text: string; values?: readonly unknown[] }>,
  queryHandler: null as null | ((text: string, values?: readonly unknown[]) => { rowCount: number; rows: unknown[] }),
  authFailure: null as Error | null,
}));

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) => {
    if (state.authFailure) {
      throw state.authFailure;
    }
    return handler({
      sessionId: 'session-legal-texts',
      user: state.user,
    });
  }),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: () => state.workspaceContext,
  toJsonErrorResponse: (status: number, code: string, publicMessage?: string, options?: { requestId?: string }) =>
    new Response(
      JSON.stringify({
        error: code,
        ...(publicMessage ? { message: publicMessage } : {}),
        ...(options?.requestId ? { requestId: options.requestId } : {}),
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    ),
  withRequestContext: async (_opts: unknown, handler: () => Promise<Response> | Response) => handler(),
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createHistogram: vi.fn(() => ({ record: vi.fn() })),
      createCounter: vi.fn(() => ({ add: vi.fn() })),
      createObservableGauge: vi.fn(() => ({ addCallback: vi.fn() })),
    })),
  },
}));

vi.mock('pg', () => ({
  Pool: class MockPool {
    async connect() {
      return {
        async query(text: string, values?: readonly unknown[]) {
          state.queryLog.push({ text, values });
          if (
            text === 'BEGIN' ||
            text === 'COMMIT' ||
            text === 'ROLLBACK' ||
            text.startsWith('SELECT set_config')
          ) {
            return { rowCount: 0, rows: [] };
          }
          if (state.queryHandler) {
            return state.queryHandler(text, values);
          }
          return { rowCount: 0, rows: [] };
        },
        release() {
          return undefined;
        },
      };
    }
  },
}));

import {
  createLegalTextHandler,
  listLegalTextsHandler,
  updateLegalTextHandler,
} from './iam-legal-texts.server';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  Origin: 'http://localhost:3000',
} as const;

const legalTextRow = {
  id: '11111111-1111-1111-1111-111111111111',
  legal_text_id: 'privacy_policy',
  legal_text_version: '2026-03',
  locale: 'de-DE',
  content_hash: 'sha256:abc123',
  is_active: true,
  published_at: '2026-03-16T09:00:00.000Z',
  created_at: '2026-03-16T08:55:00.000Z',
  acceptance_count: 4,
  active_acceptance_count: 3,
  last_accepted_at: '2026-03-16T10:00:00.000Z',
};

const resolveActorAccountQuery = (text: string) => text.includes('SELECT a.id AS account_id');

describe('iam-legal-texts handlers', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://local/test';
    process.env.IAM_ADMIN_ENABLED = 'true';
    state.queryLog = [];
    state.queryHandler = null;
    state.authFailure = null;
    state.logger.error.mockReset();
    state.logger.warn.mockReset();
    state.user = {
      id: 'kc-admin-1',
      name: 'Admin User',
      roles: ['system_admin'],
      instanceId: 'de-musterhausen',
    };
  });

  it('lists legal texts with acceptance counters', async () => {
    state.queryHandler = (text) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      if (text.includes('FROM iam.legal_text_versions version')) {
        return { rowCount: 1, rows: [legalTextRow] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await listLegalTextsHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', { method: 'GET' })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: Array<{ legalTextId: string; activeAcceptanceCount: number; lastAcceptedAt?: string }>;
    };
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({
      legalTextId: 'privacy_policy',
      activeAcceptanceCount: 3,
      lastAcceptedAt: '2026-03-16T10:00:00.000Z',
    });
    expect(
      state.queryLog.some(
        (entry) =>
          entry.text.includes('COUNT(acceptance.id) FILTER') &&
          entry.text.includes('acceptance.id IS NOT NULL') &&
          !entry.text.includes('COUNT(*) FILTER')
      )
    ).toBe(true);
  });

  it('returns a stable page size for empty legal text lists', async () => {
    state.queryHandler = (text) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      if (text.includes('FROM iam.legal_text_versions version')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await listLegalTextsHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', { method: 'GET' })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: unknown[];
      pagination: { page: number; pageSize: number; total: number };
    };
    expect(payload.data).toEqual([]);
    expect(payload.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 0,
    });
  });

  it('creates a legal text version with idempotency protection', async () => {
    state.queryHandler = (text, values) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      if (text.includes('FROM iam.idempotency_keys')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('INSERT INTO iam.legal_text_versions')) {
        expect(values).toEqual([
          'de-musterhausen',
          'terms_of_use',
          '2026-04',
          'en-GB',
          'sha256:def456',
          false,
          '2026-04-01T12:00:00.000Z',
        ]);
        return {
          rowCount: 1,
          rows: [{ id: legalTextRow.id }],
        };
      }
      if (text.includes('FROM iam.legal_text_versions version')) {
        return {
          rowCount: 1,
          rows: [
            {
              ...legalTextRow,
              legal_text_id: 'terms_of_use',
              legal_text_version: '2026-04',
              locale: 'en-GB',
              content_hash: 'sha256:def456',
              is_active: false,
              published_at: '2026-04-01T12:00:00.000Z',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await createLegalTextHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', {
        method: 'POST',
        headers: {
          ...jsonHeaders,
          'Idempotency-Key': 'idem-legal-text-1',
        },
        body: JSON.stringify({
          legalTextId: 'terms_of_use',
          legalTextVersion: '2026-04',
          locale: 'en-GB',
          contentHash: 'sha256:def456',
          isActive: false,
          publishedAt: '2026-04-01T12:00:00.000Z',
        }),
      })
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as { data: { legalTextId: string; isActive: boolean; locale: string } };
    expect(payload.data).toMatchObject({
      legalTextId: 'terms_of_use',
      isActive: false,
      locale: 'en-GB',
    });
    expect(state.queryLog.some((entry) => entry.text.includes('INSERT INTO iam.idempotency_keys'))).toBe(true);
    expect(state.queryLog.some((entry) => entry.text.includes('UPDATE iam.idempotency_keys'))).toBe(true);
  });

  it('updates an existing legal text version', async () => {
    state.queryHandler = (text, values) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      if (text.includes('UPDATE iam.legal_text_versions')) {
        expect(values).toEqual([
          'de-musterhausen',
          legalTextRow.id,
          'sha256:updated',
          false,
          '2026-05-01T08:00:00.000Z',
        ]);
        return { rowCount: 1, rows: [{ id: legalTextRow.id }] };
      }
      if (text.includes('FROM iam.legal_text_versions version')) {
        return {
          rowCount: 1,
          rows: [
            {
              ...legalTextRow,
              content_hash: 'sha256:updated',
              is_active: false,
              published_at: '2026-05-01T08:00:00.000Z',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await updateLegalTextHandler(
      new Request(`http://localhost:3000/api/v1/iam/legal-texts/${legalTextRow.id}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({
          contentHash: 'sha256:updated',
          isActive: false,
          publishedAt: '2026-05-01T08:00:00.000Z',
        }),
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { contentHash: string; isActive: boolean } };
    expect(payload.data).toMatchObject({
      contentHash: 'sha256:updated',
      isActive: false,
    });
  });

  it('replays an idempotent create request without inserting another record', async () => {
    const rawBody = JSON.stringify({
      legalTextId: 'privacy_policy',
      legalTextVersion: '2026-03',
      locale: 'de-DE',
      contentHash: 'sha256:abc123',
      isActive: true,
    });
    state.queryHandler = (text) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      if (text.includes('FROM iam.idempotency_keys')) {
        return {
          rowCount: 1,
          rows: [
            {
              payload_hash: toPayloadHash(rawBody),
              status: 'COMPLETED',
              response_status: 201,
              response_body: { data: { id: legalTextRow.id, legalTextId: 'privacy_policy' } },
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await createLegalTextHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', {
        method: 'POST',
        headers: {
          ...jsonHeaders,
          'Idempotency-Key': 'idem-legal-text-replay',
        },
        body: rawBody,
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: { id: legalTextRow.id, legalTextId: 'privacy_policy' },
    });
    expect(state.queryLog.some((entry) => entry.text.includes('INSERT INTO iam.legal_text_versions'))).toBe(false);
  });

  it('returns conflict when a create request resolves to an existing version', async () => {
    state.queryHandler = (text) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      if (text.includes('FROM iam.idempotency_keys')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('INSERT INTO iam.legal_text_versions')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await createLegalTextHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', {
        method: 'POST',
        headers: {
          ...jsonHeaders,
          'Idempotency-Key': 'idem-legal-text-conflict',
        },
        body: JSON.stringify({
          legalTextId: 'privacy_policy',
          legalTextVersion: '2026-03',
          locale: 'de-DE',
          contentHash: 'sha256:abc123',
          isActive: true,
        }),
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'conflict',
      },
    });
  });

  it('returns forbidden when the actor account cannot be resolved for create and update', async () => {
    state.queryHandler = (text) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const createResponse = await createLegalTextHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', {
        method: 'POST',
        headers: {
          ...jsonHeaders,
          'Idempotency-Key': 'idem-legal-text-forbidden',
        },
        body: JSON.stringify({
          legalTextId: 'privacy_policy',
          legalTextVersion: '2026-03',
          locale: 'de-DE',
          contentHash: 'sha256:abc123',
          isActive: true,
        }),
      })
    );
    const updateResponse = await updateLegalTextHandler(
      new Request(`http://localhost:3000/api/v1/iam/legal-texts/${legalTextRow.id}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({
          contentHash: 'sha256:updated',
        }),
      })
    );

    expect(createResponse.status).toBe(403);
    expect(updateResponse.status).toBe(403);
  });

  it('returns not_found and database_unavailable branches for updates', async () => {
    state.queryHandler = (text) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      if (text.includes('UPDATE iam.legal_text_versions')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const notFoundResponse = await updateLegalTextHandler(
      new Request(`http://localhost:3000/api/v1/iam/legal-texts/${legalTextRow.id}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({
          contentHash: 'sha256:updated',
        }),
      })
    );

    expect(notFoundResponse.status).toBe(404);

    state.queryHandler = (text) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      if (text.includes('UPDATE iam.legal_text_versions')) {
        throw new Error('db down');
      }
      return { rowCount: 0, rows: [] };
    };

    const errorResponse = await updateLegalTextHandler(
      new Request(`http://localhost:3000/api/v1/iam/legal-texts/${legalTextRow.id}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({
          contentHash: 'sha256:updated',
        }),
      })
    );

    expect(errorResponse.status).toBe(503);
    expect(state.logger.error).toHaveBeenCalledWith(
      'Legal text update failed',
      expect.objectContaining({
        legal_text_version_id: legalTextRow.id,
      })
    );
  });

  it('returns a structured 500 when authentication wrapper setup fails unexpectedly', async () => {
    state.authFailure = new Error('auth wrapper down');

    const response = await listLegalTextsHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', { method: 'GET' })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'internal_error',
      message: 'Unbehandelter IAM-Fehler.',
      requestId: 'req-legal-texts',
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM legal texts request failed unexpectedly',
      expect.objectContaining({
        error_message: 'auth wrapper down',
      })
    );
  });

  it('rejects feature-disabled and missing-role access before querying the database', async () => {
    process.env.IAM_ADMIN_ENABLED = 'false';

    const disabledResponse = await listLegalTextsHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', { method: 'GET' })
    );

    expect(disabledResponse.status).toBe(503);

    process.env.IAM_ADMIN_ENABLED = 'true';
    state.user = {
      ...state.user,
      roles: ['editor'],
    };

    const roleDeniedResponse = await listLegalTextsHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', { method: 'GET' })
    );

    expect(roleDeniedResponse.status).toBe(403);
    expect(state.queryLog).toEqual([]);
  });

  it('covers request validation branches for create and update handlers', async () => {
    state.queryHandler = (text) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const missingIdempotencyResponse = await createLegalTextHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          legalTextId: 'privacy_policy',
          legalTextVersion: '2026-03',
          locale: 'de-DE',
          contentHash: 'sha256:abc123',
          isActive: true,
        }),
      })
    );

    const missingCsrfResponse = await createLegalTextHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-legal-text-missing-csrf',
        },
        body: JSON.stringify({
          legalTextId: 'privacy_policy',
          legalTextVersion: '2026-03',
          locale: 'de-DE',
          contentHash: 'sha256:abc123',
          isActive: true,
        }),
      })
    );

    const invalidPayloadResponse = await createLegalTextHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', {
        method: 'POST',
        headers: {
          ...jsonHeaders,
          'Idempotency-Key': 'idem-legal-text-invalid',
        },
        body: JSON.stringify({
          legalTextId: '',
        }),
      })
    );

    const missingPathResponse = await updateLegalTextHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({
          contentHash: 'sha256:updated',
        }),
      })
    );

    const invalidUpdatePayloadResponse = await updateLegalTextHandler(
      new Request(`http://localhost:3000/api/v1/iam/legal-texts/${legalTextRow.id}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({
          isActive: 'yes',
        }),
      })
    );

    expect(missingIdempotencyResponse.status).toBe(400);
    expect(missingCsrfResponse.status).toBe(403);
    expect(invalidPayloadResponse.status).toBe(400);
    expect(missingPathResponse.status).toBe(400);
    expect(invalidUpdatePayloadResponse.status).toBe(400);
  });

  it('returns database_unavailable when a created version cannot be reloaded', async () => {
    state.queryHandler = (text) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      if (text.includes('FROM iam.idempotency_keys')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('INSERT INTO iam.legal_text_versions')) {
        return { rowCount: 1, rows: [{ id: legalTextRow.id }] };
      }
      if (text.includes('FROM iam.legal_text_versions version')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await createLegalTextHandler(
      new Request('http://localhost:3000/api/v1/iam/legal-texts', {
        method: 'POST',
        headers: {
          ...jsonHeaders,
          'Idempotency-Key': 'idem-legal-text-reload-failure',
        },
        body: JSON.stringify({
          legalTextId: 'terms_of_use',
          legalTextVersion: '2026-04',
          locale: 'en-GB',
          contentHash: 'sha256:def456',
          isActive: false,
        }),
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
      },
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'Legal text create failed',
      expect.objectContaining({
        error: 'created_legal_text_not_found',
      })
    );
  });
});
