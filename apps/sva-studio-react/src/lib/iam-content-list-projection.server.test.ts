import { beforeEach, describe, expect, it, vi } from 'vitest';

type ProjectionRow = {
  id: string;
  instance_id: string;
  organization_id: string | null;
  owner_subject_id: string | null;
  content_type: string;
  title: string;
  published_at: string | null;
  publish_from: string | null;
  publish_until: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  author_display_name: string;
  payload_json: Record<string, unknown>;
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
  validation_state: 'valid' | 'invalid' | 'pending';
  history_ref: string;
  current_revision_ref: string | null;
  last_audit_event_ref: string | null;
  source_system: 'iam' | 'mainserver';
  source_entity_type: string;
  source_entity_id: string;
};

const state = vi.hoisted(() => ({
  authorizeContentPrimitiveForUser: vi.fn(),
  withInstanceScopedDb: vi.fn(),
  listSvaMainserverNews: vi.fn(),
  listSvaMainserverEvents: vi.fn(),
  listSvaMainserverPoi: vi.fn(),
  getWorkspaceContext: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  listSvaMainserverNews: state.listSvaMainserverNews,
  listSvaMainserverEvents: state.listSvaMainserverEvents,
  listSvaMainserverPoi: state.listSvaMainserverPoi,
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: state.getWorkspaceContext,
}));

import { listProjectedContents } from './iam-content-list-projection.server';

describe('content list projection', () => {
  const ctx = {
    sessionId: 'session-1',
    activeOrganizationId: 'org-1',
    user: {
      id: 'kc-user-1',
      instanceId: 'de-musterhausen',
      roles: [],
    },
  };

  let projectionRows: ProjectionRow[];
  let syncStates: Map<string, { last_succeeded_at: string | null }>;

  beforeEach(() => {
    projectionRows = [];
    syncStates = new Map();
    state.authorizeContentPrimitiveForUser.mockReset();
    state.withInstanceScopedDb.mockReset();
    state.listSvaMainserverNews.mockReset();
    state.listSvaMainserverEvents.mockReset();
    state.listSvaMainserverPoi.mockReset();
    state.getWorkspaceContext.mockReset();
    state.getWorkspaceContext.mockReturnValue({ requestId: 'req-1' });

    state.authorizeContentPrimitiveForUser.mockImplementation(async ({ action }: { action: string }) => ({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
      },
      permissions: [{ action, resourceType: action.split('.')[0] ?? 'content' }],
    }));

    state.withInstanceScopedDb.mockImplementation(async (_instanceId: string, work: (client: { query: <TRow>(text: string, values?: readonly unknown[]) => Promise<{ rows: TRow[]; rowCount: number }> }) => Promise<unknown>) =>
      work({
        query: async <TRow>(text: string, values?: readonly unknown[]) => {
          if (text.includes('FROM iam.content_list_projection_sync_state') && text.includes('SELECT last_succeeded_at::text')) {
            const contentType = String(values?.[1] ?? '');
            const row = syncStates.get(contentType);
            return { rows: row ? ([row] as TRow[]) : [], rowCount: row ? 1 : 0 };
          }

          if (text.includes('INSERT INTO iam.content_list_projection_sync_state')) {
            const contentType = String(values?.[1] ?? '');
            if ((values?.length ?? 0) >= 4) {
              syncStates.set(contentType, { last_succeeded_at: null });
            } else {
              syncStates.set(contentType, { last_succeeded_at: new Date().toISOString() });
            }
            return { rows: [], rowCount: 1 };
          }

          if (text.includes('DELETE FROM iam.content_list_projection')) {
            const contentType = String(values?.[1] ?? '');
            projectionRows = projectionRows.filter((row) => !(row.source_system === 'mainserver' && row.content_type === contentType));
            return { rows: [], rowCount: 0 };
          }

          if (text.includes('INSERT INTO iam.content_list_projection')) {
            const rows = JSON.parse(String(values?.[2] ?? '[]')) as Array<Record<string, unknown>>;
            projectionRows.push(
              ...(rows.map((row) => ({
                id: String(row.id),
                instance_id: String(row.instance_id),
                organization_id: (row.organization_id as string | null) ?? null,
                owner_subject_id: (row.owner_subject_id as string | null) ?? null,
                content_type: String(row.content_type),
                title: String(row.title),
                published_at: (row.published_at as string | null) ?? null,
                publish_from: (row.publish_from as string | null) ?? null,
                publish_until: (row.publish_until as string | null) ?? null,
                created_at: String(row.created_at),
                created_by: String(row.created_by),
                updated_at: String(row.updated_at),
                updated_by: String(row.updated_by),
                author_display_name: String(row.author_display_name),
                payload_json: (row.payload_json as Record<string, unknown>) ?? {},
                status: row.status as ProjectionRow['status'],
                validation_state: row.validation_state as ProjectionRow['validation_state'],
                history_ref: String(row.history_ref),
                current_revision_ref: (row.current_revision_ref as string | null) ?? null,
                last_audit_event_ref: (row.last_audit_event_ref as string | null) ?? null,
                source_system: 'mainserver',
                source_entity_type: String(row.source_entity_type),
                source_entity_id: String(row.source_entity_id),
              })) satisfies ProjectionRow[])
            );
            return { rows: [], rowCount: rows.length };
          }

          if (text.includes('SELECT COUNT(*)::int AS total')) {
            return { rows: [{ total: projectionRows.length }] as TRow[], rowCount: 1 };
          }

          if (text.includes('FROM iam.content_list_projection AS projection')) {
            return { rows: projectionRows as TRow[], rowCount: projectionRows.length };
          }

          return { rows: [], rowCount: 0 };
        },
      })
    );
  });

  it('returns an empty list when type and visibleType do not intersect', async () => {
    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      type: 'news.article',
      visibleTypes: ['poi.point-of-interest'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toEqual({
      data: [],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 0,
      },
      requestId: 'req-1',
    });
  });

  it('refreshes stale mainserver projections and returns the projected rows', async () => {
    state.listSvaMainserverNews.mockResolvedValue({
      data: [
        {
          id: 'news-1',
          title: 'Rathaus',
          contentType: 'news.article',
          payload: { teaser: 'A' },
          status: 'published',
          author: 'Redaktion',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
          contentBlocks: [],
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    const payload = (await response.json()) as {
      data: Array<{ id: string; contentType: string; title: string }>;
      pagination: { total: number };
    };

    expect(payload.data).toEqual([
      expect.objectContaining({
        id: 'news-1',
        contentType: 'news.article',
        title: 'Rathaus',
      }),
    ]);
    expect(payload.pagination.total).toBe(1);
    expect(state.listSvaMainserverNews).toHaveBeenCalledTimes(1);
    expect(syncStates.get('news.article')?.last_succeeded_at).toBeTruthy();
  });

  it('returns a deterministic list error when the mainserver refresh fails', async () => {
    state.listSvaMainserverNews.mockRejectedValue(Object.assign(new Error('upstream down'), { code: 'database_unavailable' }));

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'database_unavailable',
        message: 'upstream down',
      },
      requestId: 'req-1',
    });
  });
});
