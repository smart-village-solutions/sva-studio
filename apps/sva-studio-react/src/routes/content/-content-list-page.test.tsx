import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentListPage } from './-content-list-page';

const useContentsMock = vi.fn();
const useContentAccessMock = vi.fn();
const useAuthMock = vi.fn();
const deleteNewsMock = vi.fn();
const deleteEventMock = vi.fn();
const deletePoiMock = vi.fn();
const deleteSurveyMock = vi.fn();
const navigateMock = vi.fn();
let searchState: Record<string, unknown> = {};
const { mockedStudioContentTypes } = vi.hoisted(() => ({
  mockedStudioContentTypes: [
    {
      contentType: 'generic',
      displayName: 'Inhalte',
      requiredReadAction: 'content.read',
      requiredCreateAction: 'content.create',
      createPath: '/admin/content/new',
      detailPath: '/admin/content/$contentId',
    },
    {
      contentType: 'news.article',
      displayName: 'News',
      requiredReadAction: 'news.read',
      requiredCreateAction: 'news.create',
      createPath: '/admin/news/new',
      detailPath: '/admin/news/$contentId',
    },
    {
      contentType: 'events.event-record',
      displayName: 'Veranstaltungen',
      requiredReadAction: 'events.read',
      requiredCreateAction: 'events.create',
      createPath: '/admin/events/new',
      detailPath: '/admin/events/$contentId',
    },
    {
      contentType: 'poi.point-of-interest',
      displayName: 'Orte',
      requiredReadAction: 'poi.read',
      requiredCreateAction: 'poi.create',
      createPath: '/admin/poi/new',
      detailPath: '/admin/poi/$contentId',
    },
    {
      contentType: 'surveys.survey',
      displayName: 'Umfragen',
      requiredReadAction: 'surveys.read',
      requiredCreateAction: 'surveys.create',
      createPath: '/admin/surveys/new',
      detailPath: '/admin/surveys/$contentId',
    },
  ] as const,
}));

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
  useContents: (...args: unknown[]) => useContentsMock(...args),
}));

vi.mock('../../hooks/use-content-access', () => ({
  useContentAccess: () => useContentAccessMock(),
}));

vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@sva/plugin-news', () => ({
  deleteNews: (...args: unknown[]) => deleteNewsMock(...args),
}));

vi.mock('@sva/plugin-events', () => ({
  deleteEvent: (...args: unknown[]) => deleteEventMock(...args),
}));

vi.mock('@sva/plugin-poi', () => ({
  deletePoi: (...args: unknown[]) => deletePoiMock(...args),
}));

vi.mock('@sva/plugin-surveys', () => ({
  deleteSurvey: (...args: unknown[]) => deleteSurveyMock(...args),
}));

vi.mock('../../lib/plugins', () => ({
  studioContentTypes: mockedStudioContentTypes,
}));

describe('ContentListPage', () => {
  beforeEach(() => {
    useContentsMock.mockReset();
    useContentAccessMock.mockReset();
    useAuthMock.mockReset();
    deleteNewsMock.mockReset();
    deleteEventMock.mockReset();
    deletePoiMock.mockReset();
    deleteSurveyMock.mockReset();
    navigateMock.mockReset();
    searchState = {};
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        instanceId: 'de-musterhausen',
        roles: ['system_admin'],
        permissionActions: [
          'content.read',
          'content.create',
          'news.read',
          'news.create',
          'news.update',
          'news.delete',
          'poi.read',
          'poi.create',
          'poi.delete',
          'events.read',
          'events.create',
          'events.delete',
          'surveys.read',
          'surveys.create',
          'surveys.delete',
        ],
      },
      isLoading: false,
      hasResolvedSession: true,
    });
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: ['org-1'],
        sourceKinds: ['direct_role'],
      },
      permissionActions: [
        'content.read',
        'content.create',
        'news.read',
        'news.create',
        'news.update',
        'news.delete',
        'poi.read',
        'poi.create',
        'poi.delete',
        'events.read',
        'events.create',
        'events.delete',
        'surveys.read',
        'surveys.create',
        'surveys.delete',
      ],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  const createContentsApiResult = (overrides: Record<string, unknown> = {}) => ({
    contents: [],
    pagination: { page: 1, pageSize: 25, total: 0 },
    metadata: null,
    isLoading: false,
    error: null,
    mutationError: null,
    refetch: vi.fn(),
    refreshProjection: vi.fn(async () => true),
    refreshProjectionPending: false,
    clearMutationError: vi.fn(),
    archiveContents: vi.fn(),
    deleteContents: vi.fn(),
    ...overrides,
  });

  it('renders contents, filters them and links to create and edit routes', () => {
    useContentsMock.mockReturnValue(createContentsApiResult({
      contents: [
        {
          id: 'content-1',
          contentType: 'news.article',
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
          contentType: 'poi.point-of-interest',
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
      pagination: { page: 1, pageSize: 25, total: 2 },
    }));

    const view = render(<ContentListPage />);

    expect(useContentsMock).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 25,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        visibleTypes: ['generic', 'news.article', 'events.event-record', 'poi.point-of-interest', 'surveys.survey'],
      },
      { enabled: true }
    );
    expect(screen.getByRole('heading', { name: 'Inhalte' })).toBeTruthy();
    expect(screen.queryByText(/Aktueller Zugriffsstatus:/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Inhaltsliste', level: 2 })).toBeNull();
    expect(screen.getByRole('link', { name: 'Neuer Inhalt' }).getAttribute('href')).toBe('/admin/content/new');
    expect(screen.getByText('1–2 von 2 Inhalten')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Inhalte: Alle Zeilen auswählen' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: 'Inhalte: Zeile content-1 auswählen' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Bearbeiten' })[0]?.getAttribute('href')).toBe('/admin/news/content-1');
    expect(screen.getAllByRole('link', { name: 'Nur lesen' })[0]?.getAttribute('href')).toBe('/admin/poi/content-2');
    expect(screen.getAllByRole('button', { name: 'Löschen' }).length).toBeGreaterThanOrEqual(2);

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'archived' },
    });

    const searchUpdater = navigateMock.mock.calls.at(-1)?.[0]?.search as ((current: Record<string, unknown>) => Record<string, unknown>) | undefined;
    searchState = searchUpdater?.(searchState) ?? searchState;
    useContentsMock.mockReturnValue(
      createContentsApiResult({
        contents: [
          {
            id: 'content-2',
            contentType: 'poi.point-of-interest',
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
        pagination: { page: 1, pageSize: 25, total: 1 },
      })
    );
    view.rerender(<ContentListPage />);

    expect(useContentsMock).toHaveBeenLastCalledWith(
      {
        page: 1,
        pageSize: 25,
        status: 'archived',
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        visibleTypes: ['generic', 'news.article', 'events.event-record', 'poi.point-of-interest', 'surveys.survey'],
      },
      { enabled: true }
    );
    expect(screen.getAllByText('Archiv').length).toBeGreaterThan(0);
  });

  it('does not load contents before content access has resolved', () => {
    useContentAccessMock.mockReturnValue({
      access: null,
      permissionActions: [],
      isLoading: true,
      error: null,
    });
    useContentsMock.mockReturnValue(createContentsApiResult());

    render(<ContentListPage />);

    expect(useContentsMock).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 25,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        visibleTypes: ['generic', 'news.article', 'events.event-record', 'poi.point-of-interest', 'surveys.survey'],
      },
      { enabled: false }
    );
  });

  it('deletes a mainserver content row when delete permission exists', async () => {
    const refetch = vi.fn(async () => undefined);
    const confirmMock = vi.fn(() => true);
    Object.defineProperty(window, 'confirm', { configurable: true, writable: true, value: confirmMock });

    useContentsMock.mockReturnValue(createContentsApiResult({
      contents: [
        {
          id: 'survey-1',
          contentType: 'surveys.survey',
          title: 'Beteiligung',
          publishedAt: '2026-03-21T10:00:00.000Z',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T11:00:00.000Z',
          author: 'mainserver',
          payload: { questionCount: 3 },
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
      ],
      pagination: { page: 1, pageSize: 25, total: 1 },
      refetch,
    }));
    deleteSurveyMock.mockResolvedValue(undefined);

    render(<ContentListPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[0]!);

    expect(confirmMock).toHaveBeenCalledWith('Soll dieser Inhalt wirklich gelöscht werden?');
    await waitFor(() => {
      expect(deleteSurveyMock).toHaveBeenCalledWith('survey-1');
    });
    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });

  it('encodes content ids when building row detail links', () => {
    useContentsMock.mockReturnValue(createContentsApiResult({
      contents: [
        {
          id: 'news/with?#slug',
          contentType: 'news.article',
          title: 'Reservierte Zeichen',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T11:00:00.000Z',
          author: 'Editor',
          payload: {},
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
      ],
      pagination: { page: 1, pageSize: 25, total: 1 },
    }));

    render(<ContentListPage />);

    expect(screen.getAllByRole('link', { name: 'Bearbeiten' })[0]?.getAttribute('href')).toBe(
      '/admin/news/news%2Fwith%3F%23slug'
    );
  });

  it('shows loading, empty and error states', () => {
    useContentsMock.mockReturnValue(createContentsApiResult({
      error: { code: 'database_unavailable' },
    }));

    const { rerender } = render(<ContentListPage />);
    expect(screen.getByText('Die Inhaltsdaten konnten wegen eines Datenbankproblems nicht verarbeitet werden.')).toBeTruthy();
    expect(screen.getByText('Noch keine Inhalte vorhanden')).toBeTruthy();

    useContentsMock.mockReturnValue(createContentsApiResult({
      isLoading: true,
    }));

    rerender(<ContentListPage />);
    expect(screen.getByText('Inhalte werden geladen ...')).toBeTruthy();
  });

  it('shows the projection sync status and triggers a manual refresh', async () => {
    const refreshProjection = vi.fn(async () => true);
    useContentsMock.mockReturnValue(
      createContentsApiResult({
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
        refreshProjection,
      })
    );

    render(<ContentListPage />);

    expect(screen.getByText(/letzten erfolgreichen Abgleich/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));

    await waitFor(() => {
      expect(refreshProjection).toHaveBeenCalledWith({ force: true });
    });
  });

  it('filters by status and falls back to the generic load error for unknown errors', () => {
    useContentsMock.mockReturnValue(createContentsApiResult({
      contents: [
        {
          id: 'content-1',
          contentType: 'news.article',
          title: 'Startseite',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T11:00:00.000Z',
          author: 'Editor',
          payload: { long: 'x'.repeat(100) },
          status: 'draft',
        },
        {
          id: 'content-2',
          contentType: 'events.event-record',
          title: 'Live',
          publishedAt: 'invalid-date',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T11:00:00.000Z',
          author: 'Redaktion',
          payload: { hero: 'Willkommen' },
          status: 'published',
        },
      ],
      error: { code: 'unexpected_error' },
      pagination: { page: 1, pageSize: 25, total: 2 },
    }));

    render(<ContentListPage />);

    expect(screen.getByText('Inhalte konnten nicht geladen werden.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'published' },
    });

    const searchUpdater = navigateMock.mock.calls.at(-1)?.[0]?.search as ((current: Record<string, unknown>) => Record<string, unknown>) | undefined;
    expect(searchUpdater?.(searchState)).toEqual({
      page: 1,
      pageSize: 25,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      status: 'published',
    });
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
      permissionActions: ['news.read'],
      isLoading: false,
      error: { code: 'forbidden', status: 403, message: 'forbidden' },
    });
    useContentsMock.mockReturnValue(createContentsApiResult({
      contents: [
        {
          id: 'content-3',
          contentType: 'news.article',
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
      error: { code: 'forbidden' },
      pagination: { page: 1, pageSize: 25, total: 1 },
    }));

    render(<ContentListPage />);

    expect(screen.getByText('Unzureichende Berechtigungen für diese Inhaltsaktion.')).toBeTruthy();
    expect(screen.queryByText(/Aktueller Zugriffsstatus:/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Neuer Inhalt' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Gesperrt' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it('hydrates host list controls from route search state and updates canonical params', () => {
    searchState = {
      filters: { status: 'archived' },
      page: 2,
      pageSize: 1,
      sort: { field: 'updatedAt', direction: 'desc' },
    };

    useContentsMock.mockReturnValue(createContentsApiResult({
      contents: [
        {
          id: 'content-1',
          contentType: 'news.article',
          title: 'Archiv alt',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T10:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'A' },
          status: 'archived',
        },
        {
          id: 'content-2',
          contentType: 'news.article',
          title: 'Archiv neu',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-22T10:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'B' },
          status: 'archived',
        },
      ],
      pagination: { page: 2, pageSize: 1, total: 2 },
    }));

    render(<ContentListPage />);

    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('archived');
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'published' },
    });

    expect(navigateMock).toHaveBeenCalled();

    const searchUpdater = navigateMock.mock.calls[0]?.[0]?.search as ((current: Record<string, unknown>) => Record<string, unknown>) | undefined;
    expect(searchUpdater).toBeTypeOf('function');
    expect(searchUpdater?.(searchState)).toEqual({
      page: 1,
      pageSize: 1,
      status: 'published',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
  });

  it('keeps the content list query reference stable across rerenders without search changes', () => {
    searchState = {
      filters: { status: 'all' },
      sort: { field: 'updatedAt', direction: 'desc' },
      page: 1,
      pageSize: 25,
    };

    useContentsMock.mockReturnValue(createContentsApiResult());

    const view = render(<ContentListPage />);
    view.rerender(<ContentListPage />);

    expect(useContentsMock).toHaveBeenCalledTimes(2);
    expect(useContentsMock.mock.calls[0]?.[0]).toBe(useContentsMock.mock.calls[1]?.[0]);
  });

  it('keeps the content list query reference stable when content access finishes with the same readable types', () => {
    searchState = {
      filters: { status: 'all' },
      sort: { field: 'updatedAt', direction: 'desc' },
      page: 1,
      pageSize: 25,
    };

    useContentAccessMock
      .mockReturnValueOnce({
        access: null,
        permissionActions: [],
        isLoading: true,
        error: null,
      })
      .mockReturnValue({
        access: {
          state: 'editable',
          canRead: true,
          canCreate: true,
          canUpdate: true,
          organizationIds: ['org-1'],
          sourceKinds: ['direct_role'],
        },
        permissionActions: [
          'content.read',
          'content.create',
          'news.read',
          'news.create',
          'news.update',
          'news.delete',
          'poi.read',
          'poi.create',
          'poi.delete',
          'events.read',
          'events.create',
          'events.delete',
          'surveys.read',
        ],
        isLoading: false,
        error: null,
      });
    useContentsMock.mockReturnValue(createContentsApiResult());

    const view = render(<ContentListPage />);
    view.rerender(<ContentListPage />);

    expect(useContentsMock).toHaveBeenCalledTimes(2);
    expect(useContentsMock.mock.calls[0]?.[0]).toBe(useContentsMock.mock.calls[1]?.[0]);
  });

  it('normalizes legacy query aliases from route search state into canonical list controls', () => {
    searchState = {
      status: 'published',
      page: '2',
      pageSize: '1',
      sorting: '-updatedAt',
    };

    useContentsMock.mockReturnValue(createContentsApiResult({
      contents: [
        {
          id: 'content-1',
          contentType: 'news.article',
          title: 'Live alt',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-21T10:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'A' },
          status: 'published',
        },
        {
          id: 'content-2',
          contentType: 'news.article',
          title: 'Live neu',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-22T10:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'B' },
          status: 'published',
        },
      ],
      pagination: { page: 2, pageSize: 1, total: 2 },
    }));

    render(<ContentListPage />);

    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('published');
    expect(useContentsMock).toHaveBeenCalledWith(
      {
        page: 2,
        pageSize: 1,
        status: 'published',
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        visibleTypes: ['generic', 'news.article', 'events.event-record', 'poi.point-of-interest', 'surveys.survey'],
      },
      { enabled: true }
    );
  });

  it('hides generic bulk actions for mainserver-backed content items', async () => {
    searchState = {
      filters: { status: 'all' },
      page: 1,
      pageSize: 2,
      sort: { field: 'updatedAt', direction: 'desc' },
    };

    useContentsMock.mockReturnValue(createContentsApiResult({
      contents: [
        {
          id: 'content-1',
          contentType: 'news.article',
          title: 'Startseite',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-23T10:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'A' },
          status: 'draft',
        },
        {
          id: 'content-2',
          contentType: 'poi.point-of-interest',
          title: 'Archiv',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-22T10:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'B' },
          status: 'published',
        },
      ],
      pagination: { page: 1, pageSize: 2, total: 3 },
    }));

    render(<ContentListPage />);

    expect(screen.queryByRole('button', { name: 'Löschen (Auswahl)' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archivieren (Auswahl)' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Inhalte: Alle Zeilen auswählen' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: 'Inhalte: Zeile content-1 auswählen' })).toHaveLength(2);
  });

  it('shows local-only bulk actions when the current page contains IAM content', async () => {
    useContentsMock.mockReturnValue(createContentsApiResult({
      contents: [
        {
          id: 'local-1',
          contentType: 'generic',
          title: 'Lokaler Inhalt',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-23T10:00:00.000Z',
          author: 'Editor',
          payload: { hero: 'A' },
          status: 'draft',
        },
      ],
      pagination: { page: 1, pageSize: 1, total: 1 },
    }));
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: ['org-1'],
        sourceKinds: ['direct_role'],
      },
      permissionActions: ['content.read', 'content.archive', 'content.delete'],
      isLoading: false,
      error: null,
    });

    render(<ContentListPage />);

    expect(screen.getByRole('button', { name: 'Archivieren (Auswahl)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Löschen (Auswahl)' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: 'Inhalte: Zeile local-1 auswählen' })).toHaveLength(2);
  });

  it('uses a sentinel visible type when no readable content types are available', () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        instanceId: 'de-musterhausen',
        roles: ['system_admin'],
        permissionActions: [],
      },
    });
    useContentAccessMock.mockReturnValue({
      access: null,
      permissionActions: [],
      isLoading: false,
      error: null,
    });
    useContentsMock.mockReturnValue(createContentsApiResult());

    render(<ContentListPage />);

    expect(useContentsMock).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 25,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        visibleTypes: ['__no_readable_content__'],
      },
      { enabled: false }
    );
  });

  it('waits for content access before requesting the content list while access is loading', () => {
    useContentAccessMock.mockReturnValue({
      access: null,
      permissionActions: [],
      isLoading: true,
      error: null,
    });
    useContentsMock.mockReturnValue(createContentsApiResult());

    render(<ContentListPage />);

    expect(useContentsMock).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 25,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        visibleTypes: ['generic', 'news.article', 'events.event-record', 'poi.point-of-interest', 'surveys.survey'],
      },
      { enabled: false }
    );
  });

  it('waits for content access before requesting the content list before the first load starts', () => {
    useContentAccessMock.mockReturnValue({
      access: null,
      permissionActions: [],
      isLoading: false,
      error: null,
    });
    useContentsMock.mockReturnValue(createContentsApiResult());

    render(<ContentListPage />);

    expect(useContentsMock).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 25,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        visibleTypes: ['generic', 'news.article', 'events.event-record', 'poi.point-of-interest', 'surveys.survey'],
      },
      { enabled: false }
    );
  });

  it('does not start the content list request before the auth session has resolved', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: true,
      hasResolvedSession: false,
    });
    useContentAccessMock.mockReturnValue({
      access: null,
      permissionActions: [],
      isLoading: false,
      error: null,
    });
    useContentsMock.mockReturnValue(createContentsApiResult({ isLoading: false }));

    render(<ContentListPage />);

    expect(useContentsMock).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 25,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        visibleTypes: ['__no_readable_content__'],
      },
      { enabled: false }
    );
    expect(screen.getByText('Inhalte werden geladen ...')).toBeTruthy();
  });

  it('normalizes legacy string sort params from route state before querying the content list', () => {
    searchState = {
      sort: '-title',
    };

    useContentsMock.mockReturnValue(createContentsApiResult());

    render(<ContentListPage />);

    expect(useContentsMock).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 25,
        sortBy: 'title',
        sortDirection: 'desc',
        visibleTypes: ['generic', 'news.article', 'events.event-record', 'poi.point-of-interest', 'surveys.survey'],
      },
      { enabled: true }
    );
  });
});
