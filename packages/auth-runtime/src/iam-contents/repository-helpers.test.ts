import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentStateValidationError } from './repository-state-validation.js';
import type { ContentRow, CreateContentInput, DeleteContentInput, UpdateContentInput } from './repository-types.js';

const state = vi.hoisted(() => ({
  emitActivityLogMock: vi.fn(),
  resolveDomainCapabilityMock: vi.fn(),
}));

vi.mock('@sva/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/core')>();

  return {
    ...actual,
    resolveIamContentDomainCapabilityForPrimitiveAction: (...args: unknown[]) =>
      state.resolveDomainCapabilityMock(...args),
  };
});

vi.mock('../iam-account-management/shared.js', () => ({
  emitActivityLog: (...args: unknown[]) => state.emitActivityLogMock(...args),
  withInstanceScopedDb: vi.fn(),
}));

const {
  insertContentHistory,
  loadCurrentContentRow,
  resolveContentMutationMetadata,
} = await import('./repository-shared.js');
const {
  emitContentCreatedActivity,
  emitContentDeletedActivity,
  emitContentUpdatedActivity,
  insertContentRow,
  resolveCreateAuthorDisplay,
  resolveUpdateAuthorDisplay,
  updateContentRevisionRefs,
  updateContentRow,
  validatePublicationWindow,
} = await import('./repository-write-helpers.js');

const createClient = () => ({
  query: vi.fn(),
});

const createContentRow = (overrides: Partial<ContentRow> = {}): ContentRow => ({
  id: 'content-1',
  content_type: 'news.article',
  instance_id: 'instance-1',
  organization_id: null,
  owner_subject_id: null,
  owner_user_id: null,
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

describe('iam content repository helpers', () => {
  beforeEach(() => {
    state.emitActivityLogMock.mockReset();
    state.resolveDomainCapabilityMock.mockReset();
    state.emitActivityLogMock.mockResolvedValue(undefined);
    state.resolveDomainCapabilityMock.mockReturnValue('content.manage');
  });

  it('loads the current content row and returns the first result', async () => {
    const client = createClient();
    const row = createContentRow();
    client.query.mockResolvedValue({ rows: [row, createContentRow({ id: 'content-2' })] });

    await expect(loadCurrentContentRow(client, 'instance-1', 'content-1')).resolves.toBe(row);

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('WHERE content.instance_id = $1'), [
      'instance-1',
      'content-1',
    ]);
  });

  it('creates content history entries and throws when the database does not return an id', async () => {
    const client = createClient();
    client.query.mockResolvedValueOnce({ rows: [{ id: 'history-2' }] });

    await expect(
      insertContentHistory(client, {
        instanceId: 'instance-1',
        contentId: 'content-1',
        actorAccountId: '00000000-0000-0000-0000-000000000001',
        actorDisplayName: 'Autor',
        action: 'updated',
        changedFields: ['title'],
        previousStatus: 'draft',
        nextStatus: 'draft',
        summary: 'Inhalt aktualisiert',
        snapshot: { body: 'Neu' },
      })
    ).resolves.toBe('history-2');

    client.query.mockResolvedValueOnce({ rows: [{}] });

    await expect(
      insertContentHistory(client, {
        instanceId: 'instance-1',
        contentId: 'content-1',
        actorAccountId: '00000000-0000-0000-0000-000000000001',
        actorDisplayName: 'Autor',
        action: 'updated',
        changedFields: ['title'],
        snapshot: { body: 'Neu' },
      })
    ).rejects.toThrow('content_history_create_failed');
  });

  it('resolves update vs status-change mutation metadata', () => {
    expect(resolveContentMutationMetadata('draft', 'draft')).toEqual({
      activityEventType: 'iam.content.updated',
      historyAction: 'updated',
      historySummary: 'Inhalt aktualisiert',
    });

    expect(resolveContentMutationMetadata('draft', 'published')).toEqual({
      activityEventType: 'iam.content.status_changed',
      historyAction: 'status_changed',
      historySummary: 'Status geändert',
    });
  });

  it('validates publication windows before writes', () => {
    expect(() =>
      validatePublicationWindow({
        publishFrom: '2026-05-01T08:00:00.000Z',
        publishUntil: '2026-05-02T08:00:00.000Z',
      })
    ).not.toThrow();

    expect(() =>
      validatePublicationWindow({
        publishFrom: '2026-05-02T08:00:00.000Z',
        publishUntil: '2026-05-01T08:00:00.000Z',
      })
    ).toThrow(new ContentStateValidationError('content_publication_window_invalid'));
  });

  it('inserts content rows and throws when the database does not return an id', async () => {
    const client = createClient();
    client.query.mockResolvedValueOnce({ rows: [{ id: 'content-2' }] });

    await expect(insertContentRow(client, createCreateInput())).resolves.toBe('content-2');

    client.query.mockResolvedValueOnce({ rows: [{}] });

    await expect(insertContentRow(client, createCreateInput())).rejects.toThrow('content_create_failed');
  });

  it('uses the active organization display name as create author when available', async () => {
    const client = createClient();
    client.query
      .mockResolvedValueOnce({ rows: [{ display_name: 'Stadt Musterhausen' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'content-2' }] });

    await expect(
      insertContentRow(
        client,
        createCreateInput({
          organizationId: '00000000-0000-0000-0000-000000000002',
        })
      )
    ).resolves.toBe('content-2');

    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FROM iam.organizations'),
      ['instance-1', '00000000-0000-0000-0000-000000000002']
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO iam.contents'),
      expect.arrayContaining(['Stadt Musterhausen'])
    );
  });

  it('enforces organization author policy for create author display mode', async () => {
    const client = createClient();
    client.query.mockResolvedValueOnce({
      rows: [{ display_name: 'Stadt Musterhausen', content_author_policy: 'org_only' }],
    });

    await expect(
      resolveCreateAuthorDisplay(
        client,
        createCreateInput({
          organizationId: '00000000-0000-0000-0000-000000000002',
          authorDisplayMode: 'user',
        })
      )
    ).rejects.toThrow(new ContentStateValidationError('content_author_display_mode_not_allowed'));

    client.query.mockResolvedValueOnce({
      rows: [{ display_name: 'Stadt Musterhausen', content_author_policy: 'org_or_personal' }],
    });
    await expect(
      resolveCreateAuthorDisplay(
        client,
        createCreateInput({
          organizationId: '00000000-0000-0000-0000-000000000002',
          authorDisplayMode: 'user',
        })
      )
    ).resolves.toEqual({
      authorDisplayMode: 'user',
      authorDisplayName: 'Autor',
    });
  });

  it('derives update author display snapshots from the selected mode', async () => {
    const client = createClient();
    client.query.mockResolvedValueOnce({
      rows: [{ display_name: 'Stadt Musterhausen', content_author_policy: 'org_or_personal' }],
    });

    await expect(
      resolveUpdateAuthorDisplay(
        client,
        createContentRow({ organization_id: '00000000-0000-0000-0000-000000000002' }),
        createUpdateInput({ authorDisplayMode: 'organization' })
      )
    ).resolves.toEqual({
      authorDisplayMode: 'organization',
      authorDisplayName: 'Stadt Musterhausen',
    });

    client.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      resolveUpdateAuthorDisplay(
        client,
        createContentRow({ organization_id: null, author_display_mode: 'user' }),
        createUpdateInput({ authorDisplayMode: 'organization' })
      )
    ).rejects.toThrow(new ContentStateValidationError('content_author_organization_not_found'));
  });

  it('updates content rows and revision references with normalized values', async () => {
    const client = createClient();
    client.query.mockResolvedValue({ rows: [] });

    await updateContentRow(client, createUpdateInput(), {
      organizationId: '00000000-0000-0000-0000-000000000002',
      ownerUserId: '00000000-0000-0000-0000-000000000001',
      ownerOrganizationId: '00000000-0000-0000-0000-000000000002',
      authorDisplayMode: 'organization',
      authorDisplayName: 'Stadt Musterhausen',
      title: 'Neuer Titel',
      payloadJson: '{"body":"Neu"}',
      status: 'published',
      validationState: 'valid',
      publishedAt: '2026-05-03T08:00:00.000Z',
      publishFrom: '2026-05-02T08:00:00.000Z',
      publishUntil: '2026-05-04T08:00:00.000Z',
    });
    await updateContentRevisionRefs(client, 'instance-1', 'content-1', 'history-2');

    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE iam.contents'),
      expect.arrayContaining([
        'instance-1',
        'content-1',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'Stadt Musterhausen',
        'Neuer Titel',
        '{"body":"Neu"}',
        'published',
        'valid',
        '2026-05-03T08:00:00.000Z',
        '2026-05-02T08:00:00.000Z',
        '2026-05-04T08:00:00.000Z',
        '00000000-0000-0000-0000-000000000001',
      ])
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SET history_ref = $3, current_revision_ref = $3'),
      ['instance-1', 'content-1', 'history-2']
    );
  });

  it('emits created and deleted audit activities with content action metadata', async () => {
    const client = createClient();

    await emitContentCreatedActivity(client, createCreateInput({ status: 'published' }), 'content-1');
    await emitContentDeletedActivity(client, createDeleteInput(), createContentRow());

    expect(state.emitActivityLogMock).toHaveBeenNthCalledWith(
      1,
      client,
      expect.objectContaining({
        eventType: 'iam.content.created',
        payload: expect.objectContaining({
          action: 'content.create',
          primitive_action: 'content.create',
          domain_capability: 'content.manage',
          payload_change: 'payload_created',
          status: 'published',
        }),
      })
    );
    expect(state.emitActivityLogMock).toHaveBeenNthCalledWith(
      2,
      client,
      expect.objectContaining({
        eventType: 'iam.content.deleted',
        payload: expect.objectContaining({
          action: 'content.delete',
          primitive_action: 'content.delete',
          domain_capability: 'content.manage',
          title: 'Titel',
        }),
      })
    );
  });

  it('emits updated audit activities for payload and metadata changes', async () => {
    const client = createClient();
    state.resolveDomainCapabilityMock.mockReturnValueOnce(undefined).mockReturnValueOnce('content.manage');

    await emitContentUpdatedActivity(client, createUpdateInput(), createContentRow(), {
      eventType: 'iam.content.updated',
      action: 'content.updateMetadata',
      changedFields: ['title', 'ownerUserId', 'ownerOrganizationId', 'authorDisplayName'],
      nextStatus: 'draft',
      nextTitle: 'Titel',
      nextOwnerUserId: '00000000-0000-0000-0000-000000000002',
      nextOwnerOrganizationId: '00000000-0000-0000-0000-000000000003',
      nextAuthorDisplayName: 'Stadt Musterhausen',
    });
    await emitContentUpdatedActivity(client, createUpdateInput(), createContentRow(), {
      eventType: 'iam.content.status_changed',
      action: 'content.updatePayload',
      changedFields: ['payload'],
      nextStatus: 'draft',
      nextTitle: 'Titel',
      nextOwnerUserId: null,
      nextOwnerOrganizationId: null,
      nextAuthorDisplayName: 'Autor',
    });

    expect(state.emitActivityLogMock).toHaveBeenNthCalledWith(
      1,
      client,
      expect.objectContaining({
        eventType: 'iam.content.updated',
        payload: expect.objectContaining({
          action: 'content.updateMetadata',
          domain_capability: null,
          payload_change: 'payload_unchanged',
          previous_status: 'draft',
          next_status: 'draft',
          field_changes: {
            ownerUserId: {
              previous: null,
              next: '00000000-0000-0000-0000-000000000002',
            },
            ownerOrganizationId: {
              previous: null,
              next: '00000000-0000-0000-0000-000000000003',
            },
            authorDisplayName: {
              previous: 'Autor',
              next: 'Stadt Musterhausen',
            },
          },
        }),
      })
    );
    expect(state.emitActivityLogMock).toHaveBeenNthCalledWith(
      2,
      client,
      expect.objectContaining({
        eventType: 'iam.content.status_changed',
        payload: expect.objectContaining({
          action: 'content.updatePayload',
          domain_capability: 'content.manage',
          payload_change: 'payload_updated',
        }),
      })
    );
  });
});
