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
  resolveEffectivePermissions: vi.fn(),
  withInstanceScopedDb: vi.fn(),
  listSvaMainserverNews: vi.fn(),
  listSvaMainserverEvents: vi.fn(),
  listSvaMainserverPoi: vi.fn(),
  getWorkspaceContext: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
  resolveActorAccountId: state.resolveActorAccountId,
  resolveEffectivePermissions: state.resolveEffectivePermissions,
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

import {
  listProjectedContents,
  refreshProjectedContents,
  refreshProjectedContentsForMainserverMutation,
} from './iam-content-list-projection.server';

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
      const allowsUnscopedOrganizations = text.includes('projection.organization_id IS NULL');
      rows = rows.filter(
        (row) =>
          (row.organization_id !== null && allowedOrganizationIds.includes(row.organization_id)) ||
          (allowsUnscopedOrganizations && row.organization_id === null)
      );
    }

    const createdByMatches = [...text.matchAll(/projection\.created_by = \$(\d+)/g)];
    if (
      createdByMatches.length > 0 &&
      orgMatches.length === 0 &&
      !text.includes('projection.organization_id IS NULL')
    ) {
      const allowedCreators = createdByMatches
        .map((match) => values?.[Number.parseInt(match[1] ?? '0', 10) - 1])
        .filter((value): value is string => typeof value === 'string');
      rows = rows.filter((row) => allowedCreators.includes(row.created_by));
    }

    if (text.includes('projection.owner_subject_id = $')) {
      const ownerSubjectIdMatches = [...text.matchAll(/projection\.owner_subject_id = \$(\d+)/g)];
      const allowedOwnerSubjectIds = ownerSubjectIdMatches
        .map((match) => values?.[Number.parseInt(match[1] ?? '0', 10) - 1])
        .filter((value): value is string => typeof value === 'string');
      rows = rows.filter(
        (row) =>
          row.source_system !== 'mainserver' ||
          row.organization_id !== null ||
          row.owner_subject_id === null ||
          allowedOwnerSubjectIds.includes(row.owner_subject_id)
      );
    }

    return rows;
  };

  beforeEach(() => {
    projectionRows = [];
    syncStates = new Map();
    projectionInsertArgs = null;
    state.authorizeContentPrimitiveForUser.mockReset();
    state.resolveActorAccountId.mockReset();
    state.resolveEffectivePermissions.mockReset();
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
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [
        { action: 'content.read', resourceType: 'content' },
        { action: 'news.read', resourceType: 'news' },
        { action: 'events.read', resourceType: 'events' },
        { action: 'poi.read', resourceType: 'poi' },
      ],
    });
    state.resolveActorAccountId.mockResolvedValue('account-1');

    state.withInstanceScopedDb.mockImplementation(async (_instanceId: string, work: (client: { query: <TRow>(text: string, values?: readonly unknown[]) => Promise<{ rows: TRow[]; rowCount: number }> }) => Promise<unknown>) =>
      work({
        query: async <TRow>(text: string, values?: readonly unknown[]) => {
          if (text.includes('FROM iam.content_list_projection_sync_state')) {
            const contentType = String(values?.[1] ?? '');
            const row = syncStates.get(contentType);
            return { rows: row ? ([row] as TRow[]) : [], rowCount: row ? 1 : 0 };
          }

          if (text.includes('SELECT DISTINCT projection.content_type')) {
            const instanceId = String(values?.[0] ?? '');
            const rows = [...new Set(projectionRows
              .filter((row) => row.instance_id === instanceId)
              .map((row) => row.content_type))]
              .sort((left, right) => left.localeCompare(right))
              .map((content_type) => ({ content_type })) as TRow[];
            return { rows, rowCount: rows.length };
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

          if (text.includes('FROM iam.content_list_projection') && text.includes("source_system = 'mainserver'") && text.includes('COUNT(*)::int AS total')) {
            const instanceId = String(values?.[0] ?? '');
            const contentType = String(values?.[1] ?? '');
            const organizationId =
              typeof values?.[2] === 'string' ? String(values[2]) : undefined;
            const keycloakSubject = String(values?.[3] ?? '');
            const total = projectionRows.filter(
              (row) =>
                row.instance_id === instanceId &&
                row.source_system === 'mainserver' &&
                row.content_type === contentType &&
                (
                  (organizationId ? row.organization_id === organizationId : row.organization_id === null) &&
                  (!organizationId
                    ? row.owner_subject_id === null || row.owner_subject_id === keycloakSubject
                    : true)
                )
            ).length;
            return { rows: [{ total }] as TRow[], rowCount: 1 };
          }

          if (text.includes('DELETE FROM iam.content_list_projection')) {
            const contentType = String(values?.[1] ?? '');
            const organizationId =
              typeof values?.[2] === 'string' ? String(values[2]) : undefined;
            const keycloakSubject = String(values?.[3] ?? '');
            projectionRows = projectionRows.filter(
              (row) =>
                !(
                  row.source_system === 'mainserver' &&
                  row.content_type === contentType &&
                  (
                    (organizationId ? row.organization_id === organizationId : row.organization_id === null) &&
                    (!organizationId
                      ? row.owner_subject_id === null || row.owner_subject_id === keycloakSubject
                      : true)
                  )
                )
            );
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
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [{ action: 'content.read', resourceType: 'content', organizationId: 'org-1' }],
    });

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

  it('finds projected rows when the search term appears only in payload_json', async () => {
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
        payload_json: { teaser: 'Nur im Payload' },
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

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['generic'],
      q: 'payload',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'content-1' })],
      pagination: {
        total: 1,
      },
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
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [
        { action: 'content.read', resourceType: 'content' },
        { action: 'content.create', resourceType: 'content' },
        { action: 'content.updateMetadata', resourceType: 'content' },
      ],
    });

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
    expect(state.authorizeContentPrimitiveForUser).not.toHaveBeenCalled();
  });

  it('keeps own-scoped readers on the list and filters rows by creator later', async () => {
    projectionRows = [
      {
        id: 'content-1',
        instance_id: 'de-musterhausen',
        organization_id: 'org-1',
        owner_subject_id: null,
        content_type: 'generic',
        title: 'Own Row',
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
      {
        id: 'content-2',
        instance_id: 'de-musterhausen',
        organization_id: 'org-1',
        owner_subject_id: null,
        content_type: 'generic',
        title: 'Other Row',
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
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [{ action: 'content.read', resourceType: 'content', accessScope: 'own' }],
    });

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      visibleTypes: ['generic'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'content-1', title: 'Own Row' })],
      pagination: {
        total: 1,
      },
    });
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
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [{ action: 'news.read', resourceType: 'news', organizationId: 'org-1', accessScope: 'organization' }],
    });

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
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [{ action: 'news.read', resourceType: 'news', organizationId: 'org-1', accessScope: 'organization' }],
    });

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
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [{ action: 'news.read', resourceType: 'news', organizationId: 'org-1', accessScope: 'organization' }],
    });

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

  it('does not block unfiltered lists when another scope is missing a mainserver snapshot', async () => {
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
        id: 'news-foreign',
        instance_id: 'de-musterhausen',
        organization_id: 'org-2',
        owner_subject_id: null,
        content_type: 'news.article',
        title: 'Foreign',
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
        history_ref: 'history-news',
        current_revision_ref: null,
        last_audit_event_ref: null,
        source_system: 'mainserver',
        source_entity_type: 'news.article',
        source_entity_id: 'news-foreign',
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

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ id: 'content-1' })]),
      pagination: {
        page: 1,
        pageSize: 25,
      },
      requestId: 'req-1',
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

  it('preserves unfiltered list semantics when neither type nor visibleTypes are supplied', async () => {
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
    ];

    const response = await listProjectedContents(ctx, {
      page: 1,
      pageSize: 25,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    await expect(response.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'content-1' })],
      pagination: {
        total: 1,
      },
    });
  });

  it('refreshes requested mainserver projections synchronously', async () => {
    state.listSvaMainserverEvents.mockResolvedValue({
      data: [
        {
          id: 'event-refresh-1',
          title: 'Aktuelle Veranstaltung',
          contentType: 'events.event-record',
          status: 'published',
          dates: [],
          recurringWeekdays: [],
          categories: [],
          addresses: [],
          contacts: [],
          urls: [],
          mediaContents: [],
          priceInformations: [],
          tags: [],
          visible: true,
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });
    const payload = (await response.json()) as {
      data: {
        status: string;
        syncStates: Array<{
          contentType: string;
          hasSnapshot: boolean;
          isStale: boolean;
        }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('completed');
    expect(payload.data.syncStates).toEqual([
      expect.objectContaining({
        contentType: 'events.event-record',
        hasSnapshot: true,
        isStale: false,
      }),
    ]);
    expect(projectionInsertArgs).toHaveLength(1);
    expect(projectionRows).toEqual([
      expect.objectContaining({
        content_type: 'events.event-record',
        organization_id: 'org-1',
        source_entity_id: 'event-refresh-1',
        source_system: 'mainserver',
      }),
    ]);
  });

  it('accepts refresh requests without mainserver-backed visible types', async () => {
    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['generic'],
      force: true,
    });

    await expect(response.json()).resolves.toEqual({
      data: {
        status: 'accepted',
        syncStates: [],
      },
      requestId: 'req-1',
    });
    expect(state.listSvaMainserverNews).not.toHaveBeenCalled();
    expect(state.listSvaMainserverEvents).not.toHaveBeenCalled();
    expect(state.listSvaMainserverPoi).not.toHaveBeenCalled();
  });

  it('refreshes a mainserver projection after direct mainserver mutations', async () => {
    state.listSvaMainserverPoi.mockResolvedValue({
      data: [
        {
          id: 'poi-mutation-1',
          name: 'Mutation POI',
          contentType: 'poi.point-of-interest',
          status: 'published',
          active: true,
          categories: [],
          addresses: [],
          priceInformations: [],
          openingHours: [],
          webUrls: [],
          mediaContents: [],
          certificates: [],
          tags: [],
          visible: true,
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    await refreshProjectedContentsForMainserverMutation({
      contentType: 'poi.point-of-interest',
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      organizationId: 'org-1',
    });

    expect(state.listSvaMainserverPoi).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOrganizationId: 'org-1',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
      })
    );
    expect(syncStates.get('poi.point-of-interest')).toEqual(
      expect.objectContaining({
        last_error_code: null,
        projected_count: 1,
      })
    );
    expect(projectionRows).toEqual([
      expect.objectContaining({
        organization_id: 'org-1',
        source_entity_id: 'poi-mutation-1',
      }),
    ]);
  });

  it('stores the same mainserver entity separately for different projection scopes', async () => {
    state.listSvaMainserverEvents.mockResolvedValue({
      data: [
        {
          id: 'event-shared-1',
          title: 'Geteilte Veranstaltung',
          contentType: 'events.event-record',
          status: 'published',
          dates: [],
          recurringWeekdays: [],
          categories: [],
          addresses: [],
          contacts: [],
          urls: [],
          mediaContents: [],
          priceInformations: [],
          tags: [],
          visible: true,
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });
    await refreshProjectedContents(
      {
        ...ctx,
        activeOrganizationId: undefined,
      },
      {
        visibleTypes: ['events.event-record'],
        force: true,
      }
    );

    expect(projectionRows).toEqual([
      expect.objectContaining({
        organization_id: 'org-1',
        owner_subject_id: null,
        source_entity_id: 'event-shared-1',
      }),
      expect.objectContaining({
        organization_id: null,
        owner_subject_id: 'kc-user-1',
        source_entity_id: 'event-shared-1',
      }),
    ]);
  });

  it('returns deterministic refresh errors for missing instances, permission backend failures, and forbidden types', async () => {
    const missingInstanceResponse = await refreshProjectedContents(
      {
        ...ctx,
        user: {
          ...ctx.user,
          instanceId: undefined,
        },
      },
      {
        visibleTypes: ['events.event-record'],
        force: true,
      }
    );

    expect(missingInstanceResponse.status).toBe(400);
    await expect(missingInstanceResponse.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_instance_id',
      },
    });

    state.resolveEffectivePermissions.mockResolvedValueOnce({
      ok: false,
    });

    const permissionFailureResponse = await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });

    expect(permissionFailureResponse.status).toBe(503);
    await expect(permissionFailureResponse.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
      },
    });

    state.resolveEffectivePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: [],
    });

    const forbiddenResponse = await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });

    expect(forbiddenResponse.status).toBe(403);
    await expect(forbiddenResponse.json()).resolves.toMatchObject({
      error: {
        code: 'forbidden',
      },
    });
  });

  it('refreshes multiple mainserver event pages and stops on empty follow-up pages', async () => {
    state.listSvaMainserverEvents.mockImplementation(async ({ page }: { page: number }) => ({
      data:
        page === 1
          ? [
              {
                id: 'event-page-1',
                title: 'Erste Seite',
                contentType: 'events.event-record',
                status: 'published',
                dates: [],
                recurringWeekdays: [],
                categories: [],
                addresses: [],
                contacts: [],
                urls: [],
                mediaContents: [],
                priceInformations: [],
                tags: [],
                visible: true,
                createdAt: '2026-06-20T10:00:00.000Z',
                updatedAt: '2026-06-21T10:00:00.000Z',
              },
            ]
          : [],
      pagination: { page, pageSize: 100, hasNextPage: true },
    }));

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['events.event-record'],
      force: true,
    });

    expect(response.status).toBe(200);
    expect(state.listSvaMainserverEvents).toHaveBeenCalledTimes(2);
    expect(state.listSvaMainserverEvents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        page: 2,
        pageSize: 100,
      })
    );
    expect(projectionRows).toEqual([
      expect.objectContaining({
        source_entity_id: 'event-page-1',
      }),
    ]);
  });

  it('marks empty mainserver POI projections as successful snapshots', async () => {
    state.listSvaMainserverPoi.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await refreshProjectedContents(ctx, {
      visibleTypes: ['poi.point-of-interest'],
      force: true,
    });
    const payload = (await response.json()) as {
      data: {
        status: string;
        syncStates: Array<{ contentType: string; hasSnapshot: boolean }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('completed');
    expect(payload.data.syncStates).toEqual([
      expect.objectContaining({
        contentType: 'poi.point-of-interest',
        hasSnapshot: true,
      }),
    ]);
    expect(projectionRows).toEqual([]);
    expect(syncStates.get('poi.point-of-interest')).toEqual(
      expect.objectContaining({
        last_error_code: null,
        projected_count: 0,
      })
    );
  });
});
