import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { registerPluginTranslationResolver } from '@sva/plugin-sdk';

import { NewsCreatePage, NewsEditPage, NewsListPage } from '../src/news.pages.js';
import { NewsApiError, createNews, deleteNews, getNews, listNews, updateNews } from '../src/news.api.js';
import { NEWS_CONTENT_TYPE } from '../src/plugin.js';

vi.mock('../src/news.api.js', () => ({
  NewsApiError: class NewsApiError extends Error {
    public constructor(
      public readonly code: string,
      message = code
    ) {
      super(message);
      this.name = 'NewsApiError';
    }
  },
  listNews: vi.fn(async () => ({
    data: [],
    pagination: { page: 1, pageSize: 25, hasNextPage: false },
  })),
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
const searchMock = vi.fn(() => ({ page: 1, pageSize: 25 }));

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
  useSearch: () => searchMock(),
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
    searchMock.mockReset();
    paramsMock.mockReturnValue({ contentId: 'news-1' });
    searchMock.mockReturnValue({ page: 1, pageSize: 25 });
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
        'news.pagination.ariaLabel': 'News-Pagination',
        'news.pagination.previous': 'Zurück',
        'news.pagination.next': 'Weiter',
        'news.pagination.pageLabel': 'Seite {{page}}',
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
        'news.fields.author': 'Autor',
        'news.fields.keywords': 'Schlagwörter',
        'news.fields.externalId': 'Externe ID',
        'news.fields.newsType': 'News-Typ',
        'news.fields.fullVersion': 'Vollversion',
        'news.fields.charactersToBeShown': 'Zeichenbegrenzung',
        'news.fields.publishedAt': 'Veröffentlichungsdatum',
        'news.fields.publicationDate': 'Publikationsdatum',
        'news.fields.showPublishDate': 'Publikationsdatum anzeigen',
        'news.fields.pushNotification': 'Push-Benachrichtigung senden',
        'news.fields.categoryName': 'Kategorie',
        'news.fields.categories': 'Kategorien',
        'news.fields.categoriesHelp': 'Eine Kategorie pro Zeile.',
        'news.fields.sourceUrl': 'Quell-URL',
        'news.fields.sourceUrlDescription': 'Quellbeschreibung',
        'news.fields.street': 'Straße',
        'news.fields.zip': 'PLZ',
        'news.fields.city': 'Ort',
        'news.fields.pointOfInterestId': 'POI-ID',
        'news.fields.contentBlocks': 'Inhaltsblöcke',
        'news.fields.contentBlock': 'Inhaltsblock',
        'news.fields.blockTitle': 'Blocktitel',
        'news.fields.blockIntro': 'Einleitung',
        'news.fields.blockBody': 'Inhalt',
        'news.fields.mediaContents': 'Medien',
        'news.fields.mediaUrl': 'Medien-URL',
        'news.fields.mediaCaption': 'Bildunterschrift',
        'news.fields.mediaContentType': 'Medientyp',
        'news.fields.technicalDetails': 'Technische Details',
        'news.fields.dataProvider': 'Datenanbieter',
        'news.fields.visible': 'Sichtbar',
        'news.fields.likeCount': 'Likes',
        'news.fields.likedByMe': 'Von mir geliked',
        'news.fields.pushNotificationsSentAt': 'Push gesendet am',
        'news.fields.settings': 'Einstellungen',
        'news.fields.announcements': 'Ankündigungen',
        'news.fields.updatedAt': 'Geändert am',
        'news.fields.actions': 'Aktionen',
        'news.values.yes': 'Ja',
        'news.values.no': 'Nein',
        'news.actions.edit': 'Bearbeiten',
        'news.actions.addContentBlock': 'Inhaltsblock hinzufügen',
        'news.actions.addMedia': 'Medium hinzufügen',
        'news.actions.remove': 'Entfernen',
        'news.validation.contentBlocks': 'Mindestens ein Inhaltsblock benötigt Inhalt und darf maximal 50.000 Zeichen haben.',
        'news.validation.sourceUrl': 'Die Quell-URL muss mit https:// beginnen.',
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
    vi.mocked(listNews).mockResolvedValueOnce({
      data: [
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
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    render(<NewsListPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Neuigkeit').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Kurztext').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Bearbeiten').length).toBeGreaterThan(0);
    });
  });

  it('reads pagination values from the browser query string', async () => {
    searchMock.mockReturnValueOnce({ page: 3, pageSize: 50 });

    render(<NewsListPage />);

    await waitFor(() => {
      expect(listNews).toHaveBeenCalledWith({ page: 3, pageSize: 50 });
    });
  });

  it('normalizes invalid browser query values before loading news', async () => {
    searchMock.mockReturnValueOnce({ page: 9999, pageSize: 13 });

    render(<NewsListPage />);

    await waitFor(() => {
      expect(listNews).toHaveBeenCalledWith({ page: 401, pageSize: 25 });
    });

    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/plugins/news',
        replace: true,
        search: expect.any(Function),
      })
    );
    const navigateCall = navigateMock.mock.calls[0]?.[0] as {
      search?: (current: Record<string, unknown>) => Record<string, unknown>;
    };
    expect(navigateCall.search?.({ keep: 'value' })).toEqual({
      keep: 'value',
      page: 401,
      pageSize: 25,
    });
  });

  it('renders fallback values for missing category and invalid update timestamps', async () => {
    vi.mocked(listNews).mockResolvedValueOnce({
      data: [
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
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    render(<NewsListPage />);

    await waitFor(() => {
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
      expect(screen.getAllByText('invalid-date').length).toBeGreaterThan(0);
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

  it('clears a stale load error before refetching with updated pagination', async () => {
    vi.mocked(listNews)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 2, pageSize: 50, hasNextPage: false },
      });

    const { rerender } = render(<NewsListPage />);

    await waitFor(() => {
      expect(screen.getByText('News konnten nicht geladen werden.')).toBeTruthy();
    });

    searchMock.mockReturnValue({ page: 2, pageSize: 50 });
    rerender(<NewsListPage />);

    expect(screen.queryByText('News konnten nicht geladen werden.')).toBeNull();

    await waitFor(() => {
      expect(listNews).toHaveBeenLastCalledWith({ page: 2, pageSize: 50 });
      expect(screen.getByText('Noch keine News vorhanden')).toBeTruthy();
    });
  });

  it('shows validation feedback before creating invalid news', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: ' ' } });
    fireEvent.change(screen.getByLabelText('Veröffentlichungsdatum'), { target: { value: '2026-04-14T09:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'News anlegen' }));

    await waitFor(() => {
      expect(screen.getByText('Bitte korrigieren Sie die markierten Felder.')).toBeTruthy();
      expect(screen.getByText('Mindestens ein Inhaltsblock benötigt Inhalt und darf maximal 50.000 Zeichen haben.')).toBeTruthy();
    });

    expect(screen.getByLabelText('Inhalt').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Inhalt').getAttribute('aria-describedby')).toBe('news-content-blocks-error');

    expect(createNews).not.toHaveBeenCalled();
  });

  it('rejects HTML-only body content before creating a news entry', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    fireEvent.change(screen.getByLabelText('Einleitung'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p><br></p>' } });
    fireEvent.change(screen.getByLabelText('Veröffentlichungsdatum'), { target: { value: '2026-04-14T09:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'News anlegen' }));

    await waitFor(() => {
      expect(screen.getByText('Mindestens ein Inhaltsblock benötigt Inhalt und darf maximal 50.000 Zeichen haben.')).toBeTruthy();
    });

    expect(createNews).not.toHaveBeenCalled();
  });

  it('requires a publication date before creating a news entry', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    fireEvent.change(screen.getByLabelText('Einleitung'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p>Body</p>' } });
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
    fireEvent.change(screen.getByLabelText('Einleitung'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p>Body</p>' } });
    fireEvent.change(screen.getByLabelText('Veröffentlichungsdatum'), { target: { value: '2026-04-14T09:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'News anlegen' }));

    await waitFor(() => {
      expect(createNews).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Neue News',
          contentBlocks: [expect.objectContaining({ intro: 'Kurztext', body: '<p>Body</p>' })],
        })
      );
      expect(window.sessionStorage.getItem('news-plugin-flash-message')).toBe('createSuccess');
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/news' });
    });
  });

  it('submits the extended Mainserver news model without a legacy payload', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Volle News' } });
    fireEvent.change(screen.getByLabelText('Autor'), { target: { value: 'Redaktion' } });
    fireEvent.change(screen.getByLabelText('Schlagwörter'), { target: { value: 'Rathaus, Termin' } });
    fireEvent.change(screen.getByLabelText('Externe ID'), { target: { value: 'ext-42' } });
    fireEvent.change(screen.getByLabelText('News-Typ'), { target: { value: 'press' } });
    fireEvent.change(screen.getByLabelText('Zeichenbegrenzung'), { target: { value: '240' } });
    fireEvent.click(screen.getByLabelText('Vollversion'));
    fireEvent.click(screen.getByLabelText('Push-Benachrichtigung senden'));
    fireEvent.change(screen.getByLabelText('Veröffentlichungsdatum'), { target: { value: '2026-04-14T09:30' } });
    fireEvent.change(screen.getByLabelText('Publikationsdatum'), { target: { value: '2026-04-14T08:00' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Kategorie', exact: true }), {
      target: { value: 'Allgemein' },
    });
    fireEvent.change(screen.getByLabelText('Kategorien'), { target: { value: 'Allgemein\nRathaus' } });
    fireEvent.change(screen.getByLabelText('Quell-URL'), { target: { value: 'https://example.com/news' } });
    fireEvent.change(screen.getByLabelText('Quellbeschreibung'), { target: { value: 'Quelle' } });
    fireEvent.change(screen.getByLabelText('Straße'), { target: { value: 'Markt 1' } });
    fireEvent.change(screen.getByLabelText('PLZ'), { target: { value: '12345' } });
    fireEvent.change(screen.getByLabelText('Ort'), { target: { value: 'Musterhausen' } });
    fireEvent.change(screen.getByLabelText('POI-ID'), { target: { value: 'poi-1' } });
    fireEvent.change(screen.getByLabelText('Blocktitel'), { target: { value: 'Abschnitt' } });
    fireEvent.change(screen.getByLabelText('Einleitung'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p>Inhalt</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Medium hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Medien-URL'), { target: { value: 'https://example.com/image.jpg' } });
    fireEvent.change(screen.getByLabelText('Bildunterschrift'), { target: { value: 'Bild' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Entfernen' })[1] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Medium hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Medien-URL'), { target: { value: 'https://example.com/image.jpg' } });
    fireEvent.change(screen.getByLabelText('Bildunterschrift'), { target: { value: 'Bild' } });
    fireEvent.click(screen.getByRole('button', { name: 'Inhaltsblock hinzufügen' }));
    const removeButtons = screen.getAllByRole('button', { name: 'Entfernen' });
    fireEvent.click(removeButtons[removeButtons.length - 1] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'News anlegen' }));

    await waitFor(() => {
      expect(createNews).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Volle News',
          author: 'Redaktion',
          keywords: 'Rathaus, Termin',
          externalId: 'ext-42',
          fullVersion: true,
          charactersToBeShown: 240,
          newsType: 'press',
          categoryName: 'Allgemein',
          categories: [{ name: 'Allgemein' }, { name: 'Rathaus' }],
          sourceUrl: { url: 'https://example.com/news', description: 'Quelle' },
          address: expect.objectContaining({ street: 'Markt 1', zip: '12345', city: 'Musterhausen' }),
          pointOfInterestId: 'poi-1',
          pushNotification: true,
          contentBlocks: [
            expect.objectContaining({
              title: 'Abschnitt',
              intro: 'Kurztext',
              body: '<p>Inhalt</p>',
              mediaContents: [expect.objectContaining({ sourceUrl: { url: 'https://example.com/image.jpg' } })],
            }),
          ],
        })
      );
      expect(createNews).not.toHaveBeenCalledWith(expect.objectContaining({ payload: expect.anything() }));
    });
  });

  it('shows a save error when creating news fails', async () => {
    vi.mocked(createNews).mockRejectedValueOnce(new NewsApiError('forbidden'));

    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    fireEvent.change(screen.getByLabelText('Einleitung'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p>Body</p>' } });
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

  it('loads and updates a full Mainserver news item without create-only or legacy fields', async () => {
    vi.mocked(getNews).mockResolvedValueOnce({
      id: 'news-full',
      title: 'Bestehende volle News',
      contentType: NEWS_CONTENT_TYPE,
      payload: {},
      status: 'published',
      author: 'Redaktion',
      keywords: 'Markt, Kultur',
      externalId: 'external-7',
      fullVersion: true,
      charactersToBeShown: '160',
      newsType: 'press',
      publicationDate: '2026-04-14T08:00:00.000Z',
      showPublishDate: false,
      categoryName: 'Kultur',
      categories: [{ name: 'Kultur' }, { name: 'Rathaus' }],
      sourceUrl: { url: 'https://example.com/source', description: 'Quelle' },
      address: { street: 'Markt 1', zip: '12345', city: 'Musterhausen' },
      contentBlocks: [
        {
          title: 'Abschnitt',
          intro: 'Kurztext',
          body: '<p>Langtext</p>',
          mediaContents: [
            {
              contentType: 'image',
              captionText: 'Titelbild',
              sourceUrl: { url: 'https://example.com/image.jpg' },
            },
          ],
        },
      ],
      pointOfInterestId: 'poi-7',
      dataProvider: { id: 'dp-1', name: 'Datenquelle' },
      settings: { alwaysRecreateOnImport: 'false', displayOnlySummary: 'true', onlySummaryLinkText: 'Mehr' },
      announcements: [{ id: 'announcement-1', title: 'Hinweis' }],
      likeCount: 3,
      likedByMe: false,
      visible: true,
      pushNotificationsSentAt: '2026-04-14T10:00:00.000Z',
      createdAt: '2026-04-13T00:00:00.000Z',
      updatedAt: '2026-04-14T00:00:00.000Z',
      publishedAt: '2026-04-14T09:30:00.000Z',
    });

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende volle News')).toBeTruthy();
      expect(screen.getByDisplayValue('160')).toBeTruthy();
      expect(screen.getByDisplayValue('https://example.com/source')).toBeTruthy();
      expect(screen.getByDisplayValue('https://example.com/image.jpg')).toBeTruthy();
      expect(screen.getByText('Technische Details')).toBeTruthy();
      expect(screen.getByText('Datenquelle')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
    });

    expect(screen.queryByLabelText('Push-Benachrichtigung senden')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => {
      expect(updateNews).toHaveBeenCalledWith(
        'news-1',
        expect.objectContaining({
          title: 'Bestehende volle News',
          author: 'Redaktion',
          keywords: 'Markt, Kultur',
          externalId: 'external-7',
          fullVersion: true,
          charactersToBeShown: 160,
          newsType: 'press',
          categoryName: 'Kultur',
          categories: [{ name: 'Kultur' }, { name: 'Rathaus' }],
          sourceUrl: { url: 'https://example.com/source', description: 'Quelle' },
          address: expect.objectContaining({ street: 'Markt 1', zip: '12345', city: 'Musterhausen' }),
          pointOfInterestId: 'poi-7',
          contentBlocks: [
            expect.objectContaining({
              title: 'Abschnitt',
              intro: 'Kurztext',
              body: '<p>Langtext</p>',
              mediaContents: [
                expect.objectContaining({
                  contentType: 'image',
                  captionText: 'Titelbild',
                  sourceUrl: { url: 'https://example.com/image.jpg' },
                }),
              ],
            }),
          ],
        })
      );
      expect(updateNews).not.toHaveBeenCalledWith('news-1', expect.objectContaining({ payload: expect.anything() }));
      expect(updateNews).not.toHaveBeenCalledWith(
        'news-1',
        expect.objectContaining({ pushNotification: expect.anything() })
      );
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
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/news' });
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

  it('clears invalid publication timestamps during edit loading', async () => {
    vi.mocked(getNews).mockResolvedValueOnce({
      id: 'news-4',
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
      publishedAt: 'invalid-date',
    });

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Veröffentlichungsdatum').getAttribute('value')).toBe('');
    });
  });
});
