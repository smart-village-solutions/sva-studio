import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useContentDetail, useContents, useCreateContent } from './use-contents';

const listContentsMock = vi.fn();
const createContentMock = vi.fn();
const getContentMock = vi.fn();
const getContentHistoryMock = vi.fn();
const updateContentMock = vi.fn();
const asIamErrorMock = vi.fn();
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
  getContent: (...args: unknown[]) => getContentMock(...args),
  getContentHistory: (...args: unknown[]) => getContentHistoryMock(...args),
  updateContent: (...args: unknown[]) => updateContentMock(...args),
  asIamError: (...args: unknown[]) => asIamErrorMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('useContents', () => {
  beforeEach(() => {
    listContentsMock.mockReset();
    createContentMock.mockReset();
    getContentMock.mockReset();
    getContentHistoryMock.mockReset();
    updateContentMock.mockReset();
    asIamErrorMock.mockReset();
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
    });

    const { result } = renderHook(() => useContents());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.contents).toHaveLength(1);
    });
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

  it('invalidates permissions on 403 errors and handles empty detail ids', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    asIamErrorMock.mockReturnValue(forbiddenError);
    createContentMock.mockRejectedValueOnce(new Error('forbidden'));

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

    const { result: detailResult } = renderHook(() => useContentDetail(null));
    await waitFor(() => {
      expect(detailResult.current.isLoading).toBe(false);
      expect(detailResult.current.content).toBeNull();
      expect(detailResult.current.history).toEqual([]);
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

  it('stores detail and update errors and invalidates permissions on 403', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    asIamErrorMock.mockReturnValue(forbiddenError);
    getContentMock.mockRejectedValueOnce(new Error('forbidden'));
    getContentHistoryMock.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 0, total: 0 } });

    const { result } = renderHook(() => useContentDetail('content-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(forbiddenError);
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);

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

    updateContentMock.mockRejectedValueOnce(new Error('forbidden'));

    await act(async () => {
      const updated = await result.current.updateContent({ title: 'Neu' });
      expect(updated).toBe(false);
    });

    expect(result.current.mutationError).toBe(forbiddenError);
  });

  it('returns false for detail mutations without an id and clears stored mutation errors', async () => {
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
