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
  resolveActorAccountId: vi.fn(),
  withInstanceScopedDb: vi.fn(),
  listSvaMainserverNews: vi.fn(),
  listSvaMainserverEvents: vi.fn(),
  listSvaMainserverPoi: vi.fn(),
  getWorkspaceContext: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
  resolveActorAccountId: state.resolveActorAccountId,
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
  let syncStates: Map<
    string,
    {
      last_started_at: string | null;
      last_succeeded_at: string | null;
      last_failed_at: string | null;
      last_error_code: string | null;
      last_error_message: string | null;
      projected_count: number;
    }
  >;
  let projectionInsertArgs: readonly unknown[] | null;

  const applyProjectionFilters = (text: string, values: readonly unknown[] | undefined): ProjectionRow[] => {
    const scopedInstanceId = String(values?.[0] ?? '');
    let rows = projectionRows.filter((row) => row.instance_id === scopedInstanceId);

    const contentTypeMatches = [...text.matchAll(/projection\.content_type = \$(\d+)/g)];
    if (contentTypeMatches.length > 0) {
      const contentTypes = contentTypeMatches
        .map((match) => values?.[Number.parseInt(match[1] ?? '0', 10) - 1])
        .filter((value): value is string => typeof value === 'string');
      rows = rows.filter((row) => contentTypes.includes(row.content_type));
    }

    const orgMatches = [...text.matchAll(/projection\.organization_id::text = ANY\(\$(\d+)::text\[\]\)/g)];
    if (orgMatches.length > 0 && !text.includes('NOT (projection.organization_id::text = ANY')) {
      const allowedOrganizationIds = orgMatches.flatMap((match) => {
        const value = values?.[Number.parseInt(match[1] ?? '0', 10) - 1];
        return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
      });
      rows = rows.filter((row) => row.organization_id !== null && allowedOrganizationIds.includes(row.organization_id));
    }

    return rows;
  };

  beforeEach(() => {
    projectionRows = [];
    syncStates = new Map();
    projectionInsertArgs = null;
    state.authorizeContentPrimitiveForUser.mockReset();
    state.resolveActorAccountId.mockReset();
    state.withInstanceScopedDb.mockReset();
    state.listSvaMainserverNews.mockReset();
    state.listSvaMainserverEvents.mockReset();
    state.listSvaMainserverPoi.mockReset();
    state.getWorkspaceContext.mockReset();
    state.getWorkspaceContext.mockReturnValue({ requestId: 'req-1' });

    state.authorizeContentPrimitiveForUser.mockImplementation(async ({ action }: { action: string }) =>
      action.endsWith('.read')
        ? {
            ok: true,
            actor: {
              instanceId: 'de-musterhausen',
              keycloakSubject: 'kc-user-1',
            },
            permissions: [{ action, resourceType: action.split('.')[0] ?? 'content' }],
          }
        : {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'forbidden',
          }
    );
    state.resolveActorAccountId.mockResolvedValue('account-1');

    state.withInstanceScopedDb.mockImplementation(async (_instanceId: string, work: (client: { query: <TRow>(text: string, values?: readonly unknown[]) => Promise<{ rows: TRow[]; rowCount: number }> }) => Promise<unknown>) =>
      work({
        query: async <TRow>(text: string, values?: readonly unknown[]) => {
          if (text.includes('FROM iam.content_list_projection_sync_state')) {
            const contentType = String(values?.[1] ?? '');
            const row = syncStates.get(contentType);
            return { rows: row ? ([row] as TRow[]) : [], rowCount: row ? 1 : 0 };
          }

          if (text.includes('INSERT INTO iam.content_list_projection_sync_state')) {
            const contentType = String(values?.[1] ?? '');
            if ((values?.length ?? 0) >= 4) {
              syncStates.set(contentType, {
                ...(syncStates.get(contentType) ?? {
                  last_started_at: null,
                  last_succeeded_at: null,
                  last_failed_at: null,
                  last_error_code: null,
                  last_error_message: null,
                  projected_count: 0,
                }),
                last_failed_at: new Date().toISOString(),
                last_error_code: String(values?.[2] ?? ''),
                last_error_message: String(values?.[3] ?? ''),
              });
            } else if ((values?.length ?? 0) === 3) {
              syncStates.set(contentType, {
                ...(syncStates.get(contentType) ?? {
                  last_started_at: null,
                  last_succeeded_at: null,
                  last_failed_at: null,
                  last_error_code: null,
                  last_error_message: null,
                  projected_count: 0,
                }),
                last_succeeded_at: new Date().toISOString(),
                last_failed_at: null,
                last_error_code: null,
                last_error_message: null,
                projected_count: Number(values?.[2] ?? 0),
              });
            } else {
              syncStates.set(contentType, {
                last_started_at: new Date().toISOString(),
                ...(syncStates.get(contentType) ?? {
                  last_succeeded_at: null,
                  last_failed_at: null,
                  last_error_code: null,
                  last_error_message: null,
                  projected_count: 0,
                }),
              });
            }
            return { rows: [], rowCount: 1 };
          }

          if (text.includes('FROM iam.content_list_projection') && text.includes("source_system = 'mainserver'") && text.includes('organization_id::text = $3')) {
            const instanceId = String(values?.[0] ?? '');
            const contentType = String(values?.[1] ?? '');
            const organizationId = String(values?.[2] ?? '');
            const total = projectionRows.filter(
              (row) =>
                row.instance_id === instanceId &&
                row.source_system === 'mainserver' &&
                row.content_type === contentType &&
                row.organization_id === organizationId
            ).length;
            return { rows: [{ total }] as TRow[], rowCount: 1 };
          }

          if (text.includes('DELETE FROM iam.content_list_projection')) {
            const contentType = String(values?.[1] ?? '');
            projectionRows = projectionRows.filter((row) => !(row.source_system === 'mainserver' && row.content_type === contentType));
            return { rows: [], rowCount: 0 };
          }

          if (text.includes('INSERT INTO iam.content_list_projection')) {
            projectionInsertArgs = values ?? null;
            const rows = JSON.parse(String(values?.[0] ?? '[]')) as Array<Record<string, unknown>>;
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
            const rows = applyProjectionFilters(text, values);
            return { rows: [{ total: rows.length }] as TRow[], rowCount: 1 };
          }

          if (text.includes('FROM iam.content_list_projection AS projection')) {
            const rows = applyProjectionFilters(text, values);
            return { rows: rows as TRow[], rowCount: rows.length };
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

  it('returns a deterministic error without a snapshot and starts a background refresh', async () => {
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

    expect(response.status).toBe(503);
    expect(state.listSvaMainserverNews).toHaveBeenCalledTimes(1);
    expect(syncStates.get('news.article')?.last_started_at).toBeTruthy();
    expect(projectionInsertArgs).toHaveLength(1);
  });

  it('returns the last successful snapshot together with sync metadata while a background refresh runs', async () => {
    projectionRows = [
      {
        id: 'news-1',
        instance_id: 'de-musterhausen',
        organization_id: 'org-1',
        owner_subject_id: null,
        content_type: 'news.article',
        title: 'Rathaus',
        published_at: '2026-06-21T09:00:00.000Z',
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'account-9',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'account-9',
        author_display_name: 'Alice',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-1',
      },
    ];
    syncStates.set('news.article', {
      last_started_at: null,
      last_succeeded_at: '2026-06-20T10:00:00.000Z',
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 1,
    });
    state.listSvaMainserverNews.mockImplementation(
      () => new Promise(() => undefined)
    );

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    const payload = (await response.json()) as {
      data: Array<{ id: string; title: string }>;
      metadata: {
        hasStaleMainserverContent: boolean;
        hasRunningMainserverSync: boolean;
        mainserverSyncStates: Array<{ contentType: string; isStale: boolean }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([
      expect.objectContaining({
        id: 'news-1',
        title: 'Rathaus',
      }),
    ]);
    expect(payload.metadata.hasStaleMainserverContent).toBe(true);
    expect(payload.metadata.hasRunningMainserverSync).toBe(true);
    expect(payload.metadata.mainserverSyncStates).toEqual([
      expect.objectContaining({
        contentType: 'news.article',
        isStale: true,
      }),
    ]);
    expect(state.listSvaMainserverNews).toHaveBeenCalledTimes(1);
  });

  it('keeps pagination total aligned with organization-scoped read visibility', async () => {
    projectionRows = [
      {
        id: 'content-1',
        instance_id: 'de-musterhausen',
        organization_id: 'org-1',
        owner_subject_id: null,
        content_type: 'generic',
        title: 'Visible',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'account-9',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'account-9',
        author_display_name: 'Alice',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'iam',
        source_entity_type: 'iam.contents',
        source_entity_id: 'content-1',
      },
      {
        id: 'content-2',
        instance_id: 'de-musterhausen',
        organization_id: 'org-2',
        owner_subject_id: null,
        content_type: 'generic',
        title: 'Hidden',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'account-9',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'account-9',
        author_display_name: 'Bob',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-2',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'iam',
        source_entity_type: 'iam.contents',
        source_entity_id: 'content-2',
      },
    ];
    state.authorizeContentPrimitiveForUser.mockImplementation(async ({ action }: { action: string }) =>
      action === 'content.read'
        ? {
            ok: true,
            actor: {
              instanceId: 'de-musterhausen',
              keycloakSubject: 'kc-user-1',
            },
            permissions: [{ action, resourceType: 'content', organizationId: 'org-1' }],
          }
        : {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'forbidden',
          }
    );

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['generic'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'content-1', title: 'Visible' })],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
      },
      requestId: 'req-1',
    });
  });

  it('derives row access from the resolved permissions without per-item reauthorization calls', async () => {
    projectionRows = [
      {
        id: 'content-1',
        instance_id: 'de-musterhausen',
        organization_id: 'org-1',
        owner_subject_id: null,
        content_type: 'generic',
        title: 'Visible',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'account-1',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'account-1',
        author_display_name: 'Alice',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'iam',
        source_entity_type: 'iam.contents',
        source_entity_id: 'content-1',
      },
    ];
    state.authorizeContentPrimitiveForUser.mockImplementation(async ({ action }: { action: string }) =>
      action === 'content.read'
        ? {
            ok: true,
            actor: {
              instanceId: 'de-musterhausen',
              keycloakSubject: 'kc-user-1',
            },
            permissions: [
              { action: 'content.read', resourceType: 'content' },
              { action: 'content.create', resourceType: 'content' },
              { action: 'content.updateMetadata', resourceType: 'content' },
            ],
          }
        : {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'forbidden',
          }
    );

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['generic'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [
        expect.objectContaining({
          id: 'content-1',
          access: expect.objectContaining({
            state: 'editable',
            canCreate: true,
            canUpdate: true,
          }),
        }),
      ],
    });
    expect(state.authorizeContentPrimitiveForUser).toHaveBeenCalledTimes(1);
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
        message: 'Für mindestens einen angefragten Mainserver-Inhaltstyp liegt noch kein synchronisierter Snapshot vor.',
      },
      requestId: 'req-1',
    });
  });

  it('keeps mainserver rows visible for organization-scoped plugin read permissions', async () => {
    projectionRows = [
      {
        id: 'news-1',
        instance_id: 'de-musterhausen',
        organization_id: 'org-1',
        owner_subject_id: null,
        content_type: 'news.article',
        title: 'Rathaus',
        published_at: '2026-06-21T09:00:00.000Z',
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'mainserver',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'mainserver',
        author_display_name: 'Redaktion',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-1',
      },
    ];
    syncStates.set('news.article', {
      last_started_at: null,
      last_succeeded_at: new Date().toISOString(),
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 1,
    });
    state.authorizeContentPrimitiveForUser.mockImplementation(async ({ action }: { action: string }) =>
      action === 'news.read'
        ? {
            ok: true,
            actor: {
              instanceId: 'de-musterhausen',
              keycloakSubject: 'kc-user-1',
              organizationId: 'org-1',
            },
            permissions: [{ action, resourceType: 'news', organizationId: 'org-1', accessScope: 'organization' }],
          }
        : {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'forbidden',
          }
    );

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'news-1', organizationId: 'org-1' })],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
      },
      requestId: 'req-1',
    });
  });

  it('keeps unscoped mainserver rows visible when no active organization is set', async () => {
    projectionRows = [
      {
        id: 'news-1',
        instance_id: 'de-musterhausen',
        organization_id: null,
        owner_subject_id: null,
        content_type: 'news.article',
        title: 'Rathaus',
        published_at: '2026-06-21T09:00:00.000Z',
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'mainserver',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'mainserver',
        author_display_name: 'Redaktion',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-1',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-1',
      },
    ];
    syncStates.set('news.article', {
      last_started_at: null,
      last_succeeded_at: new Date().toISOString(),
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 1,
    });
    state.listSvaMainserverNews.mockResolvedValue({
      data: [
        {
          id: 'news-1',
          title: 'Rathaus',
          contentType: 'news.article',
          payload: {},
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
    state.authorizeContentPrimitiveForUser.mockImplementation(async ({ action }: { action: string }) =>
      action === 'news.read'
        ? {
            ok: true,
            actor: {
              instanceId: 'de-musterhausen',
              keycloakSubject: 'kc-user-1',
            },
            permissions: [{ action, resourceType: 'news', organizationId: 'org-1', accessScope: 'organization' }],
          }
        : {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'forbidden',
          }
    );

    const response = await listProjectedContents(
      {
        ...ctx,
        activeOrganizationId: undefined,
      },
      {
        page: 1,
        pageSize: 25,
        visibleTypes: ['news.article'],
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      }
    );

    await expect(response.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'news-1' })],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
      },
    });
  });

  it('treats stale legacy org-less mainserver rows as a blocking snapshot gap for organization-scoped views', async () => {
    projectionRows = [
      {
        id: 'news-legacy',
        instance_id: 'de-musterhausen',
        organization_id: null,
        owner_subject_id: null,
        content_type: 'news.article',
        title: 'Legacy',
        published_at: null,
        publish_from: null,
        publish_until: null,
        created_at: '2026-06-20T10:00:00.000Z',
        created_by: 'mainserver',
        updated_at: '2026-06-21T10:00:00.000Z',
        updated_by: 'mainserver',
        author_display_name: 'Redaktion',
        payload_json: {},
        status: 'published',
        validation_state: 'valid',
        history_ref: 'history-legacy',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-legacy',
      },
    ];
    syncStates.set('news.article', {
      last_started_at: null,
      last_succeeded_at: '2026-06-20T10:00:00.000Z',
      last_failed_at: null,
      last_error_code: null,
      last_error_message: null,
      projected_count: 1,
    });
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
    state.authorizeContentPrimitiveForUser.mockImplementation(async ({ action }: { action: string }) =>
      action === 'news.read'
        ? {
            ok: true,
            actor: {
              instanceId: 'de-musterhausen',
              keycloakSubject: 'kc-user-1',
              organizationId: 'org-1',
            },
            permissions: [{ action, resourceType: 'news', organizationId: 'org-1', accessScope: 'organization' }],
          }
        : {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'forbidden',
          }
    );

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['news.article'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        message: 'Für mindestens einen angefragten Mainserver-Inhaltstyp liegt noch kein synchronisierter Snapshot vor.',
      },
    });
  });

  it('treats the empty visible type sentinel as an empty list instead of forbidden', async () => {
    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['__no_readable_content__'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 0,
      },
      requestId: 'req-1',
    });
    expect(state.authorizeContentPrimitiveForUser).not.toHaveBeenCalled();
  });
});
