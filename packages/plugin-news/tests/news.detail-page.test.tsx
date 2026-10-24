import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHostMediaAsset,
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  publishSessionAccessSnapshot,
  registerPluginTranslationResolver,
  resetSessionAccessSnapshot,
  updateHostMediaAsset,
  uploadHostMediaFile,
} from '@sva/plugin-sdk';

import { StudioEditorLeaveGuardProvider } from '@sva/studio-ui-react';
import {
  deleteNews,
  getNewsDetail,
  listNewsCategories,
  saveNewsEditorItem,
} from '../src/news.api.js';
import { pluginNewsTranslations } from '../src/plugin.translations.js';
import { NewsDetailPage } from '../src/news.detail-page.js';

vi.mock('@sva/studio-ui-react', async () => {
  const actual =
    await vi.importActual<typeof import('@sva/studio-ui-react')>('@sva/studio-ui-react');
  return {
    ...actual,
    RichTextHtmlEditor: ({
      id,
      value,
      onChange,
      labelId,
      describedBy,
      ariaInvalid,
    }: {
      id: string;
      value: string;
      onChange: (nextValue: string) => void;
      labelId?: string;
      describedBy?: string;
      ariaInvalid?: boolean;
    }) => (
      <textarea
        id={id}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid ? 'true' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ),
  };
});

const navigateMock = vi.fn();
const newsDetailSettingsSourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/news.detail-settings-tab.tsx'
);

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
    getHostMediaAsset: vi.fn(),
    getHostMediaDelivery: vi.fn(async () => ({
      deliveryUrl: 'https://cdn.example.test/upload-fallback.jpg',
      expiresAt: '2099-01-01T00:00:00.000Z',
      isPublicUrl: true,
    })),
    listHostMediaAssets: vi.fn(async () => []),
    listHostMediaReferencesByTarget: vi.fn(async () => []),
    updateHostMediaAsset: vi.fn(),
    uploadHostMediaFile: vi.fn(),
  };
});

vi.mock('../src/news.api.js', async () => {
  const actual = await vi.importActual<typeof import('../src/news.api.js')>('../src/news.api.js');
  return {
    ...actual,
    listNewsCategories: vi.fn(async () => []),
    createNews: vi.fn(),
    deleteNews: vi.fn(),
    getNewsDetail: vi.fn(),
    saveNewsEditorItem: vi.fn(),
    updateNewsPartial: vi.fn(),
  };
});

describe('NewsDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValue([]);
    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: [
        'news.read',
        'news.create',
        'news.update',
        'news.delete',
        'news.pushNotification',
        'media.read',
        'media.create',
        'media.update',
        'media.reference.manage',
      ],
      unscopedPermissionActions: [
        'news.read',
        'news.create',
        'news.update',
        'news.delete',
        'news.pushNotification',
      ],
      assignedModules: ['news'],
      roles: [],
    });
    navigateMock.mockReset();
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'news.create.actions.draft': 'Entwurf anlegen',
        'news.create.actions.immediate': 'Jetzt veröffentlichen',
        'news.create.actions.scheduled': 'Geplante Nachricht anlegen',
        'news.messages.loading': 'News werden geladen.',
        'news.messages.validationSummary': 'Bitte prüfen Sie die folgenden Felder:',
        'news.messages.categoryOptionsLoadError': 'Die Kategorien konnten nicht geladen werden.',
        'news.fields.title': 'Titel',
        'news.fields.author': 'Autor',
        'news.fields.createAs': 'Erstellen als',
        'news.fields.actAs': 'Handeln als',
        'news.fields.actingPrincipalHelp': 'Schreibkontext auswählen.',
        'news.fields.dataProvider': 'Datenanbieter',
        'news.fields.dataProviderUnavailable': 'Noch nicht verfügbar',
        'news.principals.organization': 'Aktive Organisation',
        'news.principals.user': 'Persönlich',
        'news.fields.categories': 'Kategorien',
        'news.fields.categoriesHelp': 'Kategorien auswählen.',
        'news.fields.categoriesSearch': 'Kategorien suchen',
        'news.fields.categoriesSearchPlaceholder': 'Kategorie suchen',
        'news.fields.headline': 'Headline',
        'news.fields.contentIntro': 'Einleitung',
        'news.fields.contentBody': 'Inhalt',
        'news.fields.sourceUrl': 'Quell-URL',
        'news.fields.sourceUrlDescription': 'Quellbeschreibung',
        'news.fields.mediaUrl': 'Medien-URL',
        'news.fields.mediaCaption': 'Bildunterschrift',
        'news.fields.mediaUrlDescription': 'Bildquelle',
        'news.fields.mediaCopyright': 'Copyright',
        'news.fields.mediaWidth': 'Breite',
        'news.fields.mediaHeight': 'Höhe',
        'news.fields.imageSearch': 'Bilder suchen',
        'news.fields.publicationMode': 'Veröffentlichungsmodus',
        'news.fields.scheduledPublicationAt': 'Zeitpunkt der Veröffentlichung',
        'news.fields.pushNotification': 'Push-Benachrichtigung senden',
        'news.fields.pushNotificationsSentAt': 'Push gesendet am',
        'news.fields.characterCount': '{{count}} Zeichen',
        'news.tabs.ariaLabel': 'Detailbereiche',
        'news.tabs.mobileLabel': 'Bereich auswählen',
        'news.tabs.changeLabel': 'Ungespeichert',
        'news.tabs.basis.label': 'Basis',
        'news.tabs.basis.title': 'Basisdaten',
        'news.tabs.basis.description': 'Basisdaten des News-Eintrags.',
        'news.tabs.content.label': 'Inhalte',
        'news.tabs.content.title': 'Inhalte',
        'news.tabs.content.description': 'Inhalte des News-Eintrags.',
        'news.tabs.settings.label': 'Einstellungen',
        'news.tabs.settings.title': 'Einstellungen',
        'news.tabs.settings.description': 'Einstellungen des News-Eintrags.',
        'news.tabs.history.label': 'Historie',
        'news.tabs.history.title': 'Historie',
        'news.tabs.history.description': 'Historie des News-Eintrags.',
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
        'news.publicationModes.draft.label': 'Entwurf',
        'news.publicationModes.draft.description': 'Bleibt unsichtbar.',
        'news.publicationModes.immediate.label': 'Sofort veröffentlichen',
        'news.publicationModes.immediate.description': 'Wird direkt sichtbar.',
        'news.publicationModes.scheduled.label': 'Zeitgesteuert',
        'news.publicationModes.scheduled.description': 'Wird mit Zeitpunkt gespeichert.',
        'news.editor.createTitle': 'News-Eintrag anlegen',
        'news.editor.createDescription': 'Erstellen Sie einen neuen News-Eintrag.',
        'news.actions.create': 'News anlegen',
        'news.actions.update': 'Änderungen speichern',
        'news.actions.save': 'Speichern',
        'news.actions.back': 'Zurück zur Liste',
        'news.actions.delete': 'Löschen',
        'news.actions.deleteConfirmTitle': 'Nachricht löschen?',
        'news.actions.deleteConfirm':
          'Die Nachricht „Sommerfest“ wird dauerhaft gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.',
        'news.actions.deleting': 'Wird gelöscht …',
        'news.actions.addImage': 'Bild aus Mediathek',
        'news.actions.uploadMedia': 'Bild hochladen',
        'news.actions.uploadingMedia': 'Bild wird hochgeladen',
        'news.actions.addMediaManual': 'Link manuell eintragen',
        'news.actions.remove': 'Entfernen',
        'news.actions.removeImage': 'Bild entfernen',
        'news.messages.imagePickerEmpty': 'Keine Bilder gefunden.',
        'news.messages.mediaPickerTitle': 'Medium hinzufügen',
        'news.messages.mediaPickerLibraryAction': 'Medium aus der Bibliothek hinzufügen',
        'news.messages.mediaPickerLinkAction': 'Medium per Link hinzufügen',
        'news.messages.mediaPickerDescription':
          'Wählen Sie ein vorhandenes Medium aus oder laden Sie ein neues Bild hoch.',
        'news.messages.mediaPickerReviewMode': 'Prüfen',
        'news.messages.mediaPickerUploadRegionLabel': 'Bilddatei hochladen',
        'news.messages.mediaPickerUploadTitle': 'Neues Medium hochladen',
        'news.messages.mediaPickerUploadDescription':
          'Laden Sie ein Bild hoch und prüfen Sie danach die Metadaten vor der Übernahme.',
        'news.messages.mediaPickerSelectFile': 'Datei auswählen',
        'news.messages.mediaPickerUploadSupportLabel': 'Unterstützt werden JPG, PNG und WebP.',
        'news.messages.mediaPickerReviewTitle': 'Metadaten prüfen',
        'news.messages.mediaPickerReviewDescription':
          'Ergänzen Sie Titel, Alternativtext und weitere Metadaten, bevor das Medium übernommen wird.',
        'news.messages.mediaPickerAltText': 'Alternativtext',
        'news.messages.mediaPickerLicense': 'Lizenz',
        'news.messages.mediaPickerBackToLibrary': 'Zurück zur Mediathek',
        'news.messages.mediaPickerBackToUpload': 'Zurück zum Upload',
        'news.messages.mediaPickerOpenMediaManagement': 'In Medienverwaltung öffnen',
        'news.messages.mediaPickerUseMedia': 'Medium übernehmen',
        'news.messages.mediaUploadInitializing': 'Upload wird vorbereitet.',
        'news.messages.mediaUploadUploading': 'Bild wird hochgeladen.',
        'news.messages.mediaUploadFinalizing': 'Bild wird verarbeitet.',
        'news.messages.mediaUploadSuccess': 'Bild wurde hochgeladen.',
        'news.messages.mediaUploadError': 'Bild konnte nicht hochgeladen werden.',
        'news.messages.mediaUploadUnsupportedType': 'Dateityp wird nicht unterstützt.',
        'news.messages.mediaUploadUnavailableUrl': 'Bild-URL konnte nicht ermittelt werden.',
        'news.messages.deleteError': 'Die Nachricht konnte nicht gelöscht werden.',
        'news.values.mediaContentTypes.image': 'Bild',
        'news.values.mediaContentTypes.audio': 'Audio',
        'news.values.mediaContentTypes.video': 'Video',
        'news.values.mediaContentTypes.logo': 'Logo',
        'news.values.mediaContentTypes.attachment': 'Anhang',
        'news.values.mediaContentTypes.unspecified': 'Nicht angegeben',
      };
      const resource = key
        .split('.')
        .reduce<unknown>(
          (value, part) =>
            value && typeof value === 'object' ? Reflect.get(value, part) : undefined,
          pluginNewsTranslations.de
        );
      return (
        labels[key] ??
        (key.startsWith('news.create.') && typeof resource === 'string' ? resource : key)
      );
    });
    vi.mocked(listNewsCategories).mockResolvedValue([]);
    vi.mocked(getHostMediaAsset).mockReset();
    vi.mocked(listHostMediaAssets).mockResolvedValue([]);
    vi.mocked(updateHostMediaAsset).mockReset();
    vi.mocked(uploadHostMediaFile).mockReset();
  });

  afterEach(() => {
    cleanup();
    resetSessionAccessSnapshot();
  });

  it('renders the same save action in the page header and after the editor', async () => {
    render(<NewsDetailPage mode="create" />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Entwurf anlegen' })).toHaveLength(2);
    });
  });

  it('keeps publication effects and both actions in sync and explains push reset', async () => {
    render(<NewsDetailPage mode="create" />);
    expect(await screen.findAllByRole('button', { name: 'Entwurf anlegen' })).toHaveLength(2);
    expect(screen.getAllByText(/mit Status Entwurf gespeichert/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('radio', { name: /Sofort veröffentlichen/ }));
    expect(screen.getAllByRole('button', { name: 'Jetzt veröffentlichen' })).toHaveLength(2);
    const push = screen.getByRole('checkbox', { name: 'Push-Benachrichtigung senden' });
    fireEvent.click(push);
    expect(screen.getAllByText(/Push-Benachrichtigung für folgendes Zielgebiet/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('radio', { name: /Zeitgesteuert/ }));
    await waitFor(() => expect((push as HTMLInputElement).checked).toBe(false));
    expect(screen.getAllByRole('button', { name: 'Geplante Nachricht anlegen' })).toHaveLength(2);
    expect(screen.getByText(/Push-Auswahl zurückgesetzt/)).toBeTruthy();
    expect(screen.getAllByText(/keine Push-Benachrichtigung versendet/)).toHaveLength(2);
  });

  it('opens an invalid source before error focus and retains it on collapse', async () => {
    render(<NewsDetailPage mode="create" />);
    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Quelle testen' } });
    const source = screen.getByLabelText('Quell-URL');
    const details = source.closest('details')!;
    details.open = true;
    fireEvent.change(source, { target: { value: 'http://insecure.test' } });
    details.open = false;
    fireEvent.click(screen.getAllByRole('button', { name: 'Entwurf anlegen' })[1]!);
    await waitFor(() => expect(details.open).toBe(true));
    expect((source as HTMLInputElement).value).toBe('http://insecure.test');
    await waitFor(() => expect(document.activeElement).toBe(source));
  });

  it('renders save for a scoped update when the detail read grants resource access', async () => {
    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['news.read', 'news.update'],
      unscopedPermissionActions: ['news.read'],
      assignedModules: ['news'],
      roles: [],
    });
    const detailData = {
      id: '9082',
      title: 'Resolver-Personal-2026-08-11',
      contentType: 'news.article',
      payload: {},
      status: 'draft' as const,
      author: 'Persönlicher Redakteur',
      createdAt: '2026-08-11T10:00:00.000Z',
      updatedAt: '2026-08-11T10:00:00.000Z',
      publishedAt: '2026-08-11T10:00:00.000Z',
    };
    vi.mocked(getNewsDetail).mockResolvedValueOnce({
      data: detailData,
      deviations: [],
      access: {
        'news.update': true,
        'news.delete': false,
        'content.publish': true,
        'content.changeStatus': true,
      },
    });

    const view = render(
      <NewsDetailPage
        mode="edit"
        contentId="9082"
        principalControl={{
          kind: 'selectable',
          value: 'user',
          options: [
            { value: 'user', label: 'Persönlich' },
            { value: 'organization', label: 'Stadt' },
          ],
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(2);
    });
    expect(screen.queryByRole('button', { name: 'news.actions.delete' })).toBeNull();
    const titleInput = screen.getByDisplayValue('Resolver-Personal-2026-08-11');
    fireEvent.change(titleInput, { target: { value: 'Ungespeicherte Meldung' } });

    vi.mocked(getNewsDetail).mockResolvedValueOnce({
      data: detailData,
      deviations: [],
      access: {
        'news.update': false,
        'news.delete': false,
        'content.publish': false,
        'content.changeStatus': false,
      },
    });
    view.rerender(
      <NewsDetailPage
        mode="edit"
        contentId="9082"
        principalControl={{
          kind: 'selectable',
          value: 'organization',
          options: [
            { value: 'user', label: 'Persönlich' },
            { value: 'organization', label: 'Stadt' },
          ],
        }}
      />
    );
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
    });
    expect(screen.getByDisplayValue('Ungespeicherte Meldung')).toBeTruthy();
    expect(getNewsDetail).toHaveBeenNthCalledWith(2, '9082', 'organization');

    const principalSelect = screen.getByRole('combobox', { name: 'Handeln als' });
    vi.mocked(getNewsDetail).mockRejectedValueOnce(new Error('forbidden'));
    fireEvent.change(principalSelect, { target: { value: 'user' } });
    await waitFor(() => {
      expect(getNewsDetail).toHaveBeenNthCalledWith(3, '9082', 'user');
    });
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
  });

  it('blocks a visibility-changing save without the required lifecycle grant', async () => {
    vi.mocked(getNewsDetail).mockResolvedValueOnce({
      data: {
        id: '9082',
        title: 'Entwurf',
        contentType: 'news.article',
        payload: {},
        status: 'draft',
        author: 'Persönlicher Redakteur',
        createdAt: '2026-08-11T10:00:00.000Z',
        updatedAt: '2026-08-11T10:00:00.000Z',
        visible: false,
      },
      deviations: [],
      access: {
        'news.update': true,
        'news.delete': false,
        'content.publish': false,
        'content.changeStatus': true,
      },
    });

    render(<NewsDetailPage mode="edit" contentId="9082" />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(2);
    });
    fireEvent.change(screen.getByLabelText('Bereich auswählen'), {
      target: { value: 'settings' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /Sofort veröffentlichen/ }));
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
  });

  it('deletes a news item through the shared dialog and returns contextual feedback', async () => {
    vi.mocked(getNewsDetail).mockResolvedValueOnce({
      data: {
        id: '9082',
        title: 'Sommerfest',
        contentType: 'news.article',
        payload: {},
        status: 'draft',
        author: 'Redaktion',
        createdAt: '2026-08-11T10:00:00.000Z',
        updatedAt: '2026-08-11T10:00:00.000Z',
      },
      deviations: [],
      access: {
        'news.update': true,
        'news.delete': true,
        'content.publish': true,
        'content.changeStatus': true,
      },
    });
    const nativeConfirm = vi.fn();
    vi.stubGlobal('confirm', nativeConfirm);

    render(<NewsDetailPage mode="edit" contentId="9082" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Löschen' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Sommerfest/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(vi.mocked(deleteNews)).toHaveBeenCalledWith('9082', 'user');
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/admin/content',
        state: expect.any(Function),
      });
    });
    const navigationState = navigateMock.mock.calls[0]?.[0]?.state({ preserved: true });
    expect(navigationState).toEqual({
      preserved: true,
      studioActionFeedback: {
        kind: 'destructive-complete',
        resourceType: 'news',
        resourceId: '9082',
      },
    });
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it('keeps a selected upload local until the news item is saved', async () => {
    let check = () => false;
    render(
      <StudioEditorLeaveGuardProvider
        register={(next) => {
          check = next;
          return () => undefined;
        }}
      >
        <NewsDetailPage mode="create" />
      </StudioEditorLeaveGuardProvider>
    );

    await screen.findByLabelText('Inhalt');
    expect(check()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Medium hinzufügen' }));
    expect(check()).toBe(false);
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: {
        files: [new File(['image'], 'uploaded.jpg', { type: 'image/jpeg' })],
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Medium übernehmen' }));

    await waitFor(() =>
      expect(document.querySelector<HTMLImageElement>('article img')?.src).toMatch(/^blob:/)
    );
    expect((screen.getByLabelText('Medien-URL') as HTMLInputElement).value).toBe('');
    expect(check()).toBe(true);
    expect(vi.mocked(uploadHostMediaFile)).not.toHaveBeenCalled();
    expect(vi.mocked(getHostMediaAsset)).not.toHaveBeenCalled();
    expect(screen.queryByText('Bild-URL konnte nicht ermittelt werden.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bild entfernen' }));
    await waitFor(() => expect(check()).toBe(false));
  });

  it('acknowledges a complete create before navigation and protects later edits', async () => {
    let check = () => false;
    vi.mocked(saveNewsEditorItem).mockResolvedValueOnce({
      id: 'guard-created',
      title: 'Gespeichert',
      contentType: 'news.article',
      payload: {},
      status: 'published',
      author: 'Editor',
      createdAt: '2026-10-23T10:00:00Z',
      updatedAt: '2026-10-23T10:00:00Z',
    });
    navigateMock.mockImplementationOnce(async () => {
      expect(check()).toBe(false);
      throw new Error('navigation_failed');
    });
    render(
      <StudioEditorLeaveGuardProvider
        register={(next) => {
          check = next;
          return () => undefined;
        }}
      >
        <NewsDetailPage mode="create" />
      </StudioEditorLeaveGuardProvider>
    );
    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Gespeichert' } });
    expect(check()).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: 'Entwurf anlegen' })[0]);
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    await waitFor(() => expect(check()).toBe(false));
    expect(screen.queryByRole('button', { name: 'Entwurf anlegen' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Weitere Änderung' } });
    await waitFor(() => expect(check()).toBe(true));
    expect(vi.mocked(saveNewsEditorItem)).toHaveBeenCalledTimes(1);
  });

  it('does not acknowledge changes made while creating the news item', async () => {
    let check = () => false;
    let complete: ((saved: Awaited<ReturnType<typeof saveNewsEditorItem>>) => void) | undefined;
    vi.mocked(saveNewsEditorItem).mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    navigateMock.mockImplementationOnce(async () => {
      expect(check()).toBe(true);
    });
    render(
      <StudioEditorLeaveGuardProvider
        register={(next) => {
          check = next;
          return () => undefined;
        }}
      >
        <NewsDetailPage mode="create" />
      </StudioEditorLeaveGuardProvider>
    );
    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Abgesendet' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Entwurf anlegen' })[0]);
    await waitFor(() => expect(vi.mocked(saveNewsEditorItem)).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Noch nicht gespeichert' },
    });
    await act(async () => {
      complete?.({
        id: 'guard-created',
        title: 'Abgesendet',
        contentType: 'news.article',
        payload: {},
        status: 'published',
        author: 'Editor',
        createdAt: '2026-10-23T10:00:00Z',
        updatedAt: '2026-10-23T10:00:00Z',
      });
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(check()).toBe(true);
    expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe(
      'Noch nicht gespeichert'
    );
  });

  it('reviews and accepts a persistent asset from the media library', async () => {
    vi.mocked(listHostMediaAssets).mockResolvedValueOnce([
      {
        id: 'asset-library',
        fileName: 'library.jpg',
        mimeType: 'image/jpeg',
        visibility: 'public',
        previewUrl: 'https://example.com/library-preview.jpg',
        metadata: { title: 'Bibliotheksbild' },
      },
    ] as never);
    vi.mocked(getHostMediaAsset).mockResolvedValueOnce({
      id: 'asset-library',
      fileName: 'library.jpg',
      mimeType: 'image/jpeg',
      visibility: 'public',
      previewUrl: 'https://example.com/library-preview.jpg',
      metadata: {
        title: 'Bibliotheksbild',
        altText: 'Alt',
        description: 'Beschreibung',
        copyright: 'Stadt',
        license: 'CC0',
      },
    } as never);
    render(<NewsDetailPage mode="create" />);
    if (screen.queryByLabelText('Bereich auswählen'))
      fireEvent.change(screen.getByLabelText('Bereich auswählen'), {
        target: { value: 'content' },
      });
    fireEvent.click(await screen.findByRole('button', { name: 'Medium hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Medium aus der Bibliothek hinzufügen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'news.actions.selectImage' }));
    fireEvent.change(await screen.findByDisplayValue('Alt'), {
      target: { value: 'Alternativtext für diese Meldung' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Medium übernehmen' }));
    await waitFor(() =>
      expect(screen.getByDisplayValue('https://cdn.example.test/upload-fallback.jpg')).toBeTruthy()
    );
    expect(vi.mocked(updateHostMediaAsset)).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Alternativtext für diese Meldung')).toBeTruthy();

    vi.mocked(getHostMediaAsset).mockResolvedValueOnce({
      id: 'asset-library',
      fileName: 'library.jpg',
      mimeType: 'image/jpeg',
      visibility: 'public',
      metadata: {},
    } as never);
    fireEvent.click(screen.getByRole('button', { name: 'news.media.refresh' }));
    expect(await screen.findByText('news.media.refreshTitle')).toBeTruthy();
  });

  it('renders a fixed principal without exposing an editable author', async () => {
    render(
      <NewsDetailPage
        mode="create"
        principalControl={{ kind: 'fixed', value: 'organization', label: 'Stadt Musterhausen' }}
      />
    );

    const principalInput = await screen.findByLabelText('Erstellen als');
    expect((principalInput as HTMLInputElement).value).toBe('Stadt Musterhausen');
    expect(principalInput.getAttribute('readonly')).not.toBeNull();
    expect(screen.queryByLabelText('Autor')).toBeNull();
  });

  it('renders the principal as a typed dropdown when both contexts are allowed', async () => {
    render(
      <NewsDetailPage
        mode="create"
        principalControl={{
          kind: 'selectable',
          value: 'organization',
          options: [
            { value: 'organization', label: 'Stadt Musterhausen' },
            { value: 'user', label: 'Max Mustermann' },
          ],
        }}
      />
    );

    const principalSelect = await screen.findByRole('combobox', { name: 'Erstellen als' });
    expect((principalSelect as HTMLSelectElement).value).toBe('organization');
    expect(
      Array.from((principalSelect as HTMLSelectElement).options).map((option) => option.textContent)
    ).toEqual(['Stadt Musterhausen', 'Max Mustermann']);
  });

  it('offers a member organization in the existing create-as field', async () => {
    const onContextChange = vi.fn();
    render(
      <NewsDetailPage
        mode="create"
        principalControl={{
          kind: 'fixed',
          value: 'user',
          label: 'Svs Admin',
          contextOptions: [{ value: 'organization:org-1', label: 'Stadt Guben' }],
          onContextChange,
        }}
      />
    );

    const selector = await screen.findByRole('combobox', { name: 'Erstellen als' });
    expect(screen.getAllByLabelText('Erstellen als')).toHaveLength(1);
    fireEvent.change(selector, { target: { value: 'organization:org-1' } });
    expect(onContextChange).toHaveBeenCalledWith('organization:org-1');
  });

  it('defaults to a fixed personal principal when no principal policy is provided', async () => {
    render(<NewsDetailPage mode="create" />);

    const principalInput = await screen.findByLabelText('Erstellen als');
    expect((principalInput as HTMLInputElement).value).toBe('Persönlich');
    expect(principalInput.getAttribute('readonly')).not.toBeNull();
    expect(screen.queryByLabelText('Autor')).toBeNull();
  });

  it('applies a later principal policy update', async () => {
    const { rerender } = render(<NewsDetailPage mode="create" />);

    expect(((await screen.findByLabelText('Erstellen als')) as HTMLInputElement).value).toBe(
      'Persönlich'
    );

    rerender(
      <NewsDetailPage
        mode="create"
        principalControl={{ kind: 'fixed', value: 'organization', label: 'Stadt Musterhausen' }}
      />
    );

    await waitFor(() => {
      expect((screen.getByLabelText('Erstellen als') as HTMLInputElement).value).toBe(
        'Stadt Musterhausen'
      );
    });
  });

  it('shows one create form with ordered fields and no tabs or duplicate headline', async () => {
    render(<NewsDetailPage mode="create" />);
    const title = await screen.findByLabelText('Titel');
    const intro = screen.getByLabelText('Einleitung');
    const body = screen.getByLabelText('Inhalt');
    expect(title.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(intro.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByLabelText('Headline')).toBeNull();
    expect(document.querySelectorAll('form')).toHaveLength(1);
    expect(screen.getByLabelText('Quell-URL').closest('details')?.open).toBe(false);
  });

  it('shows the scheduled date field only for the scheduled publication mode', async () => {
    render(<NewsDetailPage mode="create" />);

    await screen.findByRole('radio', { name: /Zeitgesteuert/ });
    expect(screen.queryByLabelText('Zeitpunkt der Veröffentlichung')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: /Zeitgesteuert/ }));

    expect(await screen.findByLabelText('Zeitpunkt der Veröffentlichung')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /Entwurf/ }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Zeitpunkt der Veröffentlichung')).toBeNull();
    });
  });

  it('renders publication mode radio labels through explicit labels and descriptions', () => {
    const source = fs.readFileSync(newsDetailSettingsSourcePath, 'utf8');

    expect(source).toContain('aria-describedby={`publication-mode-${option}-description`}');
    expect(source).toContain('htmlFor={`publication-mode-${option}`}');
    expect(source).toContain('{pt(`publicationModes.${option}.label`)}');
    expect(source).toContain(
      '<p id={`publication-mode-${option}-description`} className="text-muted-foreground">'
    );
    expect(source).toContain('<label');
  });

  it('renders the push notification checkbox through an explicit label binding', () => {
    const source = fs.readFileSync(newsDetailSettingsSourcePath, 'utf8');

    expect(source).toContain('htmlFor="news-push-notification-enabled"');
    expect(source).toContain('id="news-push-notification-enabled"');
    expect(source).toContain('aria-labelledby="news-push-notification-label"');
    expect(source).toContain('id="news-push-notification-label"');
  });
});
