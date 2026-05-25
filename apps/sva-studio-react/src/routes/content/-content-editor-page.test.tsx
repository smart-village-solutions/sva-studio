import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from '../../../../../tooling/testing/src/msw/handlers.ts';
import { studioMswServer } from '../../../../../tooling/testing/src/msw/server.ts';

import { ContentEditorPage } from './-content-editor-page';

const navigateMock = vi.fn();
const useContentAccessMock = vi.fn();
const invalidatePermissionsMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: 'editor-1',
      name: 'Editor',
      roles: ['editor'],
      instanceId: 'instance-1',
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    logout: vi.fn(),
    invalidatePermissions: invalidatePermissionsMock,
    updateProfile: vi.fn(),
  }),
}));

vi.mock('../../hooks/use-content-access', () => ({
  useContentAccess: () => useContentAccessMock(),
}));

vi.mock('../../lib/browser-operation-logging', () => ({
  createOperationLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  logBrowserOperationFailure: vi.fn(),
  logBrowserOperationStart: vi.fn(),
  logBrowserOperationSuccess: vi.fn(),
}));

const defaultAccess = {
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
};

const createContentDetail = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

const createHistoryEntry = (overrides: Record<string, unknown> = {}) => ({
  id: 'history-1',
  contentId: 'content-1',
  action: 'created',
  actor: 'Editor',
  changedFields: ['title', 'payload'],
  createdAt: '2026-03-20T10:00:00.000Z',
  summary: 'Inhalt erstellt',
  ...overrides,
});

describe('ContentEditorPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    invalidatePermissionsMock.mockReset();
    useContentAccessMock.mockReset();
    useContentAccessMock.mockReturnValue(defaultAccess);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows resolver-driven payload errors and creates content via the shared RHF path', async () => {
    let createdPayload: unknown;

    studioMswServer.use(
      http.post('/api/v1/iam/contents', async ({ request }) => {
        createdPayload = await request.json();
        return HttpResponse.json({
          data: {
            id: 'content-created',
            contentType: 'generic',
            title: 'Landing Page',
            publishedAt: undefined,
            createdAt: '2026-03-21T10:00:00.000Z',
            updatedAt: '2026-03-21T10:00:00.000Z',
            author: 'Editor',
            payload: { hero: 'Willkommen' },
            status: 'draft',
            access: defaultAccess.access,
          },
        });
      })
    );

    render(<ContentEditorPage mode="create" />);

    expect(screen.getByRole('combobox', { name: 'Inhaltsbereiche' })).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Inhaltsbereiche' }) as HTMLSelectElement).value).toBe('general');
    expect(screen.getByRole('tabpanel', { name: /Allgemeine Angaben/i }).firstElementChild?.className).toContain(
      'bg-[rgb(var(--waste-panel-surface))]'
    );

    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Landing Page' },
    });
    fireEvent.change(screen.getByLabelText('Payload (JSON)'), {
      target: { value: '{"hero":' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Inhalt anlegen' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Die Payload muss gültiges JSON sein.');
    });

    expect(document.activeElement).toBe(screen.getByLabelText('Payload (JSON)'));
    expect(screen.getByLabelText('Payload (JSON)').getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(screen.getByLabelText('Payload (JSON)'), {
      target: { value: '{"hero":"Willkommen"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Inhalt anlegen' }));

    await waitFor(() => {
      expect(createdPayload).toEqual({
        contentType: 'generic',
        title: 'Landing Page',
        payload: { hero: 'Willkommen' },
        status: 'draft',
      });
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/content' });
    });
  });

  it('loads metadata and history in edit mode and updates content through HTTP', async () => {
    let currentContent = createContentDetail();
    const history = [createHistoryEntry()];
    let patchPayload: unknown;

    studioMswServer.use(
      http.get('/api/v1/iam/contents/content-1', () =>
        HttpResponse.json({
          data: currentContent,
        })
      ),
      http.get('/api/v1/iam/contents/content-1/history', () =>
        HttpResponse.json({
          data: history,
        })
      ),
      http.patch('/api/v1/iam/contents/content-1', async ({ request }) => {
        patchPayload = await request.json();
        currentContent = {
          ...currentContent,
          title: 'Neue Startseite',
          payload: { hero: 'Neu' },
        };
        return HttpResponse.json({
          data: currentContent,
        });
      })
    );

    render(<ContentEditorPage mode="edit" contentId="content-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Startseite')).toBeTruthy();
    });

    expect(screen.getByRole('heading', { name: 'Inhalt bearbeiten', level: 1 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Startseite', level: 2 })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Inhaltsbereiche' })).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Inhaltsbereiche' }) as HTMLSelectElement).value).toBe('general');
    expect(screen.getByText('Editor')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Änderungen speichern' })).toHaveLength(2);

    fireEvent.change(screen.getByRole('combobox', { name: 'Inhaltsbereiche' }), {
      target: { value: 'history' },
    });

    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: 'Inhaltsbereiche' }) as HTMLSelectElement).value).toBe('history');
    });

    const historyPanel = screen.getByRole('tabpanel', { name: /Historie/i });
    expect(within(historyPanel).getAllByText('Inhalt erstellt').length).toBeGreaterThan(0);
    expect(within(historyPanel).queryByRole('button', { name: 'Änderungen speichern' })).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: 'Inhaltsbereiche' }), {
      target: { value: 'general' },
    });

    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Neue Startseite' },
    });
    fireEvent.change(screen.getByLabelText('Payload (JSON)'), {
      target: { value: '{"hero":"Neu"}' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Änderungen speichern' })[1]!);

    await waitFor(() => {
      expect(patchPayload).toEqual({
        title: 'Neue Startseite',
        status: 'published',
        publishedAt: '2026-03-21T10:00:00.000Z',
        payload: { hero: 'Neu' },
      });
    });
  });

  it('blocks publishing without a date and keeps the server error on a failed create request', async () => {
    let createRequests = 0;

    studioMswServer.use(
      http.post('/api/v1/iam/contents', async () => {
        createRequests += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'database_unavailable',
              message: 'db down',
            },
          },
          { status: 503 }
        );
      })
    );

    render(<ContentEditorPage mode="create" />);

    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Landing Page' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'published' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Inhalt anlegen' }));

    await waitFor(() => {
      expect(createRequests).toBe(0);
      expect(screen.getByRole('alert').textContent).toContain(
        'Für veröffentlichte Inhalte ist ein Veröffentlichungsdatum erforderlich.'
      );
    });

    expect(document.activeElement).toBe(screen.getByLabelText('Veröffentlichungsdatum'));
    expect(screen.getByLabelText('Veröffentlichungsdatum').getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(screen.getByLabelText('Veröffentlichungsdatum'), {
      target: { value: '2026-03-22T12:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Inhalt anlegen' }));

    await waitFor(() => {
      expect(createRequests).toBe(1);
    });

    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByText('Die Inhaltsdaten konnten wegen eines Datenbankproblems nicht verarbeitet werden.')).toBeTruthy();
  });

  it('blocks saving when a non-empty publication date is invalid in Europe/Berlin', async () => {
    let updateRequests = 0;

    studioMswServer.use(
      http.get('/api/v1/iam/contents/content-4', () =>
        HttpResponse.json({
          data: createContentDetail({
            id: 'content-4',
            title: 'Mit Entwurf',
            publishedAt: undefined,
            status: 'draft',
            payload: { hero: 'Test' },
          }),
        })
      ),
      http.get('/api/v1/iam/contents/content-4/history', () =>
        HttpResponse.json({
          data: [],
        })
      ),
      http.patch('/api/v1/iam/contents/content-4', async () => {
        updateRequests += 1;
        return HttpResponse.json({ data: {} });
      })
    );

    render(<ContentEditorPage mode="edit" contentId="content-4" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Mit Entwurf')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Veröffentlichungsdatum'), {
      target: { value: '2026-03-29T02:30' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Änderungen speichern' })[1]!);

    await waitFor(() => {
      expect(updateRequests).toBe(0);
      expect(screen.getByRole('alert').textContent).toContain(
        'Bitte geben Sie ein gültiges Veröffentlichungsdatum in der Fachzeitzone Europe/Berlin ein.'
      );
    });

    expect(document.activeElement).toBe(screen.getByLabelText('Veröffentlichungsdatum'));
  });

  it('renders edit errors and hides the form when no content is available', async () => {
    studioMswServer.use(
      http.get('/api/v1/iam/contents/content-404', () =>
        HttpResponse.json(
          {
            error: {
              code: 'not_found',
              message: 'missing',
            },
          },
          { status: 404 }
        )
      ),
      http.get('/api/v1/iam/contents/content-404/history', () =>
        HttpResponse.json({
          data: [],
        })
      )
    );

    render(<ContentEditorPage mode="edit" contentId="content-404" />);

    await waitFor(() => {
      expect(screen.getByText('Der angeforderte Inhalt wurde nicht gefunden.')).toBeTruthy();
    });

    expect(screen.queryByLabelText('Titel')).toBeNull();
  });

  it('renders empty history and surfaces generic invalid request errors after an update failure', async () => {
    studioMswServer.use(
      http.get('/api/v1/iam/contents/content-2', () =>
        HttpResponse.json({
          data: createContentDetail({
            id: 'content-2',
            title: 'Ohne Datum',
            publishedAt: 'invalid-date',
            status: 'approved',
            payload: { hero: 'Test' },
          }),
        })
      ),
      http.get('/api/v1/iam/contents/content-2/history', () =>
        HttpResponse.json({
          data: [],
        })
      ),
      http.patch('/api/v1/iam/contents/content-2', async () =>
        HttpResponse.json(
          {
            error: {
              code: 'invalid_request',
              message: 'http_400',
            },
          },
          { status: 400 }
        )
      )
    );

    render(<ContentEditorPage mode="edit" contentId="content-2" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ohne Datum')).toBeTruthy();
    });

    expect((screen.getByLabelText('Veröffentlichungsdatum') as HTMLInputElement).value).toBe('');

    fireEvent.change(screen.getByRole('combobox', { name: 'Inhaltsbereiche' }), {
      target: { value: 'history' },
    });

    await waitFor(() => {
      expect(screen.getByRole('tabpanel', { name: /Historie/i }).textContent).toContain(
        'Für diesen Inhalt liegt noch keine Historie vor.'
      );
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Inhaltsbereiche' }), {
      target: { value: 'general' },
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Änderungen speichern' })[1]!);

    await waitFor(() => {
      expect(screen.getByText('Der Inhalt enthält ungültige oder unvollständige Daten.')).toBeTruthy();
    });
  });

  it('renders rate-limit errors in create mode after a failed save', async () => {
    studioMswServer.use(
      http.post('/api/v1/iam/contents', async () =>
        HttpResponse.json(
          {
            error: {
              code: 'rate_limited',
              message: 'too many requests',
            },
          },
          { status: 429 }
        )
      )
    );

    render(<ContentEditorPage mode="create" />);

    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Landing Page' },
    });
    fireEvent.change(screen.getByLabelText('Payload (JSON)'), {
      target: { value: '{"hero":"Willkommen"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Inhalt anlegen' }));

    await waitFor(() => {
      expect(screen.getByText('Zu viele Anfragen in kurzer Zeit. Bitte kurz warten und erneut versuchen.')).toBeTruthy();
    });
  });

  it('disables submit actions when the current content action is forbidden', () => {
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

    render(<ContentEditorPage mode="create" />);

    expect(
      screen.getByText(
        'Aktionen bleiben deaktiviert, bis die erforderlichen Berechtigungen im aktuellen Kontext vorliegen.'
      )
    ).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Inhalt anlegen' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders edit mode as read only when content access forbids updates', async () => {
    studioMswServer.use(
      http.get('/api/v1/iam/contents/content-read-only', () =>
        HttpResponse.json({
          data: createContentDetail({
            id: 'content-read-only',
            title: 'Read only',
            access: {
              state: 'read_only',
              canRead: true,
              canCreate: false,
              canUpdate: false,
              reasonCode: 'content_update_missing',
              organizationIds: ['org-2'],
              sourceKinds: ['group_role'],
            },
          }),
        })
      ),
      http.get('/api/v1/iam/contents/content-read-only/history', () =>
        HttpResponse.json({
          data: [],
        })
      )
    );

    render(<ContentEditorPage mode="edit" contentId="content-read-only" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Read only')).toBeTruthy();
    });

    expect(
      screen.getAllByText('Der Inhalt ist im aktuellen Kontext nur lesbar. Felder und Speichern bleiben deaktiviert.')
        .length
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Änderungen speichern' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect((screen.getByLabelText('Titel') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Nur lesbar')).toBeTruthy();
  });
});
