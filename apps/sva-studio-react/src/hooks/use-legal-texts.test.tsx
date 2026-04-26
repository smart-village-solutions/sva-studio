import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLegalTexts } from './use-legal-texts';

const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
const listLegalTextsMock = vi.fn();
const createLegalTextMock = vi.fn();
const updateLegalTextMock = vi.fn();
const asIamErrorMock = vi.fn();
const authMockValue = {
  user: {
    id: 'admin-1',
    name: 'Admin',
    roles: ['system_admin'],
  },
  isAuthenticated: true,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  logout: vi.fn(),
  invalidatePermissions: vi.fn(),
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
  listLegalTexts: (...args: unknown[]) => listLegalTextsMock(...args),
  createLegalText: (...args: unknown[]) => createLegalTextMock(...args),
  updateLegalText: (...args: unknown[]) => updateLegalTextMock(...args),
  asIamError: (...args: unknown[]) => asIamErrorMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

vi.mock('@sva/monitoring-client/logging', () => ({
  createBrowserLogger: () => browserLoggerMock,
}));

describe('useLegalTexts', () => {
  beforeEach(() => {
    listLegalTextsMock.mockReset();
    createLegalTextMock.mockReset();
    updateLegalTextMock.mockReset();
    asIamErrorMock.mockReset();
    authMockValue.invalidatePermissions.mockReset();
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
    browserLoggerMock.error.mockReset();
  });

  it('loads and mutates legal texts', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    listLegalTextsMock.mockResolvedValue({
      data: [
        {
          id: 'lt-1',
          name: 'Datenschutzhinweise',
          legalTextVersion: '2026-03',
          locale: 'de-DE',
          contentHtml: '<p>Datenschutz</p>',
          status: 'valid',
          publishedAt: '2026-03-16T09:00:00.000Z',
          createdAt: '2026-03-16T08:00:00.000Z',
          updatedAt: '2026-03-16T08:30:00.000Z',
          acceptanceCount: 4,
          activeAcceptanceCount: 3,
        },
      ],
      pagination: { page: 1, pageSize: 1, total: 1 },
    });
    createLegalTextMock.mockResolvedValue({ data: { id: 'lt-2' } });
    updateLegalTextMock.mockResolvedValue({ data: { id: 'lt-1' } });

    const { result } = renderHook(() => useLegalTexts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.legalTexts).toHaveLength(1);
    });

    await act(async () => {
      await result.current.createLegalText({
        name: 'Nutzungsbedingungen',
        legalTextVersion: '2026-04',
        locale: 'en-GB',
        contentHtml: '<p>Terms</p>',
        status: 'draft',
      });
      await result.current.updateLegalText('lt-1', { contentHtml: '<p>Updated</p>' });
    });

    expect(createLegalTextMock).toHaveBeenCalledTimes(1);
    expect(updateLegalTextMock).toHaveBeenCalledTimes(1);
    expect(browserLoggerMock.debug).toHaveBeenCalledWith(
      'mutation_started',
      expect.objectContaining({ operation: 'create_legal_text', event: 'legal_text_mutation' })
    );
    expect(browserLoggerMock.debug).toHaveBeenCalledWith(
      'mutation_started',
      expect.objectContaining({ operation: 'update_legal_text', event: 'legal_text_mutation' })
    );
  });

  it('invalidates permissions when initial fetch returns 403', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    asIamErrorMock.mockReturnValue(forbiddenError);
    listLegalTextsMock.mockRejectedValueOnce(new Error('forbidden-list'));

    const { result } = renderHook(() => useLegalTexts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(forbiddenError);
      expect(result.current.legalTexts).toHaveLength(0);
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
  });

  it('stores mutation errors when create fails', async () => {
    const conflictError = { status: 409, code: 'conflict', message: 'Conflict' };
    asIamErrorMock.mockReturnValue(conflictError);
    listLegalTextsMock.mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 0, total: 0 },
    });
    createLegalTextMock.mockRejectedValueOnce(new Error('conflict-create'));

    const { result } = renderHook(() => useLegalTexts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const created = await result.current.createLegalText({
        name: 'Datenschutz',
        legalTextVersion: '2026-03',
        locale: 'de-DE',
        contentHtml: '<p>Text</p>',
        status: 'draft',
      });
      expect(created).toBeNull();
    });

    expect(result.current.mutationError).toBe(conflictError);
    expect(authMockValue.invalidatePermissions).not.toHaveBeenCalled();
  });

  it('returns the created legal text from the mutation response', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    listLegalTextsMock.mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 0, total: 0 },
    });
    listLegalTextsMock.mockResolvedValueOnce({
      data: [
        {
          id: 'lt-2',
          name: 'Nutzungsbedingungen',
          legalTextVersion: '2026-04',
          locale: 'en-GB',
          contentHtml: '<p>Terms</p>',
          status: 'draft',
          publishedAt: null,
          createdAt: '2026-04-12T11:00:00.000Z',
          updatedAt: '2026-04-12T11:00:00.000Z',
          acceptanceCount: 0,
          activeAcceptanceCount: 0,
        },
      ],
      pagination: { page: 1, pageSize: 1, total: 1 },
    });
    createLegalTextMock.mockResolvedValue({
      data: {
        id: 'lt-2',
        name: 'Nutzungsbedingungen',
        legalTextVersion: '2026-04',
        locale: 'en-GB',
      },
    });

    const { result } = renderHook(() => useLegalTexts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const created = await result.current.createLegalText({
        name: 'Nutzungsbedingungen',
        legalTextVersion: '2026-04',
        locale: 'en-GB',
        contentHtml: '<p>Terms</p>',
        status: 'draft',
      });
      expect(created).toEqual({
        id: 'lt-2',
        name: 'Nutzungsbedingungen',
        legalTextVersion: '2026-04',
        locale: 'en-GB',
      });
    });
  });
});
