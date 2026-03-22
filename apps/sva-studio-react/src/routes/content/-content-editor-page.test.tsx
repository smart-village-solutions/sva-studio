import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentEditorPage } from './-content-editor-page';

const useCreateContentMock = vi.fn();
const useContentDetailMock = vi.fn();
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

describe('ContentEditorPage', () => {
  beforeEach(() => {
    useCreateContentMock.mockReset();
    useContentDetailMock.mockReset();
    navigateMock.mockReset();
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
});
