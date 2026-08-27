import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentStateValidationError } from './repository-state-validation.js';
import type {
  ContentHistoryRow,
  ContentRow,
  CreateContentInput,
  DeleteContentInput,
  UpdateContentInput,
} from './repository-types.js';

const state = vi.hoisted(() => ({
  emitContentCreatedActivityMock: vi.fn(),
  emitContentDeletedActivityMock: vi.fn(),
  emitContentUpdatedActivityMock: vi.fn(),
  emitContentOwnershipTransferredActivityMock: vi.fn(),
  insertContentHistoryMock: vi.fn(),
  isContentMutationFinalizedMock: vi.fn(),
  insertContentRowMock: vi.fn(),
  loadCurrentContentRowMock: vi.fn(),
  mapContentHistoryItemMock: vi.fn(),
  mapContentListItemMock: vi.fn(),
  loadOrganizationListMock: vi.fn(),
  loadOrganizationByIdMock: vi.fn(),
  resolveUserDetailMock: vi.fn(),
  resolveUsersWithPaginationMock: vi.fn(),
  queryMock: vi.fn(),
  resolveContentMutationMetadataMock: vi.fn(),
  resolveUpdateAuthorDisplayMock: vi.fn(),
  resolveNextContentStateMock: vi.fn(),
  updateContentRevisionRefsMock: vi.fn(),
  updateContentRowMock: vi.fn(),
  validatePublicationWindowMock: vi.fn(),
  withInstanceScopedDbMock: vi.fn(),
}));

vi.mock('@sva/iam-admin', () => ({
  loadOrganizationById: (...args: unknown[]) => state.loadOrganizationByIdMock(...args),
  loadOrganizationList: (...args: unknown[]) => state.loadOrganizationListMock(...args),
  resolveUserDetail: (...args: unknown[]) => state.resolveUserDetailMock(...args),
  resolveUsersWithPagination: (...args: unknown[]) => state.resolveUsersWithPaginationMock(...args),
}));

vi.mock('../iam-account-management/shared.js', () => ({
  withInstanceScopedDb: (...args: unknown[]) => state.withInstanceScopedDbMock(...args),
}));

vi.mock('./repository-shared.js', () => ({
  insertContentHistory: (...args: unknown[]) => state.insertContentHistoryMock(...args),
  isContentMutationFinalized: (...args: unknown[]) => state.isContentMutationFinalizedMock(...args),
  loadCurrentContentRow: (...args: unknown[]) => state.loadCurrentContentRowMock(...args),
  resolveContentMutationMetadata: (...args: unknown[]) =>
    state.resolveContentMutationMetadataMock(...args),
}));

vi.mock('./repository-mappers.js', () => ({
  mapContentHistoryItem: (...args: unknown[]) => state.mapContentHistoryItemMock(...args),
  mapContentListItem: (...args: unknown[]) => state.mapContentListItemMock(...args),
}));

vi.mock('./repository-state.js', () => ({
  resolveNextContentState: (...args: unknown[]) => state.resolveNextContentStateMock(...args),
}));

vi.mock('./repository-write-helpers.js', () => ({
  emitContentCreatedActivity: (...args: unknown[]) => state.emitContentCreatedActivityMock(...args),
  emitContentDeletedActivity: (...args: unknown[]) => state.emitContentDeletedActivityMock(...args),
  emitContentUpdatedActivity: (...args: unknown[]) => state.emitContentUpdatedActivityMock(...args),
  emitContentOwnershipTransferredActivity: (...args: unknown[]) =>
    state.emitContentOwnershipTransferredActivityMock(...args),
  insertContentRow: (...args: unknown[]) => state.insertContentRowMock(...args),
  resolveUpdateAuthorDisplay: (...args: unknown[]) => state.resolveUpdateAuthorDisplayMock(...args),
  updateContentRevisionRefs: (...args: unknown[]) => state.updateContentRevisionRefsMock(...args),
  updateContentRow: (...args: unknown[]) => state.updateContentRowMock(...args),
  validatePublicationWindow: (...args: unknown[]) => state.validatePublicationWindowMock(...args),
}));

const {
  ContentOwnershipTransferError,
  createContent,
  deleteContent,
  loadContentById,
  loadContentDetail,
  loadContentHistory,
  loadContentListItems,
  loadContentListScopes,
  loadContentOwnershipTargets,
  loadContentRowById,
  updateContent,
  transferContentOwnership,
} = await import('./repository.js');

const createContentRow = (overrides: Partial<ContentRow> = {}): ContentRow => ({
  id: 'content-1',
  content_type: 'news.article',
  instance_id: 'instance-1',
  organization_id: null,
  owner_subject_id: null,
  owner_user_id: '00000000-0000-4000-8000-000000000010',
  owner_organization_id: null,
  title: 'Titel',
  published_at: null,
  publish_from: null,
  publish_until: null,
  created_at: '2026-05-01T08:00:00.000Z',
  created_by: 'account-1',
  updated_at: '2026-05-01T08:00:00.000Z',
  updated_by: 'account-1',
  author_display_mode: 'organization',
  author_display_name: 'Autor',
  payload_json: { body: 'Text' },
  status: 'draft',
  validation_state: 'valid',
  history_ref: 'history-1',
  current_revision_ref: 'history-1',
  last_audit_event_ref: null,
  ...overrides,
});

const resolveTestOwner = (row: ContentRow | undefined) => {
  if (row?.owner_user_id && !row.owner_organization_id) {
    return { type: 'account' as const, id: row.owner_user_id };
  }
  if (row?.owner_organization_id && !row.owner_user_id) {
    return { type: 'organization' as const, id: row.owner_organization_id };
  }
  return undefined;
};

const createHistoryRow = (overrides: Partial<ContentHistoryRow> = {}): ContentHistoryRow => ({
  id: 'history-1',
  content_id: 'content-1',
  action: 'updated',
  actor_display_name: 'Autor',
  changed_fields: ['title'],
  previous_status: 'draft',
  next_status: 'draft',
  created_at: '2026-05-01T08:30:00.000Z',
  summary: 'Inhalt aktualisiert',
  ...overrides,
});

const createCreateInput = (overrides: Partial<CreateContentInput> = {}): CreateContentInput => ({
  instanceId: 'instance-1',
  actorAccountId: '00000000-0000-0000-0000-000000000001',
  actorDisplayName: 'Autor',
  requestId: 'request-1',
  traceId: 'trace-1',
  contentType: 'news.article',
  title: 'Titel',
  payload: { body: 'Text' },
  status: 'draft',
  validationState: 'valid',
  ...overrides,
});

const createUpdateInput = (overrides: Partial<UpdateContentInput> = {}): UpdateContentInput => ({
  instanceId: 'instance-1',
  actorAccountId: '00000000-0000-0000-0000-000000000001',
  actorDisplayName: 'Autor',
  requestId: 'request-1',
  traceId: 'trace-1',
  contentId: 'content-1',
  ...overrides,
});

const createDeleteInput = (overrides: Partial<DeleteContentInput> = {}): DeleteContentInput => ({
  instanceId: 'instance-1',
  actorAccountId: '00000000-0000-0000-0000-000000000001',
  actorDisplayName: 'Autor',
  requestId: 'request-1',
  traceId: 'trace-1',
  contentId: 'content-1',
  ...overrides,
});

describe('iam content repository', () => {
  const normalizedTitleSortColumn = `LOWER(REGEXP_REPLACE(content.title COLLATE "unicode", '^[^[:alnum:]]+', '')) COLLATE "C"`;

  beforeEach(() => {
    for (const mock of Object.values(state)) {
      mock.mockReset();
    }

    state.withInstanceScopedDbMock.mockImplementation(
      async (_instanceId: string, work: (client: object) => Promise<unknown>) =>
        work({ query: state.queryMock })
    );
    state.queryMock.mockResolvedValue({ rows: [] });
    state.loadCurrentContentRowMock.mockResolvedValue(createContentRow());
    state.mapContentListItemMock.mockImplementation((row: ContentRow) => ({
      id: row.id,
      title: row.title,
      status: row.status,
    }));
    state.mapContentHistoryItemMock.mockImplementation((row: ContentHistoryRow) => ({
      id: row.id,
      action: row.action,
      summary: row.summary,
    }));
    state.validatePublicationWindowMock.mockReturnValue(undefined);
    state.insertContentRowMock.mockResolvedValue('content-1');
    state.insertContentHistoryMock.mockResolvedValue('history-1');
    state.isContentMutationFinalizedMock.mockResolvedValue(false);
    state.updateContentRevisionRefsMock.mockResolvedValue(undefined);
    state.emitContentCreatedActivityMock.mockResolvedValue(undefined);
    state.emitContentDeletedActivityMock.mockResolvedValue(undefined);
    state.emitContentUpdatedActivityMock.mockResolvedValue(undefined);
    state.emitContentOwnershipTransferredActivityMock.mockResolvedValue(undefined);
    state.updateContentRowMock.mockResolvedValue(undefined);
    state.resolveContentMutationMetadataMock.mockReturnValue({
      activityEventType: 'iam.content.updated',
      historyAction: 'updated',
      historySummary: 'Inhalt aktualisiert',
    });
    state.resolveUpdateAuthorDisplayMock.mockResolvedValue({
      authorDisplayMode: 'organization',
      authorDisplayName: 'Autor',
    });
    state.resolveNextContentStateMock.mockReturnValue({
      changedFields: ['title'],
      nextOrganizationId: null,
      nextOwnerUserId: null,
      nextOwnerOrganizationId: null,
      nextAuthorDisplayMode: 'organization',
      nextAuthorDisplayName: 'Autor',
      nextPayload: { body: 'Neu' },
      nextPublishedAt: null,
      nextPublishFrom: null,
      nextPublishUntil: null,
      nextStatus: 'draft',
      nextTitle: 'Neuer Titel',
      nextValidationState: 'valid',
    });
    state.resolveUsersWithPaginationMock.mockResolvedValue({ users: [], total: 0 });
    state.loadOrganizationListMock.mockResolvedValue({ items: [], total: 0 });
  });

  it('loads content list items and maps database rows', async () => {
    const firstRow = createContentRow();
    const secondRow = createContentRow({ id: 'content-2', title: 'Zweiter Titel' });
    state.queryMock
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })
      .mockResolvedValueOnce({ rows: [firstRow, secondRow] });

    await expect(
      loadContentListItems(
        'instance-1',
        {
          page: 1,
          pageSize: 25,
          sortBy: 'updatedAt',
          sortDirection: 'desc',
        },
        {
          allowGlobal: true,
          allowOwn: false,
          allowedOrganizationIds: [],
        }
      )
    ).resolves.toEqual({
      items: [
        { id: 'content-1', title: 'Titel', status: 'draft' },
        { id: 'content-2', title: 'Zweiter Titel', status: 'draft' },
      ],
      total: 2,
    });

    expect(state.queryMock).toHaveBeenCalledWith(
      expect.stringContaining(
        'ORDER BY (content.updated_at IS NULL) ASC, content.updated_at DESC, content.id ASC'
      ),
      ['instance-1', 25, 0]
    );
  });

  it('adds search, scope and type filters to the list query', async () => {
    state.queryMock
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await loadContentListItems(
      'instance-1',
      {
        page: 2,
        pageSize: 10,
        q: 'news',
        type: 'news.article',
        visibleTypes: ['news.article', 'events.event-record'],
        status: 'published',
        sortBy: 'title',
        sortDirection: 'asc',
      },
      {
        allowedOrganizationIds: ['11111111-1111-4111-8111-111111111111'],
        allowGlobal: false,
        allowOwn: true,
        actorAccountId: '00000000-0000-0000-0000-000000000001',
      }
    );

    expect(state.queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('content.owner_organization_id = ANY'),
      [
        'instance-1',
        ['news.article', 'events.event-record'],
        'news.article',
        'published',
        '%news%',
        ['11111111-1111-4111-8111-111111111111'],
        '00000000-0000-0000-0000-000000000001',
      ]
    );
    expect(state.queryMock.mock.calls[0]?.[0]).toContain('content.owner_user_id = $7::uuid');
    expect(state.queryMock.mock.calls[0]?.[0]).not.toContain('content.organization_id = ANY');
    expect(state.queryMock.mock.calls[0]?.[0]).not.toContain('content.organization_id IS NULL');
    expect(state.queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        `ORDER BY (${normalizedTitleSortColumn} IS NULL) ASC, ${normalizedTitleSortColumn} ASC, content.id ASC`
      ),
      [
        'instance-1',
        ['news.article', 'events.event-record'],
        'news.article',
        'published',
        '%news%',
        ['11111111-1111-4111-8111-111111111111'],
        '00000000-0000-0000-0000-000000000001',
        10,
        10,
      ]
    );
  });

  it('ignores only the leading non-alphanumeric prefix when sorting titles descending', async () => {
    state.queryMock
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await loadContentListItems(
      'instance-1',
      {
        page: 1,
        pageSize: 25,
        sortBy: 'title',
        sortDirection: 'desc',
      },
      {
        allowGlobal: true,
        allowOwn: false,
        allowedOrganizationIds: [],
      }
    );

    expect(state.queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        `ORDER BY (${normalizedTitleSortColumn} IS NULL) ASC, ${normalizedTitleSortColumn} DESC, content.id ASC`
      ),
      ['instance-1', 25, 0]
    );
  });

  it('loads distinct organization scopes for matching contents', async () => {
    state.queryMock.mockResolvedValueOnce({
      rows: [
        { organization_id: null },
        { organization_id: '11111111-1111-4111-8111-111111111111' },
      ],
    });

    await expect(
      loadContentListScopes('instance-1', {
        page: 1,
        pageSize: 25,
        q: 'news',
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      })
    ).resolves.toEqual([null, '11111111-1111-4111-8111-111111111111']);

    expect(state.queryMock).toHaveBeenCalledWith(
      expect.stringContaining('SELECT DISTINCT content.organization_id::text AS organization_id'),
      ['instance-1', '%news%']
    );
  });

  it('loads content rows by id and maps them for public reads', async () => {
    state.loadCurrentContentRowMock.mockResolvedValueOnce(createContentRow());

    await expect(loadContentRowById('instance-1', 'content-1')).resolves.toEqual(
      createContentRow()
    );
    await expect(loadContentById('instance-1', 'content-1')).resolves.toEqual({
      id: 'content-1',
      title: 'Titel',
      status: 'draft',
    });

    state.loadCurrentContentRowMock.mockResolvedValueOnce(undefined);
    await expect(loadContentById('instance-1', 'missing')).resolves.toBeUndefined();
  });

  it('loads history rows and maps them for detail responses', async () => {
    state.queryMock.mockResolvedValueOnce({
      rows: [createHistoryRow(), createHistoryRow({ id: 'history-2', summary: 'Status geändert' })],
    });

    await expect(loadContentHistory('instance-1', 'content-1')).resolves.toEqual([
      { id: 'history-1', action: 'updated', summary: 'Inhalt aktualisiert' },
      { id: 'history-2', action: 'updated', summary: 'Status geändert' },
    ]);
  });

  it('returns undefined for missing details and merges item plus history when present', async () => {
    state.loadCurrentContentRowMock.mockResolvedValueOnce(undefined);
    await expect(loadContentDetail('instance-1', 'missing')).resolves.toBeUndefined();

    state.loadCurrentContentRowMock.mockResolvedValueOnce(
      createContentRow({ id: 'content-2', title: 'Detail' })
    );
    state.queryMock.mockResolvedValueOnce({ rows: [createHistoryRow({ id: 'history-2' })] });

    await expect(loadContentDetail('instance-1', 'content-2')).resolves.toEqual({
      id: 'content-2',
      title: 'Detail',
      status: 'draft',
      history: [{ id: 'history-2', action: 'updated', summary: 'Inhalt aktualisiert' }],
    });
  });

  it('resolves account and organization owner names across paginated detail lookups', async () => {
    state.mapContentListItemMock
      .mockReturnValueOnce({
        id: 'content-account',
        title: 'Account detail',
        status: 'draft',
        ownerUserId: 'account-owner',
      })
      .mockReturnValueOnce({
        id: 'content-organization',
        title: 'Organization detail',
        status: 'draft',
        ownerOrganizationId: 'organization-owner',
      });
    state.loadCurrentContentRowMock
      .mockResolvedValueOnce(createContentRow({ id: 'content-account' }))
      .mockResolvedValueOnce(
        createContentRow({
          id: 'content-organization',
          owner_user_id: null,
          owner_organization_id: 'organization-owner',
        })
      );
    state.queryMock.mockResolvedValue({ rows: [] });
    state.resolveUserDetailMock.mockResolvedValueOnce({ displayName: 'Account Owner' });
    state.loadOrganizationByIdMock.mockResolvedValueOnce({
      display_name: 'Organization Owner',
    });

    await expect(loadContentDetail('instance-1', 'content-account')).resolves.toMatchObject({
      ownerDisplayName: 'Account Owner',
    });
    await expect(loadContentDetail('instance-1', 'content-organization')).resolves.toMatchObject({
      ownerDisplayName: 'Organization Owner',
    });
    expect(state.resolveUserDetailMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      { instanceId: 'instance-1', userId: 'account-owner' }
    );
    expect(state.loadOrganizationByIdMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      { instanceId: 'instance-1', organizationId: 'organization-owner' }
    );
  });

  it('lists paged ownership targets and excludes the matching current owner', async () => {
    state.resolveUsersWithPaginationMock.mockResolvedValueOnce({
      users: [{ id: 'account-target', displayName: 'Account Target' }],
      total: 1,
    });
    state.loadOrganizationListMock.mockResolvedValueOnce({
      items: [{ id: 'organization-target', displayName: 'Organization Target' }],
      total: 1,
    });

    await expect(
      loadContentOwnershipTargets('instance-1', {
        type: 'account',
        page: 2,
        pageSize: 10,
        search: 'target',
        currentOwner: { type: 'account', id: 'account-owner' },
      })
    ).resolves.toEqual({
      items: [
        {
          principal: { type: 'account', id: 'account-target' },
          displayName: 'Account Target',
        },
      ],
      page: 2,
      pageSize: 10,
      total: 1,
    });
    await expect(
      loadContentOwnershipTargets('instance-1', {
        type: 'organization',
        page: 1,
        pageSize: 20,
        currentOwner: { type: 'organization', id: 'organization-owner' },
      })
    ).resolves.toMatchObject({
      items: [{ principal: { type: 'organization', id: 'organization-target' } }],
      total: 1,
    });
    expect(state.resolveUsersWithPaginationMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      expect.objectContaining({ excludeAccountId: 'account-owner', search: 'target' })
    );
    expect(state.loadOrganizationListMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      expect.objectContaining({ excludeOrganizationId: 'organization-owner', isActive: true })
    );
  });

  it('creates content, persists history and emits the created activity', async () => {
    const input = createCreateInput({ publishedAt: '2026-05-02T08:00:00.000Z' });

    await expect(createContent(input)).resolves.toBe('content-1');

    expect(state.validatePublicationWindowMock).toHaveBeenCalledWith(input);
    expect(state.insertContentRowMock).toHaveBeenCalledWith({ query: state.queryMock }, input);
    expect(state.insertContentHistoryMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      expect.objectContaining({
        contentId: 'content-1',
        action: 'created',
        changedFields: ['contentType', 'title', 'payload', 'status', 'publishedAt'],
        nextStatus: 'draft',
        summary: 'Inhalt erstellt',
      })
    );
    expect(state.updateContentRevisionRefsMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      'instance-1',
      'content-1',
      'history-1'
    );
    expect(state.emitContentCreatedActivityMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      input,
      'content-1'
    );
  });

  it('stops create operations on publication validation errors before writing', async () => {
    const error = new ContentStateValidationError('content_publication_window_invalid');
    state.validatePublicationWindowMock.mockImplementationOnce(() => {
      throw error;
    });

    await expect(createContent(createCreateInput())).rejects.toBe(error);
    expect(state.insertContentRowMock).not.toHaveBeenCalled();
    expect(state.insertContentHistoryMock).not.toHaveBeenCalled();
  });

  it('returns undefined on update when the current content row is missing', async () => {
    state.loadCurrentContentRowMock.mockResolvedValueOnce(undefined);

    await expect(updateContent(createUpdateInput())).resolves.toBeUndefined();

    expect(state.resolveNextContentStateMock).not.toHaveBeenCalled();
    expect(state.updateContentRowMock).not.toHaveBeenCalled();
  });

  it('skips the complete update pipeline when a mutation reference was already finalized', async () => {
    state.isContentMutationFinalizedMock.mockResolvedValueOnce(true);

    await expect(
      updateContent(
        createUpdateInput({ mutationRef: 'mutation-1', title: 'Wird nicht erneut geschrieben' })
      )
    ).resolves.toBe('content-1');

    expect(state.isContentMutationFinalizedMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      { instanceId: 'instance-1', contentId: 'content-1', mutationRef: 'mutation-1' }
    );
    expect(state.loadCurrentContentRowMock).not.toHaveBeenCalled();
    expect(state.updateContentRowMock).not.toHaveBeenCalled();
    expect(state.insertContentHistoryMock).not.toHaveBeenCalled();
    expect(state.emitContentUpdatedActivityMock).not.toHaveBeenCalled();
  });

  it('stops update operations when next-state validation fails', async () => {
    const error = new ContentStateValidationError('content_publication_window_invalid');
    state.resolveNextContentStateMock.mockImplementationOnce(() => {
      throw error;
    });

    await expect(updateContent(createUpdateInput())).rejects.toBe(error);
    expect(state.updateContentRowMock).not.toHaveBeenCalled();
    expect(state.insertContentHistoryMock).not.toHaveBeenCalled();
  });

  it('preserves persisted author display fields on unrelated updates', async () => {
    const current = createContentRow({
      author_display_mode: 'organization',
      author_display_name: 'Historischer Organisationsname',
    });
    state.loadCurrentContentRowMock.mockResolvedValueOnce(current);

    await expect(updateContent(createUpdateInput({ title: 'Neuer Titel' }))).resolves.toBe(
      'content-1'
    );

    expect(state.resolveUpdateAuthorDisplayMock).not.toHaveBeenCalled();
    expect(state.resolveNextContentStateMock).toHaveBeenCalledWith(
      current,
      expect.not.objectContaining({
        authorDisplayMode: expect.any(String),
        authorDisplayName: expect.any(String),
      })
    );
  });

  it('resolves author display only when the request changes author display fields', async () => {
    const current = createContentRow();
    state.loadCurrentContentRowMock.mockResolvedValueOnce(current);
    state.resolveUpdateAuthorDisplayMock.mockResolvedValueOnce({
      authorDisplayMode: 'user',
      authorDisplayName: 'Autorin',
    });

    await expect(updateContent(createUpdateInput({ authorDisplayMode: 'user' }))).resolves.toBe(
      'content-1'
    );

    expect(state.resolveUpdateAuthorDisplayMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      current,
      expect.objectContaining({ authorDisplayMode: 'user' })
    );
    expect(state.resolveNextContentStateMock).toHaveBeenCalledWith(
      current,
      expect.objectContaining({
        authorDisplayMode: 'user',
        authorDisplayName: 'Autorin',
      })
    );
  });

  it('resolves author display when the request changes the organization', async () => {
    const current = createContentRow({
      organization_id: '11111111-1111-4111-8111-111111111111',
      author_display_mode: 'organization',
      author_display_name: 'Alte Organisation',
    });
    state.loadCurrentContentRowMock.mockResolvedValueOnce(current);
    state.resolveUpdateAuthorDisplayMock.mockResolvedValueOnce({
      authorDisplayMode: 'organization',
      authorDisplayName: 'Neue Organisation',
    });

    await expect(
      updateContent(
        createUpdateInput({
          organizationId: '22222222-2222-4222-8222-222222222222',
        })
      )
    ).resolves.toBe('content-1');

    expect(state.resolveUpdateAuthorDisplayMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      current,
      expect.objectContaining({ organizationId: '22222222-2222-4222-8222-222222222222' })
    );
    expect(state.resolveNextContentStateMock).toHaveBeenCalledWith(
      current,
      expect.objectContaining({
        authorDisplayMode: 'organization',
        authorDisplayName: 'Neue Organisation',
      })
    );
  });

  it.each([
    ['draft', 'published', ['status'], 'content.publish'],
    ['draft', 'archived', ['status'], 'content.archive'],
    ['archived', 'draft', ['status'], 'content.restore'],
    ['published', 'draft', ['status'], 'content.changeStatus'],
    ['draft', 'draft', ['payload'], 'content.updatePayload'],
    ['draft', 'draft', ['title'], 'content.updateMetadata'],
  ] as const)(
    'updates content with audit action %s -> %s as %s',
    async (previousStatus, nextStatus, changedFields, expectedAction) => {
      const current = createContentRow({ status: previousStatus });
      state.loadCurrentContentRowMock.mockResolvedValueOnce(current);
      state.resolveNextContentStateMock.mockReturnValueOnce({
        changedFields: [...changedFields],
        nextOrganizationId: null,
        nextOwnerUserId: null,
        nextOwnerOrganizationId: null,
        nextAuthorDisplayMode: 'organization',
        nextAuthorDisplayName: 'Autor',
        nextPayload: { body: 'Neu' },
        nextPublishedAt: nextStatus === 'published' ? '2026-05-03T08:00:00.000Z' : null,
        nextPublishFrom: null,
        nextPublishUntil: null,
        nextStatus,
        nextTitle: 'Neuer Titel',
        nextValidationState: 'valid',
      });
      state.resolveContentMutationMetadataMock.mockReturnValueOnce({
        activityEventType:
          previousStatus === nextStatus ? 'iam.content.updated' : 'iam.content.status_changed',
        historyAction: previousStatus === nextStatus ? 'updated' : 'status_changed',
        historySummary: previousStatus === nextStatus ? 'Inhalt aktualisiert' : 'Status geändert',
      });

      await expect(updateContent(createUpdateInput())).resolves.toBe('content-1');

      expect(state.updateContentRowMock).toHaveBeenCalledWith(
        { query: state.queryMock },
        expect.objectContaining({ contentId: 'content-1' }),
        expect.objectContaining({
          title: 'Neuer Titel',
          payloadJson: '{"body":"Neu"}',
          status: nextStatus,
          validationState: 'valid',
        })
      );
      expect(state.insertContentHistoryMock).toHaveBeenCalledWith(
        { query: state.queryMock },
        expect.objectContaining({
          previousStatus,
          nextStatus,
          changedFields,
        })
      );
      expect(state.emitContentUpdatedActivityMock).toHaveBeenCalledWith(
        { query: state.queryMock },
        expect.objectContaining({ contentId: 'content-1' }),
        current,
        expect.objectContaining({
          action: expectedAction,
          changedFields,
          nextStatus,
          nextTitle: 'Neuer Titel',
        })
      );
    }
  );

  it('returns undefined on delete when the current content row cannot be resolved', async () => {
    state.loadCurrentContentRowMock.mockResolvedValueOnce(undefined);

    await expect(deleteContent(createDeleteInput())).resolves.toBeUndefined();

    expect(state.emitContentDeletedActivityMock).not.toHaveBeenCalled();
    expect(state.queryMock).toHaveBeenCalledOnce();
    expect(state.queryMock).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [
      'instance-1',
      'content-1',
    ]);
  });

  it('transfers local ownership atomically without changing the visible author', async () => {
    const current = createContentRow({
      owner_user_id: '00000000-0000-4000-8000-000000000010',
      owner_organization_id: null,
      author_display_name: 'Unveränderte Autorenanzeige',
    });
    state.loadCurrentContentRowMock.mockResolvedValueOnce(current);
    state.queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ is_active: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      transferContentOwnership({
        instanceId: 'instance-1',
        actorAccountId: '00000000-0000-4000-8000-000000000001',
        actorDisplayName: 'Actor',
        requestId: 'request-1',
        traceId: 'trace-1',
        contentId: 'content-1',
        expectedSourcePrincipal: {
          type: 'account',
          id: '00000000-0000-4000-8000-000000000010',
        },
        targetPrincipal: {
          type: 'organization',
          id: '00000000-0000-4000-8000-000000000020',
        },
      })
    ).resolves.toEqual({
      contentId: 'content-1',
      sourcePrincipal: {
        type: 'account',
        id: '00000000-0000-4000-8000-000000000010',
      },
      targetPrincipal: {
        type: 'organization',
        id: '00000000-0000-4000-8000-000000000020',
      },
      authorDisplayName: 'Unveränderte Autorenanzeige',
    });

    expect(state.queryMock).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));',
      ['instance-1', 'content-1']
    );
    expect(state.queryMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('owner_user_id = $4::uuid'),
      [
        'instance-1',
        'content-1',
        '00000000-0000-4000-8000-000000000020',
        null,
        '00000000-0000-4000-8000-000000000020',
        '00000000-0000-4000-8000-000000000001',
      ]
    );
    expect(state.insertContentHistoryMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      expect.objectContaining({
        action: 'updated',
        summary: 'Inhaber übertragen',
        changedFields: ['ownerUserId', 'ownerOrganizationId', 'organizationId'],
        snapshot: { body: 'Text' },
      })
    );
    expect(state.emitContentOwnershipTransferredActivityMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      expect.objectContaining({
        contentId: 'content-1',
        sourcePrincipal: { type: 'account', id: '00000000-0000-4000-8000-000000000010' },
        targetPrincipal: {
          type: 'organization',
          id: '00000000-0000-4000-8000-000000000020',
        },
      })
    );
  });

  it.each([
    ['missing', undefined, { rows: [] }, 'content_not_found'],
    ['unchanged', createContentRow(), { rows: [] }, 'ownership_target_unchanged'],
    [
      'unknown target',
      createContentRow({ owner_user_id: null, owner_organization_id: null }),
      { rows: [] },
      'ownership_target_not_found',
    ],
    [
      'inactive target',
      createContentRow({ owner_user_id: null, owner_organization_id: null }),
      { rows: [{ is_active: false }] },
      'ownership_target_inactive',
    ],
  ])('rejects a %s ownership transfer', async (_name, current, targetResult, expectedCode) => {
    state.loadCurrentContentRowMock.mockResolvedValueOnce(current);
    state.queryMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce(targetResult);

    const transfer = transferContentOwnership({
      instanceId: 'instance-1',
      actorAccountId: '00000000-0000-4000-8000-000000000001',
      actorDisplayName: 'Actor',
      requestId: 'request-1',
      traceId: 'trace-1',
      contentId: 'content-1',
      expectedSourcePrincipal: resolveTestOwner(current),
      targetPrincipal: {
        type: 'account',
        id: '00000000-0000-4000-8000-000000000010',
      },
    });

    await expect(transfer).rejects.toEqual(
      expect.objectContaining<Partial<InstanceType<typeof ContentOwnershipTransferError>>>({
        code: expectedCode,
      })
    );
  });

  it('transfers ownership to an account when the current owner is an organization', async () => {
    state.loadCurrentContentRowMock.mockResolvedValueOnce(
      createContentRow({
        owner_user_id: null,
        owner_organization_id: '00000000-0000-4000-8000-000000000020',
      })
    );
    state.queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ is_active: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      transferContentOwnership({
        instanceId: 'instance-1',
        actorAccountId: '00000000-0000-4000-8000-000000000001',
        actorDisplayName: 'Actor',
        requestId: 'request-1',
        traceId: 'trace-1',
        contentId: 'content-1',
        expectedSourcePrincipal: {
          type: 'organization',
          id: '00000000-0000-4000-8000-000000000020',
        },
        targetPrincipal: {
          type: 'account',
          id: '00000000-0000-4000-8000-000000000030',
        },
      })
    ).resolves.toMatchObject({
      sourcePrincipal: {
        type: 'organization',
        id: '00000000-0000-4000-8000-000000000020',
      },
      targetPrincipal: { type: 'account', id: '00000000-0000-4000-8000-000000000030' },
    });
    expect(state.queryMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('owner_user_id = $4::uuid'),
      [
        'instance-1',
        'content-1',
        null,
        '00000000-0000-4000-8000-000000000030',
        null,
        '00000000-0000-4000-8000-000000000001',
      ]
    );
  });

  it('rejects a transfer when ownership changed after authorization', async () => {
    state.loadCurrentContentRowMock.mockResolvedValueOnce(
      createContentRow({
        owner_user_id: null,
        owner_organization_id: '00000000-0000-4000-8000-000000000099',
      })
    );
    state.queryMock.mockResolvedValueOnce({ rows: [] });

    await expect(
      transferContentOwnership({
        instanceId: 'instance-1',
        actorAccountId: '00000000-0000-4000-8000-000000000001',
        actorDisplayName: 'Actor',
        requestId: 'request-1',
        traceId: 'trace-1',
        contentId: 'content-1',
        expectedSourcePrincipal: {
          type: 'account',
          id: '00000000-0000-4000-8000-000000000010',
        },
        targetPrincipal: {
          type: 'organization',
          id: '00000000-0000-4000-8000-000000000020',
        },
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<InstanceType<typeof ContentOwnershipTransferError>>>({
        code: 'ownership_source_changed',
      })
    );
    expect(state.insertContentHistoryMock).not.toHaveBeenCalled();
    expect(state.emitContentOwnershipTransferredActivityMock).not.toHaveBeenCalled();
  });

  it('reloads the current row under lock before deleting content', async () => {
    const currentContent = createContentRow({ id: 'content-2', title: 'Zu loeschen' });
    state.loadCurrentContentRowMock.mockResolvedValueOnce(currentContent);

    await expect(
      deleteContent(createDeleteInput({ contentId: 'content-2', currentContent }))
    ).resolves.toBe('content-2');

    expect(state.loadCurrentContentRowMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: state.queryMock }),
      'instance-1',
      'content-2'
    );
    expect(state.emitContentDeletedActivityMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      expect.objectContaining({ contentId: 'content-2' }),
      currentContent
    );
    expect(state.queryMock).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM iam.contents'),
      ['instance-1', 'content-2']
    );
  });

  it.each(['update', 'delete'] as const)(
    'rejects a stale authorized %s after ownership changed',
    async (operation) => {
      state.loadCurrentContentRowMock.mockResolvedValueOnce(
        createContentRow({
          owner_user_id: null,
          owner_organization_id: '00000000-0000-4000-8000-000000000099',
        })
      );
      const expectedSourcePrincipal = {
        type: 'account' as const,
        id: '00000000-0000-4000-8000-000000000010',
      };

      const mutation =
        operation === 'update'
          ? updateContent(createUpdateInput({ expectedSourcePrincipal }))
          : deleteContent(createDeleteInput({ expectedSourcePrincipal }));

      await expect(mutation).rejects.toEqual(
        expect.objectContaining<Partial<InstanceType<typeof ContentOwnershipTransferError>>>({
          code: 'ownership_source_changed',
        })
      );
      expect(state.updateContentRowMock).not.toHaveBeenCalled();
      expect(state.emitContentDeletedActivityMock).not.toHaveBeenCalled();
    }
  );
});
