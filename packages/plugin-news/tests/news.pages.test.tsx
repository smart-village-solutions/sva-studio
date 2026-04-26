import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { registerPluginTranslationResolver } from '@sva/plugin-sdk';

import { NewsCreatePage, NewsEditPage, NewsListPage } from '../src/news.pages.js';
import { NewsApiError, createNews, deleteNews, getNews, listNews, updateNews } from '../src/news.api.js';
import { NEWS_CONTENT_TYPE } from '../src/plugin.js';

vi.mock('../src/news.api.js', () => ({
  NewsApiError: class NewsApiError extends Error {
    public constructor(public readonly code: string) {
      super(code);
    }
  },
  listNews: vi.fn(async () => []),
  getNews: vi.fn(async () => ({
    id: 'news-1',
    title: 'Bestehende News',
    contentType: NEWS_CONTENT_TYPE,
    payload: {
      teaser: 'Kurztext',
      body: '<p>Body</p>',
      category: 'Allgemein',
    },
    status: 'published',
    author: 'Editor',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    publishedAt: '2026-01-02T00:00:00.000Z',
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
const paramsMock = vi.fn(() => ({ contentId: 'news-1' }));

const stubConfirm = (result: boolean) => {
  const confirmMock = vi.fn(() => result);
  Object.defineProperty(window, 'confirm', {
    configurable: true,
    writable: true,
    value: confirmMock,
  });
  return confirmMock;
};

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigateMock,
  useParams: () => paramsMock(),
}));

describe('NewsListPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    navigateMock.mockReset();
    paramsMock.mockReset();
    paramsMock.mockReturnValue({ contentId: 'news-1' });
    window.sessionStorage.clear();
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'news.messages.loading': 'News werden geladen.',
        'news.messages.loadError': 'News konnten nicht geladen werden.',
        'news.messages.missingContent': 'Der angeforderte News-Eintrag konnte nicht geladen werden.',
        'news.messages.saveError': 'News konnten nicht gespeichert werden.',
        'news.messages.validationError': 'Bitte korrigieren Sie die markierten Felder.',
        'news.messages.createSuccess': 'News-Eintrag wurde erstellt.',
        'news.messages.updateSuccess': 'News-Eintrag wurde aktualisiert.',
        'news.messages.deleteSuccess': 'News-Eintrag wurde gelöscht.',
        'news.messages.deleteError': 'News-Eintrag konnte nicht gelöscht werden.',
        'news.messages.errors.forbidden': 'Keine Berechtigung für Mainserver-News.',
        'news.messages.errors.graphqlError': 'Der Mainserver hat die News-Anfrage abgelehnt.',
        'news.messages.errors.invalidRequest': 'Die News-Anfrage ist ungültig.',
        'news.messages.errors.invalidResponse': 'Der Mainserver hat eine ungültige News-Antwort geliefert.',
        'news.messages.errors.missingCredentials': 'Mainserver-Credentials fehlen.',
        'news.messages.errors.missingInstance': 'Kein Instanzkontext vorhanden.',
        'news.messages.errors.networkError': 'Der Mainserver ist nicht erreichbar.',
        'news.empty.title': 'Noch keine News vorhanden',
        'news.empty.description': 'Legen Sie den ersten News-Eintrag an.',
        'news.list.title': 'News',
        'news.list.description': 'Verwalten Sie News-Einträge über das Plugin.',
        'news.actions.create': 'News anlegen',
        'news.actions.update': 'Änderungen speichern',
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
        'news.fields.publishedAt': 'Veröffentlichungsdatum',
        'news.fields.updatedAt': 'Geändert am',
        'news.fields.actions': 'Aktionen',
        'news.actions.edit': 'Bearbeiten',
        'news.validation.teaser': 'Der Teaser ist erforderlich und darf maximal 500 Zeichen haben.',
        'news.validation.body': 'Der Inhalt ist erforderlich und darf maximal 50.000 Zeichen haben.',
        'news.validation.imageUrl': 'Die Bild-URL muss mit https:// beginnen.',
        'news.validation.externalUrl': 'Die externe URL muss mit https:// beginnen.',
        'news.validation.publishedAt': 'Das Veröffentlichungsdatum ist erforderlich.',
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
        contentType: NEWS_CONTENT_TYPE,
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
      expect(screen.getByText('Bearbeiten')).toBeTruthy();
    });
  });

  it('renders fallback values for missing category and invalid update timestamps', async () => {
    vi.mocked(listNews).mockResolvedValueOnce([
      {
        id: 'news-2',
        title: 'Meldung',
        contentType: NEWS_CONTENT_TYPE,
        payload: {
          teaser: 'Kurztext',
          body: '<p>Body</p>',
        },
        status: 'published',
        author: 'Editor',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: 'invalid-date',
        publishedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    render(<NewsListPage />);

    await waitFor(() => {
      expect(screen.getByText('—')).toBeTruthy();
      expect(screen.getByText('invalid-date')).toBeTruthy();
    });
  });

  it('renders a load error when listing news fails', async () => {
    vi.mocked(listNews).mockRejectedValueOnce(new Error('boom'));

    render(<NewsListPage />);

    await waitFor(() => {
      expect(screen.getByText('News konnten nicht geladen werden.')).toBeTruthy();
    });
  });

  it('renders typed mainserver load errors with stable translations', async () => {
    vi.mocked(listNews).mockRejectedValueOnce(new NewsApiError('missing_credentials'));

    render(<NewsListPage />);

    await waitFor(() => {
      expect(screen.getByText('Mainserver-Credentials fehlen.')).toBeTruthy();
    });
  });

  it('shows validation feedback before creating invalid news', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'x'.repeat(501) } });
    fireEvent.change(screen.getByLabelText('Inhalt (HTML)'), { target: { value: ' ' } });
    fireEvent.change(screen.getByLabelText('Veröffentlichungsdatum'), { target: { value: '2026-04-14T09:30' } });
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

  it('rejects HTML-only body content before creating a news entry', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt (HTML)'), { target: { value: '<p><br></p>' } });
    fireEvent.change(screen.getByLabelText('Veröffentlichungsdatum'), { target: { value: '2026-04-14T09:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'News anlegen' }));

    await waitFor(() => {
      expect(screen.getByText('Der Inhalt ist erforderlich und darf maximal 50.000 Zeichen haben.')).toBeTruthy();
    });

    expect(createNews).not.toHaveBeenCalled();
  });

  it('requires a publication date before creating a news entry', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt (HTML)'), { target: { value: '<p>Body</p>' } });
    fireEvent.submit(screen.getByRole('button', { name: 'News anlegen' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Das Veröffentlichungsdatum ist erforderlich.')).toBeTruthy();
    });

    expect(screen.getByLabelText('Veröffentlichungsdatum').getAttribute('aria-invalid')).toBe('true');
    expect(createNews).not.toHaveBeenCalled();
  });

  it('persists a create success flash before navigating back to the list', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt (HTML)'), { target: { value: '<p>Body</p>' } });
    fireEvent.change(screen.getByLabelText('Veröffentlichungsdatum'), { target: { value: '2026-04-14T09:30' } });
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

  it('shows a save error when creating news fails', async () => {
    vi.mocked(createNews).mockRejectedValueOnce(new NewsApiError('forbidden'));

    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt (HTML)'), { target: { value: '<p>Body</p>' } });
    fireEvent.change(screen.getByLabelText('Veröffentlichungsdatum'), { target: { value: '2026-04-14T09:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'News anlegen' }));

    await waitFor(() => {
      expect(screen.getByText('Keine Berechtigung für Mainserver-News.')).toBeTruthy();
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows a load error when loading an existing news entry fails', async () => {
    vi.mocked(getNews).mockRejectedValueOnce(new Error('load failed'));

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByText('News konnten nicht geladen werden.')).toBeTruthy();
      expect(screen.queryByText('News werden geladen.')).toBeNull();
    });
  });

  it('shows a fallback error when editing without a content id', async () => {
    paramsMock.mockReturnValue({});

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByText('Der angeforderte News-Eintrag konnte nicht geladen werden.')).toBeTruthy();
      expect(screen.queryByText('News werden geladen.')).toBeNull();
    });

    expect(getNews).not.toHaveBeenCalled();
  });

  it('shows an inline success message after updating an existing news entry', async () => {
    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende News')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Aktualisierte News' } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => {
      expect(updateNews).toHaveBeenCalledWith(
        'news-1',
        expect.objectContaining({
          title: 'Aktualisierte News',
        }),
      );
      expect(screen.getByText('News-Eintrag wurde aktualisiert.')).toBeTruthy();
    });
  });

  it('shows a save error when updating an existing news entry fails', async () => {
    vi.mocked(updateNews).mockRejectedValueOnce(new NewsApiError('graphql_error'));

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende News')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => {
      expect(screen.getByText('Der Mainserver hat die News-Anfrage abgelehnt.')).toBeTruthy();
    });
  });

  it('loads an existing news entry and deletes it after confirmation', async () => {
    stubConfirm(true);

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
  });

  it('does not delete an entry when the user cancels the confirmation dialog', async () => {
    const confirmSpy = stubConfirm(false);

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende News')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Soll dieser News-Eintrag wirklich gelöscht werden?');
    });

    expect(deleteNews).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows a delete error when deleting an existing news entry fails', async () => {
    stubConfirm(true);
    vi.mocked(deleteNews).mockRejectedValueOnce(new NewsApiError('network_error'));

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende News')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(screen.getByText('Der Mainserver ist nicht erreichbar.')).toBeTruthy();
    });

    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Löschen' }).getAttribute('disabled')).toBeNull();
  });

  it('renders and consumes a flash message on the list page', async () => {
    window.sessionStorage.setItem('news-plugin-flash-message', 'createSuccess');

    render(<NewsListPage />);

    await waitFor(() => {
      expect(screen.getByText('News-Eintrag wurde erstellt.')).toBeTruthy();
    });

    expect(window.sessionStorage.getItem('news-plugin-flash-message')).toBeNull();
  });

  it('ignores unsupported flash messages on the list page', async () => {
    window.sessionStorage.setItem('news-plugin-flash-message', 'unsupported');

    render(<NewsListPage />);

    await waitFor(() => {
      expect(screen.getByText('Noch keine News vorhanden')).toBeTruthy();
    });

    expect(screen.queryByText('News-Eintrag wurde erstellt.')).toBeNull();
    expect(window.sessionStorage.getItem('news-plugin-flash-message')).toBeNull();
  });

  it('converts ISO timestamps into datetime-local field values during edit', async () => {
    vi.mocked(getNews).mockResolvedValueOnce({
      id: 'news-3',
      title: 'Termin',
      contentType: NEWS_CONTENT_TYPE,
      payload: {
        teaser: 'Kurztext',
        body: '<p>Body</p>',
      },
      status: 'published',
      author: 'Editor',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      publishedAt: '2026-04-14T09:30:00.000Z',
    });

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Veröffentlichungsdatum').getAttribute('value')).toMatch(
        /^2026-04-14T\d{2}:30$/
      );
    });
  });
});
