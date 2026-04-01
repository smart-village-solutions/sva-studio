import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentEditorPage } from './-content-editor-page';

const useCreateContentMock = vi.fn();
const useContentDetailMock = vi.fn();
const useContentAccessMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../hooks/use-contents', () => ({
  useCreateContent: () => useCreateContentMock(),
  useContentDetail: (...args: unknown[]) => useContentDetailMock(...args),
}));

vi.mock('../../hooks/use-content-access', () => ({
  useContentAccess: () => useContentAccessMock(),
}));

describe('ContentEditorPage', () => {
  beforeEach(() => {
    useCreateContentMock.mockReset();
    useContentDetailMock.mockReset();
    useContentAccessMock.mockReset();
    navigateMock.mockReset();
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

  it('creates content and validates invalid JSON locally', async () => {
    const createContent = vi.fn().mockResolvedValue(true);
    useCreateContentMock.mockReturnValue({
      mutationError: null,
      clearMutationError: vi.fn(),
      createContent,
    });
    useContentDetailMock.mockReturnValue({
      content: null,
      history: [],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateContent: vi.fn(),
    });

    render(<ContentEditorPage mode="create" />);

    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Landing Page' },
    });
    fireEvent.change(screen.getByLabelText('Payload (JSON)'), {
      target: { value: '{"hero":' },
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Inhalt anlegen' }).closest('form')!);
    expect(screen.getByText('Die Payload muss gültiges JSON sein.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Payload (JSON)'), {
      target: { value: '{"hero":"Willkommen"}' },
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Inhalt anlegen' }).closest('form')!);

    await waitFor(() => {
      expect(createContent).toHaveBeenCalledWith({
        contentType: 'generic',
        title: 'Landing Page',
        payload: { hero: 'Willkommen' },
        status: 'draft',
        publishedAt: undefined,
      });
      expect(navigateMock).toHaveBeenCalledWith({ to: '/content' });
    });
  });

  it('renders metadata and history in edit mode and submits updates', async () => {
    const updateContent = vi.fn().mockResolvedValue(true);
    useCreateContentMock.mockReturnValue({
      mutationError: null,
      clearMutationError: vi.fn(),
      createContent: vi.fn(),
    });
    useContentDetailMock.mockReturnValue({
      content: {
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
        history: [],
      },
      history: [
        {
          id: 'history-1',
          contentId: 'content-1',
          action: 'created',
          actor: 'Editor',
          changedFields: ['title', 'payload'],
          createdAt: '2026-03-20T10:00:00.000Z',
          summary: 'Inhalt erstellt',
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateContent,
    });

    render(<ContentEditorPage mode="edit" contentId="content-1" />);

    expect(screen.getByDisplayValue('Startseite')).toBeTruthy();
    expect(screen.getByText('Editor')).toBeTruthy();
    expect(screen.getAllByText('Inhalt erstellt')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Neue Startseite' },
    });
    fireEvent.change(screen.getByLabelText('Payload (JSON)'), {
      target: { value: '{"hero":"Neu"}' },
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Änderungen speichern' }).closest('form')!);

    await waitFor(() => {
      expect(updateContent).toHaveBeenCalledWith({
        title: 'Neue Startseite',
        status: 'published',
        publishedAt: '2026-03-21T10:00:00.000Z',
        payload: { hero: 'Neu' },
      });
    });
  });

  it('blocks publishing without date and does not navigate when create fails', async () => {
    const createContent = vi.fn().mockResolvedValue(false);
    useCreateContentMock.mockReturnValue({
      mutationError: { code: 'database_unavailable', status: 503, message: 'db down' },
      clearMutationError: vi.fn(),
      createContent,
    });
    useContentDetailMock.mockReturnValue({
      content: null,
      history: [],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateContent: vi.fn(),
    });

    render(<ContentEditorPage mode="create" />);

    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Landing Page' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'published' },
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Inhalt anlegen' }).closest('form')!);
    expect(screen.getByText('Für veröffentlichte Inhalte ist ein Veröffentlichungsdatum erforderlich.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Veröffentlichungsdatum'), {
      target: { value: '2026-03-22T12:00' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Inhalt anlegen' }).closest('form')!);

    await waitFor(() => {
      expect(createContent).toHaveBeenCalled();
      expect(navigateMock).not.toHaveBeenCalled();
    });

    expect(screen.getByText('Die Inhaltsdaten konnten wegen eines Datenbankproblems nicht verarbeitet werden.')).toBeTruthy();
  });

  it('renders edit errors and hides the form when no content is available', () => {
    useCreateContentMock.mockReturnValue({
      mutationError: null,
      clearMutationError: vi.fn(),
      createContent: vi.fn(),
    });
    useContentDetailMock.mockReturnValue({
      content: null,
      history: [],
      isLoading: false,
      error: { code: 'not_found', status: 404, message: 'missing' },
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateContent: vi.fn(),
    });

    render(<ContentEditorPage mode="edit" contentId="content-1" />);

    expect(screen.getByText('Der angeforderte Inhalt wurde nicht gefunden.')).toBeTruthy();
    expect(screen.queryByLabelText('Titel')).toBeNull();
  });

  it('renders edit mode fallback metadata, empty history and generic validation errors', async () => {
    const updateContent = vi.fn();
    useCreateContentMock.mockReturnValue({
      mutationError: { code: 'invalid_request', status: 400, message: 'http_400' },
      clearMutationError: vi.fn(),
      createContent: vi.fn(),
    });
    useContentDetailMock.mockReturnValue({
      content: {
        id: 'content-2',
        contentType: 'generic',
        title: 'Ohne Datum',
        publishedAt: 'invalid-date',
        createdAt: undefined,
        updatedAt: undefined,
        author: 'Editor',
        payload: { hero: 'Test' },
        status: 'approved',
        access: {
          state: 'editable',
          canRead: true,
          canCreate: true,
          canUpdate: true,
          organizationIds: [],
          sourceKinds: [],
        },
        history: [],
      },
      history: [],
      isLoading: false,
      error: null,
      mutationError: { code: 'invalid_request', status: 400, message: 'http_400' },
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateContent,
    });

    render(<ContentEditorPage mode="edit" contentId="content-2" />);

    expect((screen.getByLabelText('Veröffentlichungsdatum') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Für diesen Inhalt liegt noch keine Historie vor.')).toBeTruthy();
    expect(screen.getByText('Der Inhalt enthält ungültige oder unvollständige Daten.')).toBeTruthy();

    fireEvent.submit(screen.getByRole('button', { name: 'Änderungen speichern' }).closest('form')!);

    await waitFor(() => {
      expect(updateContent).toHaveBeenCalledWith({
        title: 'Ohne Datum',
        status: 'approved',
        publishedAt: undefined,
        payload: { hero: 'Test' },
      });
    });
  });

  it('renders history entries without optional summary fields and ignores submits without a content id', async () => {
    const updateContent = vi.fn();
    useCreateContentMock.mockReturnValue({
      mutationError: null,
      clearMutationError: vi.fn(),
      createContent: vi.fn(),
    });
    useContentDetailMock.mockReturnValue({
      content: {
        id: 'content-3',
        contentType: 'generic',
        title: 'Ohne Summary',
        publishedAt: '2026-03-21T10:00:00.000Z',
        createdAt: '2026-03-20T10:00:00.000Z',
        updatedAt: '2026-03-21T11:00:00.000Z',
        author: 'Editor',
        payload: { hero: 'Test' },
        status: 'draft',
        access: {
          state: 'editable',
          canRead: true,
          canCreate: true,
          canUpdate: true,
          organizationIds: [],
          sourceKinds: [],
        },
        history: [],
      },
      history: [
        {
          id: 'history-2',
          contentId: 'content-3',
          action: 'updated',
          actor: 'Editor',
          changedFields: [],
          createdAt: '2026-03-21T12:00:00.000Z',
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateContent,
    });

    render(<ContentEditorPage mode="edit" />);

    expect(screen.getByText('Inhalt aktualisiert')).toBeTruthy();
    expect(screen.queryByText(/Geänderte Felder:/)).toBeNull();

    fireEvent.submit(screen.getByRole('button', { name: 'Änderungen speichern' }).closest('form')!);

    await waitFor(() => {
      expect(updateContent).not.toHaveBeenCalled();
    });
  });

  it('renders rate-limit errors in create mode', () => {
    useCreateContentMock.mockReturnValue({
      mutationError: { code: 'rate_limited', status: 429, message: 'too many requests' },
      clearMutationError: vi.fn(),
      createContent: vi.fn(),
    });
    useContentDetailMock.mockReturnValue({
      content: null,
      history: [],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateContent: vi.fn(),
    });

    render(<ContentEditorPage mode="create" />);

    expect(screen.getByText('Zu viele Anfragen in kurzer Zeit. Bitte kurz warten und erneut versuchen.')).toBeTruthy();
  });

  it('disables submit actions when the current content action is forbidden', () => {
    useCreateContentMock.mockReturnValue({
      mutationError: null,
      clearMutationError: vi.fn(),
      createContent: vi.fn(),
    });
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
    useContentDetailMock.mockReturnValue({
      content: null,
      history: [],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateContent: vi.fn(),
    });

    render(<ContentEditorPage mode="create" />);

    expect(screen.getByText('Aktionen bleiben deaktiviert, bis die erforderlichen Berechtigungen im aktuellen Kontext vorliegen.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Inhalt anlegen' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders edit mode as read only when content access forbids updates', () => {
    useCreateContentMock.mockReturnValue({
      mutationError: null,
      clearMutationError: vi.fn(),
      createContent: vi.fn(),
    });
    useContentDetailMock.mockReturnValue({
      content: {
        id: 'content-4',
        contentType: 'generic',
        title: 'Read only',
        publishedAt: '2026-03-21T10:00:00.000Z',
        createdAt: '2026-03-20T10:00:00.000Z',
        updatedAt: '2026-03-21T11:00:00.000Z',
        author: 'Editor',
        payload: { hero: 'Test' },
        status: 'published',
        access: {
          state: 'read_only',
          canRead: true,
          canCreate: false,
          canUpdate: false,
          reasonCode: 'content_update_missing',
          organizationIds: ['org-2'],
          sourceKinds: ['group_role'],
        },
        history: [],
      },
      history: [],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateContent: vi.fn(),
    });

    render(<ContentEditorPage mode="edit" contentId="content-4" />);

    expect(screen.getAllByText('Der Inhalt ist im aktuellen Kontext nur lesbar. Felder und Speichern bleiben deaktiviert.').length).toBeGreaterThan(0);
    expect((screen.getByRole('button', { name: 'Änderungen speichern' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Titel') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Nur lesbar')).toBeTruthy();
  });
});
