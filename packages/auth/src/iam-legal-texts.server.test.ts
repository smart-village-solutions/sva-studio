import { beforeEach, describe, expect, it, vi } from 'vitest';

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
}));

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-legal-texts',
      user: state.user,
    })
  ),
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
    state.queryLog = [];
    state.queryHandler = null;
    state.logger.error.mockReset();
    state.logger.warn.mockReset();
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
});
