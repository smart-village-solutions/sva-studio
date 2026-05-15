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
  insertContentHistoryMock: vi.fn(),
  insertContentRowMock: vi.fn(),
  loadCurrentContentRowMock: vi.fn(),
  mapContentHistoryItemMock: vi.fn(),
  mapContentListItemMock: vi.fn(),
  queryMock: vi.fn(),
  resolveContentMutationMetadataMock: vi.fn(),
  resolveNextContentStateMock: vi.fn(),
  updateContentRevisionRefsMock: vi.fn(),
  updateContentRowMock: vi.fn(),
  validatePublicationWindowMock: vi.fn(),
  withInstanceScopedDbMock: vi.fn(),
}));

vi.mock('../iam-account-management/shared.js', () => ({
  withInstanceScopedDb: (...args: unknown[]) => state.withInstanceScopedDbMock(...args),
}));

vi.mock('./repository-shared.js', () => ({
  insertContentHistory: (...args: unknown[]) => state.insertContentHistoryMock(...args),
  loadCurrentContentRow: (...args: unknown[]) => state.loadCurrentContentRowMock(...args),
  resolveContentMutationMetadata: (...args: unknown[]) => state.resolveContentMutationMetadataMock(...args),
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
  insertContentRow: (...args: unknown[]) => state.insertContentRowMock(...args),
  updateContentRevisionRefs: (...args: unknown[]) => state.updateContentRevisionRefsMock(...args),
  updateContentRow: (...args: unknown[]) => state.updateContentRowMock(...args),
  validatePublicationWindow: (...args: unknown[]) => state.validatePublicationWindowMock(...args),
}));

const {
  createContent,
  deleteContent,
  loadContentById,
  loadContentDetail,
  loadContentHistory,
  loadContentListItems,
  loadContentRowById,
  updateContent,
} = await import('./repository.js');

const createContentRow = (overrides: Partial<ContentRow> = {}): ContentRow => ({
  id: 'content-1',
  content_type: 'news.article',
  instance_id: 'instance-1',
  organization_id: null,
  owner_subject_id: null,
  title: 'Titel',
  published_at: null,
  publish_from: null,
  publish_until: null,
  created_at: '2026-05-01T08:00:00.000Z',
  created_by: 'account-1',
  updated_at: '2026-05-01T08:00:00.000Z',
  updated_by: 'account-1',
  author_display_name: 'Autor',
  payload_json: { body: 'Text' },
  status: 'draft',
  validation_state: 'valid',
  history_ref: 'history-1',
  current_revision_ref: 'history-1',
  last_audit_event_ref: null,
  ...overrides,
});

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
  beforeEach(() => {
    for (const mock of Object.values(state)) {
      mock.mockReset();
    }

    state.withInstanceScopedDbMock.mockImplementation(async (_instanceId: string, work: (client: object) => Promise<unknown>) =>
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
    state.updateContentRevisionRefsMock.mockResolvedValue(undefined);
    state.emitContentCreatedActivityMock.mockResolvedValue(undefined);
    state.emitContentDeletedActivityMock.mockResolvedValue(undefined);
    state.emitContentUpdatedActivityMock.mockResolvedValue(undefined);
    state.updateContentRowMock.mockResolvedValue(undefined);
    state.resolveContentMutationMetadataMock.mockReturnValue({
      activityEventType: 'iam.content.updated',
      historyAction: 'updated',
      historySummary: 'Inhalt aktualisiert',
    });
    state.resolveNextContentStateMock.mockReturnValue({
      changedFields: ['title'],
      nextOrganizationId: null,
      nextOwnerSubjectId: null,
      nextPayload: { body: 'Neu' },
      nextPublishedAt: null,
      nextPublishFrom: null,
      nextPublishUntil: null,
      nextStatus: 'draft',
      nextTitle: 'Neuer Titel',
      nextValidationState: 'valid',
    });
  });

  it('loads content list items and maps database rows', async () => {
    const firstRow = createContentRow();
    const secondRow = createContentRow({ id: 'content-2', title: 'Zweiter Titel' });
    state.queryMock.mockResolvedValueOnce({ rows: [firstRow, secondRow] });

    await expect(loadContentListItems('instance-1')).resolves.toEqual([
      { id: 'content-1', title: 'Titel', status: 'draft' },
      { id: 'content-2', title: 'Zweiter Titel', status: 'draft' },
    ]);

    expect(state.queryMock).toHaveBeenCalledWith(expect.stringContaining('ORDER BY content.updated_at DESC'), [
      'instance-1',
    ]);
  });

  it('loads content rows by id and maps them for public reads', async () => {
    state.loadCurrentContentRowMock.mockResolvedValueOnce(createContentRow());

    await expect(loadContentRowById('instance-1', 'content-1')).resolves.toEqual(createContentRow());
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

    state.loadCurrentContentRowMock.mockResolvedValueOnce(createContentRow({ id: 'content-2', title: 'Detail' }));
    state.queryMock.mockResolvedValueOnce({ rows: [createHistoryRow({ id: 'history-2' })] });

    await expect(loadContentDetail('instance-1', 'content-2')).resolves.toEqual({
      id: 'content-2',
      title: 'Detail',
      status: 'draft',
      history: [{ id: 'history-2', action: 'updated', summary: 'Inhalt aktualisiert' }],
    });
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
    expect(state.emitContentCreatedActivityMock).toHaveBeenCalledWith({ query: state.queryMock }, input, 'content-1');
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

  it('stops update operations when next-state validation fails', async () => {
    const error = new ContentStateValidationError('content_publication_window_invalid');
    state.resolveNextContentStateMock.mockImplementationOnce(() => {
      throw error;
    });

    await expect(updateContent(createUpdateInput())).rejects.toBe(error);
    expect(state.updateContentRowMock).not.toHaveBeenCalled();
    expect(state.insertContentHistoryMock).not.toHaveBeenCalled();
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
        nextOwnerSubjectId: null,
        nextPayload: { body: 'Neu' },
        nextPublishedAt: nextStatus === 'published' ? '2026-05-03T08:00:00.000Z' : null,
        nextPublishFrom: null,
        nextPublishUntil: null,
        nextStatus,
        nextTitle: 'Neuer Titel',
        nextValidationState: 'valid',
      });
      state.resolveContentMutationMetadataMock.mockReturnValueOnce({
        activityEventType: previousStatus === nextStatus ? 'iam.content.updated' : 'iam.content.status_changed',
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
    expect(state.queryMock).not.toHaveBeenCalled();
  });

  it('deletes content with a provided current row without reloading it', async () => {
    const currentContent = createContentRow({ id: 'content-2', title: 'Zu loeschen' });

    await expect(deleteContent(createDeleteInput({ contentId: 'content-2', currentContent }))).resolves.toBe('content-2');

    expect(state.loadCurrentContentRowMock).not.toHaveBeenCalled();
    expect(state.emitContentDeletedActivityMock).toHaveBeenCalledWith(
      { query: state.queryMock },
      expect.objectContaining({ contentId: 'content-2' }),
      currentContent
    );
    expect(state.queryMock).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM iam.contents'), [
      'instance-1',
      'content-2',
    ]);
  });
});
