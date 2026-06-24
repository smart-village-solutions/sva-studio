import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useContentDetail, useContents, useCreateContent } from './use-contents';

const contentListQuery = {
  page: 1,
  pageSize: 25,
  sortBy: 'updatedAt',
  sortDirection: 'desc',
  visibleTypes: ['news.article', 'events.event-record', 'poi.point-of-interest'],
} as const;

const listContentsMock = vi.fn();
const createContentMock = vi.fn();
const refreshProjectedContentsMock = vi.fn();
const getContentMock = vi.fn();
const getContentHistoryMock = vi.fn();
const updateContentMock = vi.fn();
const deleteContentMock = vi.fn();
const asIamErrorMock = vi.fn();
const logBrowserOperationStartMock = vi.fn();
const logBrowserOperationSuccessMock = vi.fn();
const logBrowserOperationFailureMock = vi.fn();
const authMockValue = {
  user: {
    id: 'editor-1',
    name: 'Editor',
    roles: ['editor'],
  },
  isAuthenticated: true,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  logout: vi.fn(),
  invalidatePermissions: vi.fn(),
  updateProfile: vi.fn(),
};

vi.mock('../lib/iam-api', () => ({
  IamHttpError: class IamHttpError extends Error {
    status: number;
    code: string;

    constructor(input: { status: number; code: string; message: string }) {
      super(input.message);
      this.status = input.status;
      this.code = input.code;
    }
  },
  listContents: (...args: unknown[]) => listContentsMock(...args),
  createContent: (...args: unknown[]) => createContentMock(...args),
  refreshProjectedContents: (...args: unknown[]) => refreshProjectedContentsMock(...args),
  getContent: (...args: unknown[]) => getContentMock(...args),
  getContentHistory: (...args: unknown[]) => getContentHistoryMock(...args),
  updateContent: (...args: unknown[]) => updateContentMock(...args),
  deleteContent: (...args: unknown[]) => deleteContentMock(...args),
  asIamError: (...args: unknown[]) => asIamErrorMock(...args),
}));

vi.mock('../lib/browser-operation-logging', () => ({
  createOperationLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  logBrowserOperationStart: (...args: unknown[]) => logBrowserOperationStartMock(...args),
  logBrowserOperationSuccess: (...args: unknown[]) => logBrowserOperationSuccessMock(...args),
  logBrowserOperationFailure: (...args: unknown[]) => logBrowserOperationFailureMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('useContents', () => {
  beforeEach(() => {
    listContentsMock.mockReset();
    createContentMock.mockReset();
    refreshProjectedContentsMock.mockReset();
    getContentMock.mockReset();
    getContentHistoryMock.mockReset();
    updateContentMock.mockReset();
    deleteContentMock.mockReset();
    asIamErrorMock.mockReset();
    logBrowserOperationStartMock.mockReset();
    logBrowserOperationSuccessMock.mockReset();
    logBrowserOperationFailureMock.mockReset();
    authMockValue.invalidatePermissions.mockReset();
  });

  it('loads content list items', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    listContentsMock.mockResolvedValue({
      data: [
        {
          id: 'content-1',
          contentType: 'generic',
          title: 'Startseite',
          createdAt: '2026-03-21T10:00:00.000Z',
          updatedAt: '2026-03-21T11:00:00.000Z',
          author: 'Editor',
          payload: { blocks: [] },
          status: 'draft',
        },
      ],
      pagination: { page: 1, pageSize: 1, total: 1 },
      metadata: {
        mainserverSyncStates: [
          {
            contentType: 'news.article',
            lastSucceededAt: '2026-06-24T08:00:00.000Z',
            isStale: false,
            isSyncRunning: false,
            hasSnapshot: true,
          },
        ],
        hasStaleMainserverContent: false,
        hasBlockingSyncGap: false,
        hasRunningMainserverSync: false,
      },
    });

    const { result } = renderHook(() => useContents(contentListQuery));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.contents).toHaveLength(1);
      expect(result.current.metadata?.mainserverSyncStates).toHaveLength(1);
    });
  });

  it('refreshes the projected mainserver snapshot and refetches the current list', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    listContentsMock
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 25, total: 0 },
        metadata: {
          mainserverSyncStates: [
            {
              contentType: 'news.article',
              lastSucceededAt: '2026-06-24T08:00:00.000Z',
              isStale: true,
              isSyncRunning: false,
              hasSnapshot: true,
            },
          ],
          hasStaleMainserverContent: true,
          hasBlockingSyncGap: false,
          hasRunningMainserverSync: false,
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'content-1',
            contentType: 'news.article',
            title: 'Neu',
            createdAt: '2026-03-21T10:00:00.000Z',
            updatedAt: '2026-03-21T11:00:00.000Z',
            author: 'Editor',
            payload: { blocks: [] },
            status: 'draft',
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1 },
        metadata: {
          mainserverSyncStates: [
            {
              contentType: 'news.article',
              lastSucceededAt: '2026-06-24T08:05:00.000Z',
              isStale: false,
              isSyncRunning: false,
              hasSnapshot: true,
            },
          ],
          hasStaleMainserverContent: false,
          hasBlockingSyncGap: false,
          hasRunningMainserverSync: false,
        },
      });
    refreshProjectedContentsMock.mockResolvedValue({
      data: {
        status: 'completed',
        syncStates: [],
      },
    });

    const { result } = renderHook(() => useContents(contentListQuery));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.metadata?.hasStaleMainserverContent).toBe(true);
    });

    await act(async () => {
      await result.current.refreshProjection({ force: true });
    });

    expect(refreshProjectedContentsMock).toHaveBeenCalledWith({
      visibleTypes: ['news.article'],
      force: true,
    });
    await waitFor(() => {
      expect(result.current.contents).toHaveLength(1);
      expect(result.current.metadata?.hasStaleMainserverContent).toBe(false);
    });
  });

  it('does not start the content list request while disabled', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);

    const { result } = renderHook(() => useContents(contentListQuery, { enabled: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.contents).toEqual([]);
    });

    expect(listContentsMock).not.toHaveBeenCalled();
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])('invalidates permissions when the initial content list fetch fails with a protected error (status $status, code $code)', async (protectedError) => {
    asIamErrorMock.mockReturnValue(protectedError);
    listContentsMock.mockRejectedValueOnce(new Error('protected-list'));

    const { result } = renderHook(() => useContents(contentListQuery));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(protectedError);
      expect(result.current.contents).toEqual([]);
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
  });

  it('keeps the last successful items when a later refetch times out', async () => {
    const timeoutError = { status: 0, code: 'timeout', message: 'request_timeout' };
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    listContentsMock
      .mockResolvedValueOnce({
        data: [
          {
            id: 'content-1',
            contentType: 'generic',
            title: 'Startseite',
            createdAt: '2026-03-21T10:00:00.000Z',
            updatedAt: '2026-03-21T11:00:00.000Z',
            author: 'Editor',
            payload: { blocks: [] },
            status: 'draft',
          },
        ],
        pagination: { page: 1, pageSize: 1, total: 1 },
      })
      .mockRejectedValueOnce(new Error('timed-out-refetch'));

    const { result } = renderHook(() => useContents(contentListQuery));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.contents).toHaveLength(1);
    });

    asIamErrorMock.mockReturnValue(timeoutError);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(timeoutError);
      expect(result.current.contents).toHaveLength(1);
      expect(result.current.contents[0]?.id).toBe('content-1');
    });
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])('invalidates permissions when a content list refetch fails with a protected error (status $status, code $code)', async (protectedError) => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    listContentsMock
      .mockResolvedValueOnce({
        data: [
          {
            id: 'content-1',
            contentType: 'generic',
            title: 'Startseite',
            createdAt: '2026-03-21T10:00:00.000Z',
            updatedAt: '2026-03-21T11:00:00.000Z',
            author: 'Editor',
            payload: { blocks: [] },
            status: 'draft',
          },
        ],
        pagination: { page: 1, pageSize: 1, total: 1 },
      })
      .mockRejectedValueOnce(new Error('protected-refetch'));

    const { result } = renderHook(() => useContents(contentListQuery));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.contents).toHaveLength(1);
    });

    asIamErrorMock.mockReturnValue(protectedError);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(protectedError);
      expect(result.current.contents).toHaveLength(1);
      expect(result.current.contents[0]?.id).toBe('content-1');
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
  });

  it('runs bulk archive and delete actions with safe audit metadata', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    listContentsMock.mockResolvedValue({
      data: [
        {
          id: 'content-1',
          contentType: 'generic',
          title: 'Startseite',
          createdAt: '2026-03-21T10:00:00.000Z',
          updatedAt: '2026-03-21T11:00:00.000Z',
          author: 'Editor',
          payload: { blocks: [] },
          status: 'draft',
        },
        {
          id: 'content-2',
          contentType: 'generic',
          title: 'Archiv',
          createdAt: '2026-03-21T10:00:00.000Z',
          updatedAt: '2026-03-21T11:00:00.000Z',
          author: 'Editor',
          payload: { blocks: [] },
          status: 'archived',
        },
      ],
      pagination: { page: 1, pageSize: 2, total: 2 },
    });
    updateContentMock.mockResolvedValue({ data: { id: 'content-1' } });
    deleteContentMock.mockResolvedValue({ data: { id: 'content-1' } });

    const { result } = renderHook(() => useContents(contentListQuery));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      expect(
        await result.current.archiveContents({
          actionId: 'content.archive',
          contentIds: ['content-1', 'content-2'],
          matchingCount: 2,
          page: 1,
          pageSize: 2,
          selectionMode: 'currentPage',
          sort: { field: 'updatedAt', direction: 'desc' },
          statusFilter: 'all',
        })
      ).toEqual({
        acceptedCount: 1,
        failedCount: 0,
        skippedCount: 1,
      });
    });

    expect(updateContentMock).toHaveBeenCalledWith('content-1', { status: 'archived' });
    expect(updateContentMock).toHaveBeenCalledTimes(1);
    expect(logBrowserOperationSuccessMock).toHaveBeenCalledWith(
      expect.anything(),
      'content_bulk_action_succeeded',
      expect.objectContaining({
        action_id: 'content.archive',
        selection_mode: 'currentPage',
        matching_count: 2,
        accepted_count: 1,
        skipped_count: 1,
      }),
      'info'
    );

    await act(async () => {
      expect(
        await result.current.deleteContents({
          actionId: 'content.delete',
          contentIds: ['content-1'],
          matchingCount: 1,
          page: 1,
          pageSize: 2,
          selectionMode: 'explicitIds',
          sort: { field: 'updatedAt', direction: 'desc' },
          statusFilter: 'draft',
        })
      ).toEqual({
        acceptedCount: 1,
        failedCount: 0,
        skippedCount: 0,
      });
    });

    expect(deleteContentMock).toHaveBeenCalledWith('content-1');
  });

  it('creates content and stores create errors', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    createContentMock.mockResolvedValueOnce({ data: { id: 'content-2' } });

    const { result } = renderHook(() => useCreateContent());

    await act(async () => {
      const created = await result.current.createContent({
        contentType: 'generic',
        title: 'Landing Page',
        payload: { hero: 'Hello' },
        status: 'draft',
      });
      expect(created).toBe(true);
    });

    const conflictError = { status: 409, code: 'conflict', message: 'Conflict' };
    asIamErrorMock.mockReturnValue(conflictError);
    createContentMock.mockRejectedValueOnce(new Error('conflict'));

    await act(async () => {
      const created = await result.current.createContent({
        contentType: 'generic',
        title: 'Landing Page',
        payload: { hero: 'Hello' },
        status: 'draft',
      });
      expect(created).toBe(false);
    });

    expect(result.current.mutationError).toBe(conflictError);
    act(() => {
      result.current.clearMutationError();
    });
    expect(result.current.mutationError).toBeNull();
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])(
    'invalidates permissions on protected create errors (status $status, code $code)',
    async (protectedError) => {
      asIamErrorMock.mockReturnValue(protectedError);
      createContentMock.mockRejectedValueOnce(new Error('protected-create'));

      const { result: createResult } = renderHook(() => useCreateContent());

      await act(async () => {
        const created = await createResult.current.createContent({
          contentType: 'generic',
          title: 'Landing Page',
          payload: { hero: 'Hello' },
          status: 'draft',
        });
        expect(created).toBe(false);
      });

      expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
    }
  );

  it('keeps content detail idle when no content id is provided', async () => {
    const { result } = renderHook(() => useContentDetail(null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.content).toBeNull();
      expect(result.current.history).toEqual([]);
    });
  });

  it('loads content detail with history and updates content', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    getContentMock.mockResolvedValue({
      data: {
        id: 'content-1',
        contentType: 'generic',
        title: 'Startseite',
        createdAt: '2026-03-21T10:00:00.000Z',
        updatedAt: '2026-03-21T11:00:00.000Z',
        author: 'Editor',
        payload: { blocks: [] },
        status: 'draft',
        history: [],
      },
    });
    getContentHistoryMock.mockResolvedValue({
      data: [
        {
          id: 'history-1',
          contentId: 'content-1',
          action: 'created',
          actor: 'Editor',
          changedFields: ['title'],
          createdAt: '2026-03-21T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 1, total: 1 },
    });
    updateContentMock.mockResolvedValue({ data: { id: 'content-1' } });

    const { result } = renderHook(() => useContentDetail('content-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.content?.title).toBe('Startseite');
      expect(result.current.history).toHaveLength(1);
    });

    await act(async () => {
      const updated = await result.current.updateContent({
        title: 'Neue Startseite',
      });
      expect(updated).toBe(true);
    });

    expect(updateContentMock).toHaveBeenCalledWith('content-1', {
      title: 'Neue Startseite',
    });
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])('stores detail errors and invalidates permissions on protected detail-load failures (status $status, code $code)', async (protectedError) => {
    asIamErrorMock.mockReturnValue(protectedError);
    getContentMock.mockRejectedValueOnce(new Error('protected-detail'));
    getContentHistoryMock.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 0, total: 0 } });

    const { result } = renderHook(() => useContentDetail('content-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(protectedError);
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])('stores update errors and invalidates permissions on protected update failures (status $status, code $code)', async (protectedError) => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    getContentMock.mockResolvedValue({
      data: {
        id: 'content-1',
        contentType: 'generic',
        title: 'Startseite',
        createdAt: '2026-03-21T10:00:00.000Z',
        updatedAt: '2026-03-21T11:00:00.000Z',
        author: 'Editor',
        payload: { blocks: [] },
        status: 'draft',
        history: [],
      },
    });
    getContentHistoryMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 0, total: 0 },
    });

    const { result } = renderHook(() => useContentDetail('content-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.content?.title).toBe('Startseite');
    });

    asIamErrorMock.mockReturnValue(protectedError);
    updateContentMock.mockRejectedValueOnce(new Error('protected-update'));

    await act(async () => {
      const updated = await result.current.updateContent({ title: 'Neu' });
      expect(updated).toBe(false);
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
    expect(result.current.mutationError).toBe(protectedError);
  });

  it('clears stored mutation errors for create mutations', async () => {
    const createConflict = { status: 409, code: 'conflict', message: 'Conflict' };
    asIamErrorMock.mockReturnValue(createConflict);
    createContentMock.mockRejectedValueOnce(new Error('conflict'));

    const { result: createResult } = renderHook(() => useCreateContent());

    await act(async () => {
      expect(
        await createResult.current.createContent({
          contentType: 'generic',
          title: 'Landing Page',
          payload: { hero: 'Hello' },
          status: 'draft',
        })
      ).toBe(false);
    });

    expect(createResult.current.mutationError).toBe(createConflict);

    act(() => {
      createResult.current.clearMutationError();
    });

    expect(createResult.current.mutationError).toBeNull();
  });

  it('returns false for detail mutations without an id and clears stored mutation errors', async () => {
    const { result: detailResult } = renderHook(() => useContentDetail(null));

    await waitFor(() => {
      expect(detailResult.current.isLoading).toBe(false);
    });

    await act(async () => {
      expect(await detailResult.current.updateContent({ title: 'Neu' })).toBe(false);
    });

    act(() => {
      detailResult.current.clearMutationError();
    });

    expect(detailResult.current.mutationError).toBeNull();
  });

  it('stores non-403 detail and update errors without invalidating permissions', async () => {
    const genericError = { status: 500, code: 'database_unavailable', message: 'db down' };
    asIamErrorMock.mockReturnValue(genericError);
    getContentMock.mockRejectedValueOnce(new Error('db down'));
    getContentHistoryMock.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 0, total: 0 } });

    const { result } = renderHook(() => useContentDetail('content-1'));

    await waitFor(() => {
      expect(result.current.error).toBe(genericError);
    });

    expect(authMockValue.invalidatePermissions).not.toHaveBeenCalled();

    getContentMock.mockResolvedValue({
      data: {
        id: 'content-1',
        contentType: 'generic',
        title: 'Startseite',
        createdAt: '2026-03-21T10:00:00.000Z',
        updatedAt: '2026-03-21T11:00:00.000Z',
        author: 'Editor',
        payload: { blocks: [] },
        status: 'draft',
        history: [],
      },
    });
    getContentHistoryMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 0, total: 0 },
    });

    await act(async () => {
      await result.current.refetch();
    });

    updateContentMock.mockRejectedValueOnce(new Error('db down'));

    await act(async () => {
      expect(await result.current.updateContent({ title: 'Neu' })).toBe(false);
    });

    expect(result.current.mutationError).toBe(genericError);
    expect(authMockValue.invalidatePermissions).not.toHaveBeenCalled();
  });
});
