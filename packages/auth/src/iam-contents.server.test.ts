import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  workspaceContext: {
    workspaceId: 'de-musterhausen',
    requestId: 'req-content',
    traceId: 'trace-content',
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
    roles: ['editor'],
    instanceId: 'de-musterhausen',
  },
  queryLog: [] as Array<{ text: string; values?: readonly unknown[] }>,
  queryHandler: null as null | ((text: string, values?: readonly unknown[]) => { rowCount: number; rows: unknown[] }),
}));

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-content',
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
  createContentHandler,
  getContentHandler,
  getContentHistoryHandler,
  listContentsHandler,
  updateContentHandler,
} from './iam-contents.server.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  Origin: 'http://localhost:3000',
} as const;

const resolveActorAccountQuery = (text: string) => text.includes('SELECT a.id AS account_id');

const contentRow = {
  id: '11111111-1111-1111-1111-111111111111',
  content_type: 'generic',
  title: 'Startseite',
  published_at: '2026-03-22T09:00:00.000Z',
  created_at: '2026-03-22T08:55:00.000Z',
  updated_at: '2026-03-22T09:30:00.000Z',
  author_display_name: 'Admin User',
  payload_json: { body: 'Hallo' },
  status: 'published',
};

describe('iam-contents handlers', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://local/test';
    process.env.IAM_ADMIN_ENABLED = 'true';
    state.queryLog = [];
    state.queryHandler = null;
    state.logger.error.mockReset();
    state.user = {
      id: 'kc-admin-1',
      name: 'Admin User',
      roles: ['editor'],
      instanceId: 'de-musterhausen',
    };
  });

  it('lists contents for editor role', async () => {
    state.queryHandler = (text) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      if (text.includes('FROM iam.contents content')) {
        return { rowCount: 1, rows: [contentRow] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await listContentsHandler(
      new Request('http://localhost:3000/api/v1/iam/contents', { method: 'GET' })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: Array<{ title: string; contentType: string }> };
    expect(payload.data).toEqual([
      expect.objectContaining({
        title: 'Startseite',
        contentType: 'generic',
      }),
    ]);
  });

  it('creates and updates content with history-safe responses', async () => {
    state.queryHandler = (text) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      if (text.includes('FROM iam.idempotency_keys')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('INSERT INTO iam.idempotency_keys')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('INSERT INTO iam.contents')) {
        return { rowCount: 1, rows: [{ id: contentRow.id }] };
      }
      if (text.includes('UPDATE iam.contents')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('INSERT INTO iam.content_history')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('FROM iam.content_history history')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('INSERT INTO iam.activity_logs') || text.includes('UPDATE iam.idempotency_keys')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('FROM iam.contents content')) {
        return {
          rowCount: 1,
          rows: [
            {
              ...contentRow,
              title: text.includes('LIMIT 1') && state.queryLog.some((entry) => entry.text.includes('UPDATE iam.contents'))
                ? 'Neue Startseite'
                : contentRow.title,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const createResponse = await createContentHandler(
      new Request('http://localhost:3000/api/v1/iam/contents', {
        method: 'POST',
        headers: { ...jsonHeaders, 'Idempotency-Key': 'idem-content-1', 'X-CSRF-Token': 'test-csrf' },
        body: JSON.stringify({
          contentType: 'generic',
          title: 'Startseite',
          payload: { body: 'Hallo' },
          status: 'published',
          publishedAt: '2026-03-22T09:00:00.000Z',
        }),
      })
    );
    expect(createResponse.status).toBe(201);
    const createPayload = (await createResponse.json()) as { data: { history: unknown[] } };
    expect(createPayload.data.history).toEqual([]);

    const updateResponse = await updateContentHandler(
      new Request(`http://localhost:3000/api/v1/iam/contents/${contentRow.id}`, {
        method: 'PATCH',
        headers: { ...jsonHeaders, 'X-CSRF-Token': 'test-csrf' },
        body: JSON.stringify({
          title: 'Neue Startseite',
          status: 'approved',
        }),
      })
    );
    expect(updateResponse.status).toBe(200);
    const payload = (await updateResponse.json()) as { data: { title: string; history: unknown[] } };
    expect(payload.data.title).toBe('Neue Startseite');
    expect(payload.data.history).toEqual([]);
  });

  it('loads content history and rejects users without allowed role', async () => {
    state.queryHandler = (text) => {
      if (resolveActorAccountQuery(text)) {
        return { rowCount: 1, rows: [{ account_id: 'account-1' }] };
      }
      if (text.includes('FROM iam.contents content')) {
        return { rowCount: 1, rows: [contentRow] };
      }
      if (text.includes('FROM iam.content_history history')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'hist-1',
              content_id: contentRow.id,
              action: 'created',
              actor_display_name: 'Admin User',
              changed_fields: ['title', 'payload', 'status'],
              previous_status: null,
              next_status: 'published',
              created_at: '2026-03-22T09:00:00.000Z',
              summary: 'Inhalt erstellt',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const historyResponse = await getContentHistoryHandler(
      new Request(`http://localhost:3000/api/v1/iam/contents/${contentRow.id}/history`, { method: 'GET' })
    );
    expect(historyResponse.status).toBe(200);
    const historyPayload = (await historyResponse.json()) as { data: Array<{ action: string }> };
    expect(historyPayload.data).toEqual([expect.objectContaining({ action: 'created' })]);

    state.user = {
      id: 'kc-viewer-1',
      name: 'Viewer',
      roles: ['member'],
      instanceId: 'de-musterhausen',
    };

    const deniedResponse = await getContentHandler(
      new Request(`http://localhost:3000/api/v1/iam/contents/${contentRow.id}`, { method: 'GET' })
    );
    expect(deniedResponse.status).toBe(403);
  });
});
