import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentListPage } from './-content-list-page';

const useContentsMock = vi.fn();
const useContentAccessMock = vi.fn();
const navigateMock = vi.fn();
let searchState: Record<string, unknown> = {};

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => searchState,
  Link: ({ children, to, params, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; params?: Record<string, string> }) => {
    const href =
      typeof params?.contentId === 'string'
        ? to.replace('$contentId', params.contentId)
        : typeof params?.id === 'string'
          ? to.replace('$id', params.id)
          : to;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('../../hooks/use-contents', () => ({
  useContents: () => useContentsMock(),
}));

vi.mock('../../hooks/use-content-access', () => ({
  useContentAccess: () => useContentAccessMock(),
}));

describe('ContentListPage', () => {
  beforeEach(() => {
    useContentsMock.mockReset();
    useContentAccessMock.mockReset();
    navigateMock.mockReset();
    searchState = {};
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: ['org-1'],
        sourceKinds: ['direct_role'],
      },
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders contents, filters them and links to create and edit routes', () => {
    useContentsMock.mockReturnValue({
      contents: [
        {
          id: 'content-1',
          contentType: 'generic',
          title: 'Startseite',
          publishedAt: '2026-03-21T10:00:00.000Z',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T11:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'Willkommen' },
          status: 'published',
          access: {
            state: 'editable',
            canRead: true,
            canCreate: true,
            canUpdate: true,
            organizationIds: ['org-1'],
            sourceKinds: ['direct_role'],
          },
        },
        {
          id: 'content-2',
          contentType: 'generic',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T11:00:00.000Z',
          title: 'Archiv',
          author: 'Redaktion',
          payload: { blocks: ['A'] },
          status: 'archived',
          access: {
            state: 'read_only',
            canRead: true,
            canCreate: true,
            canUpdate: false,
            reasonCode: 'content_update_missing',
            organizationIds: ['org-1'],
            sourceKinds: ['group_role'],
          },
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      archiveContents: vi.fn(),
      deleteContents: vi.fn(),
    });

    const view = render(<ContentListPage />);

    expect(screen.getByRole('heading', { name: 'Inhalte' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Neuer Inhalt' }).getAttribute('href')).toBe('/admin/content/new');

    fireEvent.change(screen.getByLabelText('Suche'), {
      target: { value: 'archiv' },
    });

    const searchUpdater = navigateMock.mock.calls.at(-1)?.[0]?.search as ((current: Record<string, unknown>) => Record<string, unknown>) | undefined;
    searchState = searchUpdater?.(searchState) ?? searchState;
    view.rerender(<ContentListPage />);

    expect(screen.queryAllByText('Startseite')).toHaveLength(0);
    expect(screen.getAllByText('Archiv').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Nur lesen' })[0]?.getAttribute('href')).toBe('/admin/content/content-2');
    expect(screen.getAllByText('Nur lesbar').length).toBeGreaterThan(0);
  });

  it('shows loading, empty and error states', () => {
    useContentsMock.mockReturnValue({
      contents: [],
      isLoading: false,
      error: { code: 'database_unavailable' },
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      archiveContents: vi.fn(),
      deleteContents: vi.fn(),
    });

    const { rerender } = render(<ContentListPage />);
    expect(screen.getByText('Die Inhaltsdaten konnten wegen eines Datenbankproblems nicht verarbeitet werden.')).toBeTruthy();
    expect(screen.getByText('Noch keine Inhalte vorhanden')).toBeTruthy();

    useContentsMock.mockReturnValue({
      contents: [],
      isLoading: true,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
    });

    rerender(<ContentListPage />);
    expect(screen.getByText('Inhalte werden geladen ...')).toBeTruthy();
  });

  it('filters by status and falls back to the generic load error for unknown errors', () => {
    useContentsMock.mockReturnValue({
      contents: [
        {
          id: 'content-1',
          contentType: 'generic',
          title: 'Startseite',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T11:00:00.000Z',
          author: 'Editor',
          payload: { long: 'x'.repeat(100) },
          status: 'draft',
        },
        {
          id: 'content-2',
          contentType: 'generic',
          title: 'Live',
          publishedAt: 'invalid-date',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T11:00:00.000Z',
          author: 'Redaktion',
          payload: { hero: 'Willkommen' },
          status: 'published',
        },
      ],
      isLoading: false,
      error: { code: 'unexpected_error' },
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      archiveContents: vi.fn(),
      deleteContents: vi.fn(),
    });

    const view = render(<ContentListPage />);

    expect(screen.getByText('Inhalte konnten nicht geladen werden.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'published' },
    });

    const searchUpdater = navigateMock.mock.calls.at(-1)?.[0]?.search as ((current: Record<string, unknown>) => Record<string, unknown>) | undefined;
    searchState = searchUpdater?.(searchState) ?? searchState;
    view.rerender(<ContentListPage />);

    expect(screen.queryAllByText('Startseite')).toHaveLength(0);
    expect(screen.getAllByText('Live').length).toBeGreaterThan(0);
    expect(screen.getAllByText('invalid-date').length).toBeGreaterThan(0);
  });

  it('renders forbidden errors and falls back for empty payload summaries', () => {
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'server_denied',
        canRead: false,
        canCreate: false,
        canUpdate: false,
        reasonCode: 'server_forbidden',
        organizationIds: [],
        sourceKinds: [],
      },
      isLoading: false,
      error: { code: 'forbidden', status: 403, message: 'forbidden' },
    });
    useContentsMock.mockReturnValue({
      contents: [
        {
          id: 'content-3',
          contentType: 'legal',
          title: 'Bedingungen',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T11:00:00.000Z',
          author: 'Compliance',
          payload: undefined,
          status: 'approved',
          access: {
            state: 'server_denied',
            canRead: false,
            canCreate: false,
            canUpdate: false,
            reasonCode: 'server_forbidden',
            organizationIds: [],
            sourceKinds: [],
          },
        },
      ],
      isLoading: false,
      error: { code: 'forbidden' },
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      archiveContents: vi.fn(),
      deleteContents: vi.fn(),
    });

    render(<ContentListPage />);

    expect(screen.getByText('Unzureichende Berechtigungen für diese Inhaltsaktion.')).toBeTruthy();
    expect(screen.getByText('Aktueller Zugriffsstatus: Serverseitig verweigert. Kein zusätzlicher Kontext')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Neuer Inhalt' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Gesperrt' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getAllByText('{}').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nicht gesetzt').length).toBeGreaterThan(0);
  });

  it('hydrates host list controls from route search state and updates canonical params', () => {
    searchState = {
      search: 'archiv',
      filters: { status: 'archived' },
      page: 2,
      pageSize: 1,
      sort: { field: 'updatedAt', direction: 'desc' },
    };

    useContentsMock.mockReturnValue({
      contents: [
        {
          id: 'content-1',
          contentType: 'generic',
          title: 'Archiv alt',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T10:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'A' },
          status: 'archived',
        },
        {
          id: 'content-2',
          contentType: 'generic',
          title: 'Archiv neu',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-22T10:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'B' },
          status: 'archived',
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      archiveContents: vi.fn(),
      deleteContents: vi.fn(),
    });

    render(<ContentListPage />);

    expect((screen.getByLabelText('Suche') as HTMLInputElement).value).toBe('archiv');
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('archived');
    expect(screen.queryByText('Archiv neu')).toBeNull();
    expect(screen.getAllByText('Archiv alt').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Suche'), {
      target: { value: 'neu' },
    });

    expect(navigateMock).toHaveBeenCalled();

    const searchUpdater = navigateMock.mock.calls[0]?.[0]?.search as ((current: Record<string, unknown>) => Record<string, unknown>) | undefined;
    expect(searchUpdater).toBeTypeOf('function');
    expect(searchUpdater?.(searchState)).toEqual({
      page: 1,
      pageSize: 1,
      q: 'neu',
      sort: '-updatedAt',
      status: 'archived',
    });
  });

  it('derives bulk action scopes from host capabilities and forwards normalized selection inputs', async () => {
    const archiveContents = vi.fn().mockResolvedValue({ acceptedCount: 2, failedCount: 0, skippedCount: 0 });
    const deleteContents = vi.fn().mockResolvedValue({ acceptedCount: 1, failedCount: 0, skippedCount: 0 });
    searchState = {
      search: '',
      filters: { status: 'all' },
      page: 1,
      pageSize: 2,
      sort: { field: 'updatedAt', direction: 'desc' },
    };

    useContentsMock.mockReturnValue({
      contents: [
        {
          id: 'content-1',
          contentType: 'generic',
          title: 'Startseite',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-23T10:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'A' },
          status: 'draft',
        },
        {
          id: 'content-2',
          contentType: 'generic',
          title: 'Archiv',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-22T10:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'B' },
          status: 'published',
        },
        {
          id: 'content-3',
          contentType: 'generic',
          title: 'Kontakt',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T10:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'C' },
          status: 'published',
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      archiveContents,
      deleteContents,
    });

    render(<ContentListPage />);

    fireEvent.click(screen.getAllByLabelText(/Inhalte: Zeile content-1 auswählen/i)[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Löschen (Auswahl)' }));

    expect(deleteContents).toHaveBeenCalledWith({
      actionId: 'content.delete',
      contentIds: ['content-1'],
      matchingCount: 3,
      page: 1,
      pageSize: 2,
      selectionMode: 'explicitIds',
      sort: { direction: 'desc', field: 'updatedAt' },
      statusFilter: 'all',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Archivieren (Aktuelle Seite)' }));

    expect(archiveContents).toHaveBeenCalledWith({
      actionId: 'content.archive',
      contentIds: ['content-1', 'content-2'],
      matchingCount: 3,
      page: 1,
      pageSize: 2,
      selectionMode: 'currentPage',
      sort: { direction: 'desc', field: 'updatedAt' },
      statusFilter: 'all',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Archivieren (Alle Treffer)' }));

    expect(archiveContents).toHaveBeenCalledWith({
      actionId: 'content.archive',
      contentIds: ['content-1', 'content-2', 'content-3'],
      matchingCount: 3,
      page: 1,
      pageSize: 2,
      selectionMode: 'allMatchingQuery',
      sort: { direction: 'desc', field: 'updatedAt' },
      statusFilter: 'all',
    });
  });
});
