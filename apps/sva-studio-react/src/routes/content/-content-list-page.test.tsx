import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentListPage } from './-content-list-page';

const useContentsMock = vi.fn();
const useContentAccessMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
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
    });

    render(<ContentListPage />);

    expect(screen.getByRole('heading', { name: 'Inhalte' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Neuer Inhalt' }).getAttribute('href')).toBe('/admin/content/new');

    fireEvent.change(screen.getByLabelText('Suche'), {
      target: { value: 'archiv' },
    });

    expect(screen.queryByText('Startseite')).toBeNull();
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
    });

    render(<ContentListPage />);

    expect(screen.getByText('Inhalte konnten nicht geladen werden.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'published' },
    });

    expect(screen.queryByText('Startseite')).toBeNull();
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
    });

    render(<ContentListPage />);

    expect(screen.getByText('Unzureichende Berechtigungen für diese Inhaltsaktion.')).toBeTruthy();
    expect(screen.getByText('Aktueller Zugriffsstatus: Serverseitig verweigert. Kein zusätzlicher Kontext')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Neuer Inhalt' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Gesperrt' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getAllByText('{}').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nicht gesetzt').length).toBeGreaterThan(0);
  });
});
