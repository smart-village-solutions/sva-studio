import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentListPage } from './-content-list-page';

const useContentsMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; params?: Record<string, string> }) => {
    const href =
      typeof params?.contentId === 'string' ? to.replace('$contentId', params.contentId) : to;
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

describe('ContentListPage', () => {
  beforeEach(() => {
    useContentsMock.mockReset();
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
    expect(screen.getByRole('link', { name: 'Neuer Inhalt' }).getAttribute('href')).toBe('/content/new');

    fireEvent.change(screen.getByLabelText('Suche'), {
      target: { value: 'archiv' },
    });

    expect(screen.queryByText('Startseite')).toBeNull();
    expect(screen.getByText('Archiv')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Bearbeiten' }).getAttribute('href')).toBe('/content/content-2');
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
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('invalid-date')).toBeTruthy();
  });

  it('renders forbidden errors and falls back for empty payload summaries', () => {
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
    expect(screen.getByText('{}')).toBeTruthy();
    expect(screen.getByText('Nicht gesetzt')).toBeTruthy();
  });
});
