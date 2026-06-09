import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchIamContentHistory,
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  registerPluginTranslationResolver,
  replaceHostMediaReferences,
} from '@sva/plugin-sdk';

import { NewsCreatePage, NewsEditPage } from '../src/news.pages.js';
import {
  NewsApiError,
  createNews,
  deleteNews,
  getNews,
  listNewsCategories,
  updateNews,
} from '../src/news.api.js';
import { NEWS_CONTENT_TYPE } from '../src/plugin.js';

vi.mock('../src/news.api.js', async () => {
  const actual = await vi.importActual<typeof import('../src/news.api.js')>('../src/news.api.js');
  const { mapNewsDetailFormValuesToMutation } = await import('../src/news.detail-form.js');
  const getNewsMock = vi.fn(async () => ({
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
  }));
  const createNewsMock = vi.fn(async () => ({
    id: 'news-created',
  }));
  const listNewsCategoriesMock = vi.fn(async () => [
    { id: 'cat-1', name: 'Allgemein' },
    { id: 'cat-2', name: 'Rathaus' },
    { id: 'cat-3', name: 'Kultur' },
  ]);
  const updateNewsMock = vi.fn(async () => ({
    id: 'news-1',
  }));
  const deleteNewsMock = vi.fn(async () => undefined);
  const saveNewsEditorItemMock = vi.fn(async (input: {
    contentId?: string;
    values: Parameters<typeof mapNewsDetailFormValuesToMutation>[0];
    existingItem?: Record<string, unknown> | null;
  }) => {
    const mutation = mapNewsDetailFormValuesToMutation(input.values, input.contentId ? 'edit' : 'create');
    const saved = input.contentId
      ? await updateNewsMock(input.contentId, mutation)
      : await createNewsMock(mutation);

    return {
      ...(input.existingItem ?? {}),
      id: input.contentId ?? 'news-created',
      contentType: NEWS_CONTENT_TYPE,
      payload: {},
      status: 'published',
      author: mutation.author ?? '',
      publishedAt: mutation.publishedAt,
      publicationDate: mutation.publicationDate,
      ...saved,
      ...mutation,
      visible: input.values.publicationMode !== 'draft',
    };
  });

  return {
    ...actual,
    NewsApiError: class NewsApiError extends Error {
      public constructor(
        public readonly code: string,
        message = code
      ) {
        super(message);
        this.name = 'NewsApiError';
      }
    },
    getNews: getNewsMock,
    createNews: createNewsMock,
    listNewsCategories: listNewsCategoriesMock,
    saveNewsEditorItem: saveNewsEditorItemMock,
    updateNews: updateNewsMock,
    updateNewsPartial: vi.fn(async (contentId: string, input: unknown) => updateNewsMock(contentId, input)),
    deleteNews: deleteNewsMock,
  };
});

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

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
    fetchIamContentHistory: vi.fn(async () => []),
    listHostMediaAssets: vi.fn(async () => []),
    listHostMediaReferencesByTarget: vi.fn(async () => []),
    replaceHostMediaReferences: vi.fn(async (input: unknown) => input),
  };
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const actResolve = async <T,>(deferred: { resolve: (value: T) => void; promise: Promise<T> }, value: T) => {
  await act(async () => {
    deferred.resolve(value);
    await deferred.promise;
  });
};

const openContentTab = async () => {
  await waitFor(() => {
    expect(screen.getByLabelText('Bereich auswählen')).toBeTruthy();
  });
  fireEvent.change(screen.getByLabelText('Bereich auswählen'), { target: { value: 'content' } });
  await waitFor(() => {
    expect(screen.getByLabelText('Inhalt')).toBeTruthy();
  });
};

const openReleaseTab = async () => {
  await openSettingsTab();
  fireEvent.click(screen.getByRole('radio', { name: /Zeitgesteuert/ }));
  await waitFor(() => {
    expect(screen.getByLabelText('Zeitpunkt der Veröffentlichung')).toBeTruthy();
  });
};

const openSettingsTab = async () => {
  await waitFor(() => {
    expect(screen.getByLabelText('Bereich auswählen')).toBeTruthy();
  });
  fireEvent.change(screen.getByLabelText('Bereich auswählen'), { target: { value: 'settings' } });
  await waitFor(() => {
    expect(screen.getByRole('tab', { selected: true, name: 'Einstellungen' })).toBeTruthy();
  });
};

const openHistoryTab = async () => {
  await waitFor(() => {
    expect(screen.getByLabelText('Bereich auswählen')).toBeTruthy();
  });
  fireEvent.change(screen.getByLabelText('Bereich auswählen'), { target: { value: 'history' } });
  await waitFor(() => {
    expect(screen.getByRole('tab', { selected: true, name: 'Historie' })).toBeTruthy();
  });
};

const waitForCategoryControls = async () => {
  await waitFor(() => {
    expect(screen.getByLabelText('Kategorien suchen').hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Kategorie hinzufügen' }).hasAttribute('disabled')).toBe(true);
  });
};

const clickPrimaryAction = (label: string) => {
  const targetLabel = label === 'News anlegen' || label === 'Änderungen speichern' ? 'Speichern' : label;
  fireEvent.click(screen.getByRole('button', { name: targetLabel }));
};

describe('News editor pages', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    navigateMock.mockReset();
    paramsMock.mockReset();
    vi.mocked(getNews).mockResolvedValue({
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
    });
    vi.mocked(createNews).mockResolvedValue({ id: 'news-created' });
    vi.mocked(updateNews).mockResolvedValue({ id: 'news-1' });
    vi.mocked(deleteNews).mockResolvedValue(undefined);
    paramsMock.mockReturnValue({ contentId: 'news-1' });
    window.sessionStorage.clear();
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'news.messages.loading': 'News werden geladen.',
        'news.messages.loadError': 'News konnten nicht geladen werden.',
        'news.messages.missingContent': 'Der angeforderte News-Eintrag konnte nicht geladen werden.',
        'news.messages.saveError': 'News konnten nicht gespeichert werden.',
        'news.messages.validationError': 'Bitte korrigieren Sie die markierten Felder.',
        'news.messages.validationSummary': 'Bitte prüfen Sie die folgenden Felder:',
        'news.messages.createSuccess': 'News-Eintrag wurde erstellt.',
        'news.messages.updateSuccess': 'News-Eintrag wurde aktualisiert.',
        'news.messages.deleteSuccess': 'News-Eintrag wurde gelöscht.',
        'news.messages.deleteError': 'News-Eintrag konnte nicht gelöscht werden.',
        'news.messages.categoryOptionsLoading': 'Kategorien werden geladen.',
        'news.messages.categoryOptionsLoadError': 'Die Kategorien konnten nicht geladen werden.',
        'news.messages.unsavedTabChanges': 'Bitte speichern Sie die Änderungen im aktuellen Tab, bevor Sie den Bereich wechseln.',
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
        'news.actions.addCategory': 'Kategorie hinzufügen',
        'news.actions.removeCategory': 'Kategorie {{name}} entfernen',
        'news.actions.deleteConfirm': 'Soll dieser News-Eintrag wirklich gelöscht werden?',
        'news.editor.createTitle': 'News-Eintrag anlegen',
        'news.editor.createDescription': 'Erstellen Sie einen neuen News-Eintrag.',
        'news.editor.editTitle': 'News-Eintrag bearbeiten',
        'news.editor.editDescription': 'Aktualisieren oder löschen Sie den News-Eintrag.',
        'news.fields.title': 'Titel',
        'news.fields.headline': 'Headline',
        'news.fields.author': 'Autor',
        'news.fields.status': 'Status',
        'news.fields.createdAt': 'Erstellt am',
        'news.fields.keywords': 'Schlagwörter',
        'news.fields.externalId': 'Externe ID',
        'news.fields.newsType': 'News-Typ',
        'news.fields.fullVersion': 'Vollversion',
        'news.fields.charactersToBeShown': 'Zeichenbegrenzung',
        'news.fields.publishedAt': 'Veröffentlichungsdatum',
        'news.fields.publicationDate': 'Publikationsdatum',
        'news.fields.showPublishDate': 'Publikationsdatum anzeigen',
        'news.fields.pushNotification': 'Push-Benachrichtigung senden',
        'news.fields.categories': 'Kategorien',
        'news.fields.categoriesHelp': 'Waehlen Sie keine, eine oder mehrere Kategorien aus.',
        'news.fields.categoriesSearch': 'Kategorien suchen',
        'news.fields.categoriesSearchPlaceholder': 'Kategorie suchen oder auswaehlen',
        'news.fields.sourceUrl': 'Quell-URL',
        'news.fields.sourceUrlDescription': 'Quellbeschreibung',
        'news.fields.contentTeaser': 'Teaser',
        'news.fields.contentBody': 'Inhalt',
        'news.fields.publicationMode': 'Veröffentlichungsmodus',
        'news.fields.scheduledPublicationAt': 'Zeitpunkt der Veröffentlichung',
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
        'news.fields.visibleFor': 'Sichtbarkeit für {{title}}',
        'news.fields.likeCount': 'Likes',
        'news.fields.likedByMe': 'Von mir geliked',
        'news.fields.pushNotificationsSentAt': 'Push gesendet am',
        'news.fields.settings': 'Einstellungen',
        'news.fields.announcements': 'Ankündigungen',
        'news.fields.updatedAt': 'Geändert am',
        'news.fields.actions': 'Aktionen',
        'news.fields.characterCount': '{{count}} Zeichen',
        'news.tabs.ariaLabel': 'Detailbereiche',
        'news.tabs.mobileLabel': 'Bereich auswählen',
        'news.tabs.changeLabel': 'Ungespeichert',
        'news.tabs.basis.label': 'Basis',
        'news.tabs.basis.title': 'Basisdaten',
        'news.tabs.basis.description': 'Metadaten, Veröffentlichung und redaktionelle Kerndaten des News-Eintrags.',
        'news.tabs.basis.metaSummaryTitle': 'Aktuelle Metadaten',
        'news.tabs.basis.metaSummaryInline': 'Veröffentlicht: {{publishedAt}}',
        'news.tabs.content.label': 'Inhalte',
        'news.tabs.content.title': 'Inhalte',
        'news.tabs.content.description': 'Textinhalt, Medien und Quelle der News.',
        'news.tabs.settings.label': 'Einstellungen',
        'news.tabs.settings.title': 'Einstellungen',
        'news.tabs.settings.description': 'Push-Benachrichtigung und redaktionelle Veröffentlichungslogik.',
        'news.tabs.history.label': 'Historie',
        'news.tabs.history.title': 'Historie',
        'news.tabs.history.description': 'Nachvollziehbare Änderungen und Statuswechsel dieses News-Eintrags.',
        'news.cards.basis.titleCategories.title': 'Titel & Kategorien',
        'news.cards.basis.titleCategories.description': 'Titel und Kategorien.',
        'news.cards.basis.authorMeta.title': 'Autor & Metadaten',
        'news.cards.basis.authorMeta.description': 'Autor und Metadaten.',
        'news.cards.content.text.title': 'Textinhalt',
        'news.cards.content.text.description': 'Textinhalt der News.',
        'news.cards.content.media.title': 'Medien',
        'news.cards.content.media.description': 'Medien des ersten Inhaltsblocks.',
        'news.cards.content.media.empty': 'Noch keine Medien zugeordnet.',
        'news.cards.content.media.itemLabel': 'Medium {{index}}',
        'news.cards.content.source.title': 'Quelle',
        'news.cards.content.source.description': 'Quellenangaben.',
        'news.cards.settings.push.title': 'Push-Benachrichtigungen',
        'news.cards.settings.push.description': 'Push-Hinweise.',
        'news.cards.settings.push.toggleHint': 'Push wird beim Speichern versendet.',
        'news.cards.settings.publication.title': 'Veröffentlichung',
        'news.cards.settings.publication.description': 'Veröffentlichungslogik.',
        'news.cards.settings.publication.scheduleHint': 'Zeitpunkt frei wählbar.',
        'news.cards.history.title': 'Historie',
        'news.cards.history.description': 'Historie der News.',
        'news.history.createHint': 'Die Historie wird nach dem ersten Speichern verfügbar.',
        'news.history.loading': 'Historie wird geladen.',
        'news.history.empty': 'Noch keine Historie vorhanden.',
        'news.history.emptySummary': 'Keine zusätzliche Zusammenfassung vorhanden.',
        'news.history.tableLabel': 'Historie der News',
        'news.history.columns.time': 'Zeitpunkt',
        'news.history.columns.action': 'Aktion',
        'news.history.columns.actor': 'Akteur',
        'news.history.columns.summary': 'Zusammenfassung',
        'news.history.errors.forbidden': 'Die Historie darf nicht angezeigt werden.',
        'news.history.errors.notFound': 'Für diesen News-Eintrag wurde keine Historie gefunden.',
        'news.history.errors.load': 'Die Historie konnte nicht geladen werden.',
        'news.history.changedFields': 'Geänderte Felder: {{fields}}',
        'news.history.actions.created': 'Erstellt',
        'news.history.actions.updated': 'Aktualisiert',
        'news.history.actions.statusChanged': 'Status geändert',
        'news.values.yes': 'Ja',
        'news.values.no': 'Nein',
        'news.statuses.draft': 'Entwurf',
        'news.statuses.scheduled': 'Geplant',
        'news.statuses.published': 'Veröffentlicht',
        'news.filters.visibility.label': 'Sichtbarkeit',
        'news.filters.visibility.all': 'Alle',
        'news.filters.visibility.visible': 'Sichtbare',
        'news.filters.visibility.hidden': 'Entwürfe',
        'news.filters.editorialStatus.label': 'Redaktioneller Status',
        'news.filters.editorialStatus.all': 'Alle Stati',
        'news.filters.editorialStatus.draft': 'Entwurf',
        'news.filters.editorialStatus.scheduled': 'Geplant',
        'news.filters.editorialStatus.published': 'Veröffentlicht',
        'news.publicationModes.draft.label': 'Entwurf',
        'news.publicationModes.draft.description': 'Bleibt im Studio sichtbar.',
        'news.publicationModes.immediate.label': 'Sofort veröffentlichen',
        'news.publicationModes.immediate.description': 'Wird sofort veröffentlicht.',
        'news.publicationModes.scheduled.label': 'Zeitgesteuert',
        'news.publicationModes.scheduled.description': 'Wird mit Zeitpunkt gespeichert.',
        'news.actions.edit': 'Bearbeiten',
        'news.actions.addMedia': 'Medium hinzufügen',
        'news.actions.remove': 'Entfernen',
        'news.actions.clearMedia': 'Medium entfernen',
        'news.validation.contentBlocks': 'Mindestens ein Inhaltsblock benötigt Inhalt und darf maximal 50.000 Zeichen haben.',
        'news.validation.contentBody': 'Der Inhalt ist erforderlich.',
        'news.validation.sourceUrl': 'Die Quell-URL muss mit https:// beginnen.',
        'news.validation.publishedAt': 'Das Veröffentlichungsdatum ist erforderlich.',
        'news.validation.publicationDate': 'Das Publikationsdatum muss gültig sein.',
        'news.validation.scheduledPublicationAt': 'Der geplante Veröffentlichungszeitpunkt ist ungültig.',
        'news.fields.teaserImage': 'Teaserbild',
        'news.fields.headerImage': 'Headerbild',
        'news.fields.mediaPlaceholder': 'Medium auswählen',
      };
      return labels[key] ?? key;
    });
    vi.mocked(listHostMediaAssets).mockResolvedValue([
      { id: 'asset-hero', metadata: { title: 'Hero Asset' } },
      { id: 'asset-header', metadata: { title: 'Header Asset' } },
    ]);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValue([]);
    vi.mocked(replaceHostMediaReferences).mockResolvedValue({
      targetType: 'news',
      targetId: 'news-1',
      references: [],
    });
    vi.mocked(fetchIamContentHistory).mockResolvedValue([]);
  });

  it('shows validation feedback before creating invalid news', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    await openContentTab();
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: ' ' } });
    await openReleaseTab();
    fireEvent.change(screen.getByLabelText('Zeitpunkt der Veröffentlichung'), { target: { value: '2026-04-14T09:30' } });
    clickPrimaryAction('News anlegen');

    await waitFor(() => {
      expect(screen.getByText('Bitte korrigieren Sie die markierten Felder.')).toBeTruthy();
      expect(screen.getAllByText('Der Inhalt ist erforderlich.').length).toBeGreaterThan(0);
    });

    expect(screen.getByLabelText('Inhalt').getAttribute('aria-invalid')).toBe('true');

    expect(createNews).not.toHaveBeenCalled();
  });

  it('prefills the author field for new entries when an initial author is provided', async () => {
    render(<NewsCreatePage initialAuthor="Stadt Musterhausen" />);

    await waitFor(() => {
      expect((screen.getByLabelText('Autor') as HTMLInputElement).value).toBe('Stadt Musterhausen');
    });
  });

  it('rejects HTML-only body content before creating a news entry', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    await openContentTab();
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p><br></p>' } });
    await openReleaseTab();
    fireEvent.change(screen.getByLabelText('Zeitpunkt der Veröffentlichung'), { target: { value: '2026-04-14T09:30' } });
    clickPrimaryAction('News anlegen');

    await waitFor(() => {
      expect(screen.getAllByText('Der Inhalt ist erforderlich.').length).toBeGreaterThan(0);
    });

    expect(createNews).not.toHaveBeenCalled();
  });

  it('creates a draft by default when no publication mode is selected', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    await openContentTab();
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p>Body</p>' } });
    clickPrimaryAction('News anlegen');

    await waitFor(() => {
      expect(createNews).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Neue News',
          contentBlocks: [expect.objectContaining({ intro: 'Kurztext', body: '<p>Body</p>' })],
        })
      );
    });
  });

  it('keeps invalid scheduled publication dates visible after an attempted submit', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    await openReleaseTab();
    fireEvent.change(screen.getByLabelText('Zeitpunkt der Veröffentlichung'), { target: { value: '2026-03-29T02:30' } });
    await openContentTab();
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p>Body</p>' } });
    clickPrimaryAction('News anlegen');

    await waitFor(() => {
      expect(screen.getAllByText('Der geplante Veröffentlichungszeitpunkt ist ungültig.').length).toBeGreaterThan(0);
    });

    expect(screen.getByLabelText('Zeitpunkt der Veröffentlichung').getAttribute('value')).toBe('2026-03-29T02:30');
    expect(screen.getByLabelText('Zeitpunkt der Veröffentlichung').getAttribute('aria-invalid')).toBe('true');
  });

  it('navigates back to the shared content list after creating a news entry', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    await openContentTab();
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p>Body</p>' } });
    await openReleaseTab();
    fireEvent.change(screen.getByLabelText('Zeitpunkt der Veröffentlichung'), { target: { value: '2026-04-14T09:30' } });
    clickPrimaryAction('News anlegen');

    await waitFor(() => {
      expect(createNews).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Neue News',
          contentBlocks: [expect.objectContaining({ intro: 'Kurztext', body: '<p>Body</p>' })],
        })
      );
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/content' });
    });
  });

  it('stores inline media in the first content block without host reference side effects', async () => {
    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    await openContentTab();
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p>Body</p>' } });
    fireEvent.change(screen.getByLabelText('Quell-URL'), { target: { value: 'https://example.com/news' } });
    fireEvent.click(screen.getByRole('button', { name: 'Medium hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Medien-URL'), { target: { value: 'https://example.com/image.jpg' } });
    fireEvent.change(screen.getByLabelText('Bildunterschrift'), { target: { value: 'Bild' } });
    await openReleaseTab();
    fireEvent.change(screen.getByLabelText('Zeitpunkt der Veröffentlichung'), { target: { value: '2026-04-14T09:30' } });
    clickPrimaryAction('News anlegen');

    await waitFor(() => {
      expect(createNews).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Neue News',
          sourceUrl: { url: 'https://example.com/news' },
          contentBlocks: [
            expect.objectContaining({
              intro: 'Kurztext',
              body: '<p>Body</p>',
              mediaContents: [expect.objectContaining({ sourceUrl: { url: 'https://example.com/image.jpg' } })],
            }),
          ],
        })
      );
    });

    expect(replaceHostMediaReferences).not.toHaveBeenCalled();
  });

  it('submits the simplified editorial model while preserving hidden legacy omissions on create', async () => {
    render(<NewsCreatePage initialAuthor="Redaktion" />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Volle News' } });
    expect((screen.getByLabelText('Autor') as HTMLInputElement).value).toBe('Redaktion');
    expect(screen.queryByLabelText('Schlagwörter')).toBeNull();
    fireEvent.change(screen.getByLabelText('Bereich auswählen'), { target: { value: 'basis' } });
    await waitForCategoryControls();
    fireEvent.change(screen.getByLabelText('Kategorien suchen'), { target: { value: 'Allgemein' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kategorie hinzufügen' }));
    expect(screen.getByText('Allgemein')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Kategorien suchen'), { target: { value: 'Rathaus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kategorie hinzufügen' }));
    expect(screen.getByText('Rathaus')).toBeTruthy();
    await openReleaseTab();
    fireEvent.click(screen.getByRole('checkbox', { name: /Push-Benachrichtigung senden/ }));
    fireEvent.change(screen.getByLabelText('Zeitpunkt der Veröffentlichung'), { target: { value: '2026-04-14T09:30' } });
    await openContentTab();
    fireEvent.change(screen.getByLabelText('Quell-URL'), { target: { value: 'https://example.com/news' } });
    fireEvent.change(screen.getByLabelText('Quellbeschreibung'), { target: { value: 'Quelle' } });
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p>Inhalt</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Medium hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Medien-URL'), { target: { value: 'https://example.com/image.jpg' } });
    fireEvent.change(screen.getByLabelText('Bildunterschrift'), { target: { value: 'Bild' } });
    clickPrimaryAction('News anlegen');

    await waitFor(() => {
      expect(createNews).toHaveBeenCalled();
      const createPayload = vi.mocked(createNews).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(createPayload.title).toBe('Volle News');
      expect(createPayload.author).toBe('Redaktion');
      expect(createPayload.categories).toEqual([{ name: 'Allgemein' }, { name: 'Rathaus' }]);
      expect(createPayload.sourceUrl).toEqual({ url: 'https://example.com/news', description: 'Quelle' });
      expect(createPayload.contentBlocks).toEqual([
        expect.objectContaining({
          title: 'Volle News',
          intro: 'Kurztext',
          body: '<p>Inhalt</p>',
          mediaContents: [expect.objectContaining({ sourceUrl: { url: 'https://example.com/image.jpg' } })],
        }),
      ]);
      expect(createPayload).not.toHaveProperty('payload');
      expect(createPayload).not.toHaveProperty('externalId');
      expect(createPayload).not.toHaveProperty('fullVersion');
      expect(createPayload).not.toHaveProperty('charactersToBeShown');
      expect(createPayload).not.toHaveProperty('newsType');
      expect(createPayload).not.toHaveProperty('address');
      expect(createPayload).not.toHaveProperty('pointOfInterestId');
    });
  });

  it('shows a save error when creating news fails', async () => {
    vi.mocked(createNews).mockRejectedValueOnce(new NewsApiError('forbidden'));

    render(<NewsCreatePage />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neue News' } });
    await openContentTab();
    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p>Body</p>' } });
    await openReleaseTab();
    fireEvent.change(screen.getByLabelText('Zeitpunkt der Veröffentlichung'), { target: { value: '2026-04-14T09:30' } });
    clickPrimaryAction('News anlegen');

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

  it('keeps the latest edit payload when an older content request resolves later', async () => {
    const firstNews = createDeferred<Awaited<ReturnType<typeof getNews>>>();
    const secondNews = createDeferred<Awaited<ReturnType<typeof getNews>>>();
    const firstRefs = createDeferred<Awaited<ReturnType<typeof listHostMediaReferencesByTarget>>>();
    const secondRefs = createDeferred<Awaited<ReturnType<typeof listHostMediaReferencesByTarget>>>();

    vi.mocked(getNews).mockImplementation((contentId: string) => {
      if (contentId === 'news-2') {
        return secondNews.promise;
      }
      return firstNews.promise;
    });
    vi.mocked(listHostMediaReferencesByTarget).mockImplementation(({ targetId }: { targetId: string }) => {
      if (targetId === 'news-2') {
        return secondRefs.promise;
      }
      return firstRefs.promise;
    });

    const { rerender } = render(<NewsEditPage />);

    paramsMock.mockReturnValue({ contentId: 'news-2' });
    rerender(<NewsEditPage />);

    await actResolve(secondNews, {
      id: 'news-2',
      title: 'Neuere News',
      contentType: NEWS_CONTENT_TYPE,
      payload: {
        teaser: 'Neuer Kurztext',
        body: '<p>Neu</p>',
        category: 'Allgemein',
      },
      status: 'published',
      author: 'Editor',
      createdAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-04T00:00:00.000Z',
      publishedAt: '2026-01-04T00:00:00.000Z',
    });
    await actResolve(secondRefs, [
      {
        id: 'ref-2',
        assetId: 'asset-hero',
        role: 'teaser_image',
        targetType: 'news',
        targetId: 'news-2',
      },
    ]);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Neuere News')).toBeTruthy();
    });

    await openContentTab();

    await waitFor(() => {
      expect((screen.getByLabelText('Inhalt') as HTMLTextAreaElement).value).toContain('Neu');
    });

    await actResolve(firstNews, {
      id: 'news-1',
      title: 'Alte News',
      contentType: NEWS_CONTENT_TYPE,
      payload: {
        teaser: 'Alter Kurztext',
        body: '<p>Alt</p>',
        category: 'Allgemein',
      },
      status: 'published',
      author: 'Editor',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      publishedAt: '2026-01-02T00:00:00.000Z',
    });
    await actResolve(firstRefs, [
      {
        id: 'ref-1',
        assetId: 'asset-header',
        role: 'teaser_image',
        targetType: 'news',
        targetId: 'news-1',
      },
    ]);

    expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe('Neuere News');
    expect(screen.queryByDisplayValue('Alte News')).toBeNull();
    expect((screen.getByLabelText('Inhalt') as HTMLTextAreaElement).value).toContain('Neu');
  });

  it('shows an inline success message after updating an existing news entry', async () => {
    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende News')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Aktualisierte News' } });
    clickPrimaryAction('Änderungen speichern');

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

  it('renders the publication card inside the settings tab for scheduled news', async () => {
    vi.mocked(getNews).mockResolvedValueOnce({
      id: 'news-future',
      title: 'Geplante News',
      contentType: NEWS_CONTENT_TYPE,
      payload: {
        teaser: 'Kurztext',
        body: '<p>Body</p>',
      },
      status: 'published',
      author: 'Editor',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      publishedAt: '2026-08-14T09:30:00.000Z',
      visible: true,
    });

    render(<NewsEditPage />);

    await openSettingsTab();

    const settingsPanel = screen.getByRole('tabpanel', { name: /Einstellungen/ });

    await waitFor(() => {
      expect(screen.getByDisplayValue('2026-08-14T11:30')).toBeTruthy();
      expect(within(settingsPanel).getByText('Veröffentlichung')).toBeTruthy();
      expect(within(settingsPanel).getByRole('radio', { name: /Zeitgesteuert/ })).toBeTruthy();
    });
  });

  it('does not show obsolete workflow action buttons in the settings tab', async () => {
    render(<NewsEditPage />);

    await openReleaseTab();

    await waitFor(() => {
      expect(screen.getByText('Veröffentlichung')).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: 'Freigeben' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ablehnen' })).toBeNull();
  });

  it('allows tab switches while keeping the dirty indicator visible', async () => {
    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende News')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Geänderte News' } });
    fireEvent.change(screen.getByLabelText('Bereich auswählen'), { target: { value: 'content' } });

    await waitFor(() => {
      expect(screen.getByRole('tab', { selected: true, name: 'Inhalte' })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /Basis.*Ungespeichert/i })).toBeTruthy();
    });
  });

  it('renders Historie entries in reverse chronological order', async () => {
    vi.mocked(fetchIamContentHistory).mockResolvedValueOnce([
      {
        id: 'history-older',
        contentId: 'news-1',
        action: 'updated',
        actor: 'Editor',
        changedFields: ['title'],
        createdAt: '2026-05-24T08:00:00.000Z',
        summary: 'Titel angepasst',
      },
      {
        id: 'history-newer',
        contentId: 'news-1',
        action: 'status_changed',
        actor: 'Reviewer',
        changedFields: ['status'],
        createdAt: '2026-05-24T10:00:00.000Z',
        summary: 'Freigabe erteilt',
      },
    ]);

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende News')).toBeTruthy();
    });
    await openHistoryTab();

    await waitFor(() => {
      expect(fetchIamContentHistory).toHaveBeenCalledWith('news-1');
      expect(screen.getByText('Freigabe erteilt')).toBeTruthy();
    });

    const rows = within(screen.getByRole('tabpanel', { name: /Historie/ })).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]?.textContent).toContain('Freigabe erteilt');
    expect(rows[2]?.textContent).toContain('Titel angepasst');
  });

  it('renders a trustworthy empty state when no history exists', async () => {
    vi.mocked(fetchIamContentHistory).mockResolvedValueOnce([]);

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende News')).toBeTruthy();
    });
    await openHistoryTab();

    await waitFor(() => {
      expect(screen.getByText('Noch keine Historie vorhanden.')).toBeTruthy();
    });
  });

  it('keeps Historie read-only and free of save actions', async () => {
    vi.mocked(fetchIamContentHistory).mockResolvedValueOnce([
      {
        id: 'history-1',
        contentId: 'news-1',
        action: 'created',
        actor: 'Editor',
        changedFields: ['title'],
        createdAt: '2026-05-24T08:00:00.000Z',
        summary: 'Eintrag erstellt',
      },
    ]);

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende News')).toBeTruthy();
    });
    await openHistoryTab();

    await waitFor(() => {
      expect(screen.getByText('Eintrag erstellt')).toBeTruthy();
    });

    expect(
      within(screen.getByRole('tabpanel', { name: /Historie/ })).queryByRole('button', {
        name: 'Speichern',
      })
    ).toBeNull();
  });

  it('preserves existing host media references on edit saves even without dedicated image controls', async () => {
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValueOnce([
      { id: 'ref-1', assetId: 'asset-hero', role: 'teaser_image', sortOrder: 0 },
      { id: 'ref-2', assetId: 'asset-header', role: 'header_image', sortOrder: 1 },
    ]);

    render(<NewsEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende News')).toBeTruthy();
    });

    clickPrimaryAction('Änderungen speichern');

    await waitFor(() => {
      expect(updateNews).toHaveBeenCalledWith(
        'news-1',
        expect.objectContaining({
          contentBlocks: [expect.objectContaining({ intro: 'Kurztext', body: '<p>Body</p>' })],
        })
      );
      expect(replaceHostMediaReferences).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        targetType: 'news',
        targetId: 'news-1',
        references: [
          { assetId: 'asset-hero', role: 'teaser_image', sortOrder: 0 },
          { assetId: 'asset-header', role: 'header_image', sortOrder: 1 },
        ],
      });
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
      expect(screen.getByDisplayValue('Redaktion')).toBeTruthy();
      expect(screen.queryByLabelText('Schlagwörter')).toBeNull();
      expect(screen.getByText('Kultur')).toBeTruthy();
    });

    await openSettingsTab();

    await waitFor(() => {
      expect(screen.getByText('Push gesendet am')).toBeTruthy();
      expect(screen.queryByLabelText('Push-Benachrichtigung senden')).toBeNull();
    });

    clickPrimaryAction('Änderungen speichern');

    await waitFor(() => {
      expect(updateNews).toHaveBeenNthCalledWith(
        1,
        'news-1',
        expect.objectContaining({
          externalId: 'external-7',
          fullVersion: true,
          charactersToBeShown: 160,
          newsType: 'press',
        })
      );
      expect(updateNews).not.toHaveBeenNthCalledWith(
        1,
        'news-1',
        expect.objectContaining({ payload: expect.anything() })
      );
    });

    fireEvent.change(screen.getByLabelText('Bereich auswählen'), { target: { value: 'basis' } });
    clickPrimaryAction('Änderungen speichern');

    await waitFor(() => {
      expect(updateNews).toHaveBeenNthCalledWith(
        2,
        'news-1',
        expect.objectContaining({
          title: 'Bestehende volle News',
          author: 'Redaktion',
          keywords: 'Markt, Kultur',
          categories: [{ name: 'Kultur' }, { name: 'Rathaus' }],
        })
      );
      expect(updateNews).not.toHaveBeenNthCalledWith(
        2,
        'news-1',
        expect.objectContaining({ payload: expect.anything() })
      );
      expect(updateNews).not.toHaveBeenNthCalledWith(
        2,
        'news-1',
        expect.objectContaining({ pushNotification: expect.anything() })
      );
    });

    await openContentTab();

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://example.com/source')).toBeTruthy();
      expect(screen.getByDisplayValue('https://example.com/image.jpg')).toBeTruthy();
    });

    clickPrimaryAction('Änderungen speichern');

    await waitFor(() => {
      expect(updateNews).toHaveBeenNthCalledWith(
        3,
        'news-1',
        expect.objectContaining({
          sourceUrl: { url: 'https://example.com/source', description: 'Quelle' },
          address: expect.objectContaining({ street: 'Markt 1', zip: '12345', city: 'Musterhausen' }),
          pointOfInterestId: 'poi-7',
          contentBlocks: [
            expect.objectContaining({
              title: 'Bestehende volle News',
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
      expect(updateNews).not.toHaveBeenNthCalledWith(
        3,
        'news-1',
        expect.objectContaining({ payload: expect.anything() })
      );
      expect(updateNews).not.toHaveBeenNthCalledWith(
        3,
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

    clickPrimaryAction('Änderungen speichern');

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
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/content' });
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
      publishedAt: '2026-08-14T09:30:00.000Z',
      visible: true,
    });

    render(<NewsEditPage />);

    await openSettingsTab();

    await waitFor(() => {
      expect(screen.getByLabelText('Zeitpunkt der Veröffentlichung').getAttribute('value')).toBe('2026-08-14T11:30');
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

    await openSettingsTab();
    fireEvent.click(screen.getByRole('radio', { name: /Zeitgesteuert/ }));

    await waitFor(() => {
      expect(screen.getByLabelText('Zeitpunkt der Veröffentlichung').getAttribute('value')).toBe('');
    });
  });
});
