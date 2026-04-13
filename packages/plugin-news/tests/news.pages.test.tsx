import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { registerPluginTranslationResolver } from '@sva/sdk';

import { NewsCreatePage, NewsEditPage, NewsListPage } from '../src/news.pages.js';
import { createNews, deleteNews, listNews } from '../src/news.api.js';

vi.mock('../src/news.api.js', () => ({
  listNews: vi.fn(async () => []),
  getNews: vi.fn(async () => ({
    id: 'news-1',
    title: 'Bestehende News',
    contentType: 'news',
    payload: {
      teaser: 'Kurztext',
      body: '<p>Body</p>',
      category: 'Allgemein',
    },
    status: 'draft',
    author: 'Editor',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  })),
  createNews: vi.fn(async () => ({
    id: 'news-created',
  })),
  updateNews: vi.fn(async () => ({
    id: 'news-1',
  })),
  deleteNews: vi.fn(async () => undefined),
}));

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigateMock,
  useParams: () => ({ contentId: 'news-1' }),
}));

describe('NewsListPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    navigateMock.mockReset();
    window.sessionStorage.clear();
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'news.messages.loading': 'News werden geladen.',
        'news.messages.loadError': 'News konnten nicht geladen werden.',
        'news.messages.validationError': 'Bitte korrigieren Sie die markierten Felder.',
        'news.messages.createSuccess': 'News-Eintrag wurde erstellt.',
        'news.messages.updateSuccess': 'News-Eintrag wurde aktualisiert.',
        'news.messages.deleteSuccess': 'News-Eintrag wurde gelöscht.',
        'news.messages.deleteError': 'News-Eintrag konnte nicht gelöscht werden.',
        'news.empty.title': 'Noch keine News vorhanden',
        'news.empty.description': 'Legen Sie den ersten News-Eintrag an.',
        'news.list.title': 'News',
        'news.list.description': 'Verwalten Sie News-Einträge über das Plugin.',
        'news.actions.create': 'News anlegen',
        'news.actions.save': 'Änderungen speichern',
        'news.actions.back': 'Zurück zur Liste',
        'news.actions.delete': 'Löschen',
        'news.actions.deleteConfirm': 'Soll dieser News-Eintrag wirklich gelöscht werden?',
        'news.editor.createTitle': 'News-Eintrag anlegen',
        'news.editor.createDescription': 'Erstellen Sie einen neuen News-Eintrag.',
        'news.editor.editTitle': 'News-Eintrag bearbeiten',
        'news.editor.editDescription': 'Aktualisieren oder löschen Sie den News-Eintrag.',
        'news.fields.title': 'Titel',
        'news.fields.teaser': 'Teaser',
        'news.fields.teaserHelp': 'Kurzbeschreibung mit maximal 500 Zeichen.',
        'news.fields.body': 'Inhalt (HTML)',
        'news.fields.imageUrl': 'Bild-URL',
        'news.fields.externalUrl': 'Externe URL',
        'news.fields.category': 'Kategorie',
        'news.fields.status': 'Status',
        'news.fields.publishedAt': 'Veröffentlichungsdatum',
        'news.fields.updatedAt': 'Geändert am',
        'news.fields.actions': 'Aktionen',
        'news.actions.edit': 'Bearbeiten',
        'news.validation.teaser': 'Der Teaser ist erforderlich und darf maximal 500 Zeichen haben.',
        'news.validation.body': 'Der Inhalt ist erforderlich und darf maximal 50.000 Zeichen haben.',
        'news.validation.imageUrl': 'Die Bild-URL muss mit https:// beginnen.',
        'news.validation.externalUrl': 'Die externe URL muss mit https:// beginnen.',
        'news.status.draft': 'Entwurf',
        'news.status.inReview': 'In Prüfung',
        'news.status.approved': 'Freigegeben',
        'news.status.published': 'Veröffentlicht',
        'news.status.archived': 'Archiviert',
      };
      return labels[key] ?? key;
    });
  });

  it('renders the empty state when no news exist', async () => {
    render(<NewsListPage />);

    await waitFor(() => {
      expect(screen.getByText('Noch keine News vorhanden')).toBeTruthy();
    });
  });

  it('renders fetched news rows', async () => {
    vi.mocked(listNews).mockResolvedValueOnce([
      {
        id: 'news-1',
        title: 'Neuigkeit',
        contentType: 'news',
        payload: {
          teaser: 'Kurztext',
          body: '<p>Body</p>',
          category: 'Allgemein',
        },
        status: 'published',
        author: 'Editor',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);

    render(<NewsListPage />);

    await waitFor(() => {
      expect(screen.getByText('Neuigkeit')).toBeTruthy();
      expect(screen.getByText('Kurztext')).toBeTruthy();
      expect(screen.getByText('Veröffentlicht')).toBeTruthy();
      expect(screen.getByText('Bearbeiten')).toBeTruthy();
    });
  });

  it('shows validation feedback before creating invalid news', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'x'.repeat(501) } });
    fireEvent.change(screen.getByLabelText('Inhalt (HTML)'), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: 'News anlegen' }));

    await waitFor(() => {
      expect(screen.getByText('Bitte korrigieren Sie die markierten Felder.')).toBeTruthy();
      expect(screen.getByText('Der Teaser ist erforderlich und darf maximal 500 Zeichen haben.')).toBeTruthy();
      expect(screen.getByText('Der Inhalt ist erforderlich und darf maximal 50.000 Zeichen haben.')).toBeTruthy();
    });

    expect(screen.getByLabelText('Teaser').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Teaser').getAttribute('aria-describedby')).toBe('news-teaser-help news-teaser-error');
    expect(screen.getByLabelText('Inhalt (HTML)').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Inhalt (HTML)').getAttribute('aria-describedby')).toBe('news-body-error');

    expect(createNews).not.toHaveBeenCalled();
  });

  it('persists a create success flash before navigating back to the list', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt (HTML)'), { target: { value: '<p>Body</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'News anlegen' }));

    await waitFor(() => {
      expect(createNews).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Neue News',
          payload: expect.objectContaining({
            teaser: 'Kurztext',
            body: '<p>Body</p>',
          }),
        })
      );
      expect(window.sessionStorage.getItem('news-plugin-flash-message')).toBe('createSuccess');
      expect(navigateMock).toHaveBeenCalledWith({ to: '/plugins/news' });
    });
  });

  it('loads an existing news entry and deletes it after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende News')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(deleteNews).toHaveBeenCalledWith('news-1');
      expect(window.sessionStorage.getItem('news-plugin-flash-message')).toBe('deleteSuccess');
      expect(navigateMock).toHaveBeenCalledWith({ to: '/plugins/news' });
    });

    confirmSpy.mockRestore();
  });

  it('renders and consumes a flash message on the list page', async () => {
    window.sessionStorage.setItem('news-plugin-flash-message', 'createSuccess');

    render(<NewsListPage />);

    await waitFor(() => {
      expect(screen.getByText('News-Eintrag wurde erstellt.')).toBeTruthy();
    });

    expect(window.sessionStorage.getItem('news-plugin-flash-message')).toBeNull();
  });
});
