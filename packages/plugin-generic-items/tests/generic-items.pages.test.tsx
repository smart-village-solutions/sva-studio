import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GenericItemsCreatePage, GenericItemsEditPage, GenericItemsListPage } from '../src/generic-items.pages.js';
import { listGenericItems } from '../src/generic-items.api.js';
import { registerPluginTranslationResolver } from '@sva/plugin-sdk';

vi.mock('../src/generic-items.api.js', () => ({
  listGenericItems: vi.fn(async () => ({
    data: [],
    pagination: { page: 1, pageSize: 25, hasNextPage: false },
  })),
  listGenericItemCategories: vi.fn(async () => [{ id: 'cat-1', name: 'Rathaus' }]),
  getGenericItem: vi.fn(async () => ({
    id: 'generic-1',
    title: 'Bestehender Eintrag',
    genericType: 'faq',
    payload: {},
    visible: true,
    contentType: 'generic-items.generic-item',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  })),
  createGenericItem: vi.fn(async () => ({ id: 'created' })),
  updateGenericItem: vi.fn(async () => ({ id: 'generic-1' })),
  deleteGenericItem: vi.fn(async () => undefined),
  GenericItemsApiError: class GenericItemsApiError extends Error {},
}));

const navigateMock = vi.fn();
const paramsMock = vi.fn(() => ({ id: 'generic-1' }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigateMock,
  useParams: () => paramsMock(),
  useSearch: () => ({ page: 1, pageSize: 25 }),
}));

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
    listHostMediaAssets: vi.fn(async () => []),
    uploadHostMediaFile: vi.fn(async () => ({ assetId: 'uploaded-asset', uploadSessionId: 'upload-1' })),
  };
});

describe('generic items pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPluginTranslationResolver((key) => {
      const map: Record<string, string> = {
        'genericItems.list.title': 'Generic Items',
        'genericItems.list.description': 'Beschreibung',
        'genericItems.messages.loading': 'Generic Items werden geladen.',
        'genericItems.messages.loadError': 'Generic Items konnten nicht geladen werden.',
        'genericItems.messages.missingContent': 'Fehlt',
        'genericItems.messages.saveError': 'Fehler',
        'genericItems.messages.createSuccess': 'Erstellt',
        'genericItems.messages.updateSuccess': 'Aktualisiert',
        'genericItems.empty.title': 'Noch keine Generic Items vorhanden',
        'genericItems.actions.create': 'Generic Item anlegen',
        'genericItems.actions.update': 'Änderungen speichern',
        'genericItems.actions.back': 'Zurück zur Liste',
        'genericItems.actions.edit': 'Bearbeiten',
        'genericItems.actions.delete': 'Löschen',
        'genericItems.actions.deleteConfirm': 'Bestätigen',
        'genericItems.fields.actions': 'Aktionen',
        'genericItems.fields.title': 'Titel',
        'genericItems.fields.genericType': 'Generic-Type',
        'genericItems.fields.updatedAt': 'Geändert am',
        'genericItems.tabs.ariaLabel': 'Detailbereiche',
        'genericItems.tabs.basis.label': 'Basis',
        'genericItems.tabs.basis.title': 'Basis',
        'genericItems.tabs.basis.description': 'Basisbeschreibung',
        'genericItems.tabs.content.label': 'Inhalt',
        'genericItems.tabs.content.title': 'Inhalt',
        'genericItems.tabs.content.description': 'Inhaltsbeschreibung',
        'genericItems.tabs.settings.label': 'Einstellungen',
        'genericItems.tabs.settings.title': 'Einstellungen',
        'genericItems.tabs.settings.description': 'Einstellungsbeschreibung',
        'genericItems.tabs.history.label': 'Historie',
        'genericItems.tabs.history.title': 'Historie',
        'genericItems.tabs.history.description': 'Historienbeschreibung',
        'genericItems.cards.basis.identity.title': 'Identität',
        'genericItems.cards.basis.identity.description': 'Identität Beschreibung',
        'genericItems.cards.basis.meta.title': 'Metadaten',
        'genericItems.cards.basis.meta.description': 'Metadaten Beschreibung',
        'genericItems.cards.content.text.title': 'Text',
        'genericItems.cards.content.text.description': 'Text Beschreibung',
        'genericItems.cards.content.classification.title': 'Klassifikation',
        'genericItems.cards.content.classification.description': 'Klassifikation Beschreibung',
        'genericItems.cards.content.relations.title': 'Relationen',
        'genericItems.cards.content.relations.description': 'Relationen Beschreibung',
        'genericItems.cards.content.linksMedia.title': 'Links & Medien',
        'genericItems.cards.content.linksMedia.description': 'Links & Medien Beschreibung',
        'genericItems.cards.content.schedule.title': 'Planung',
        'genericItems.cards.content.schedule.description': 'Planung Beschreibung',
        'genericItems.cards.settings.payload.title': 'Payload',
        'genericItems.cards.settings.payload.description': 'Payload Beschreibung',
        'genericItems.cards.settings.secondary.title': 'Sekundär',
        'genericItems.cards.settings.secondary.description': 'Sekundär Beschreibung',
        'genericItems.fields.visible': 'Sichtbar',
        'genericItems.fields.author': 'Autor',
        'genericItems.fields.keywords': 'Schlagwörter',
        'genericItems.fields.externalId': 'Externe ID',
        'genericItems.fields.publicationDate': 'Publikationsdatum',
        'genericItems.fields.publishedAt': 'Veröffentlicht am',
        'genericItems.fields.teaser': 'Teaser',
        'genericItems.fields.categoryName': 'Primärkategorie',
        'genericItems.fields.categories': 'Kategorien',
        'genericItems.fields.categoriesHelp': 'Wählen Sie keine, eine oder mehrere Kategorien aus.',
        'genericItems.fields.categoriesSearch': 'Kategorien suchen',
        'genericItems.fields.categoriesSearchPlaceholder': 'Kategorie suchen oder auswählen',
        'genericItems.fields.contacts': 'Kontakte',
        'genericItems.fields.webUrls': 'Web-Links',
        'genericItems.fields.addresses': 'Adressen',
        'genericItems.fields.addressAddition': 'Adresszusatz',
        'genericItems.fields.addressKind': 'Adressart',
        'genericItems.fields.street': 'Straße',
        'genericItems.fields.zip': 'PLZ',
        'genericItems.fields.city': 'Ort',
        'genericItems.fields.latitude': 'Breitengrad',
        'genericItems.fields.longitude': 'Längengrad',
        'genericItems.fields.contentBlocks': 'Content-Blocks',
        'genericItems.fields.intro': 'Intro',
        'genericItems.fields.body': 'Inhalt',
        'genericItems.fields.openingHours': 'Öffnungszeiten',
        'genericItems.fields.mediaContents': 'Medien',
        'genericItems.fields.mediaCaption': 'Bildunterschrift',
        'genericItems.fields.mediaCopyright': 'Copyright',
        'genericItems.fields.mediaContentType': 'Medientyp',
        'genericItems.fields.imageSearch': 'Bildsuche',
        'genericItems.fields.locations': 'Orte',
        'genericItems.fields.locationName': 'Ortsname',
        'genericItems.fields.department': 'Bereich',
        'genericItems.fields.district': 'Bezirk',
        'genericItems.fields.regionName': 'Region',
        'genericItems.fields.state': 'Bundesland/Land',
        'genericItems.fields.dates': 'Termine',
        'genericItems.fields.dateStart': 'Start',
        'genericItems.fields.dateEnd': 'Ende',
        'genericItems.fields.timeStart': 'Beginn',
        'genericItems.fields.timeEnd': 'Ende Uhrzeit',
        'genericItems.fields.dateFrom': 'Datum von',
        'genericItems.fields.dateTo': 'Datum bis',
        'genericItems.fields.timeFrom': 'Uhrzeit von',
        'genericItems.fields.timeTo': 'Uhrzeit bis',
        'genericItems.fields.weekday': 'Wochentag',
        'genericItems.fields.timeDescription': 'Zeitbeschreibung',
        'genericItems.fields.useOnlyTimeDescription': 'Nur Zeitbeschreibung verwenden',
        'genericItems.fields.description': 'Beschreibung',
        'genericItems.fields.open': 'Geöffnet',
        'genericItems.fields.accessibilityInformations': 'Barrierefreiheit',
        'genericItems.fields.accessibilityTypes': 'Barrierefreiheits-Typen',
        'genericItems.fields.accessibilityLinks': 'Weiterführende Links',
        'genericItems.fields.priceInformations': 'Preise',
        'genericItems.fields.priceName': 'Preisname',
        'genericItems.fields.priceAmount': 'Betrag',
        'genericItems.fields.priceCategory': 'Preiskategorie',
        'genericItems.fields.priceDescription': 'Preisbeschreibung',
        'genericItems.fields.groupPrice': 'Gruppenpreis',
        'genericItems.fields.ageFrom': 'Alter von',
        'genericItems.fields.ageTo': 'Alter bis',
        'genericItems.fields.minAdultCount': 'Erwachsene mindestens',
        'genericItems.fields.maxAdultCount': 'Erwachsene höchstens',
        'genericItems.fields.minChildrenCount': 'Kinder mindestens',
        'genericItems.fields.maxChildrenCount': 'Kinder höchstens',
        'genericItems.fields.payload': 'Payload',
        'genericItems.fields.firstName': 'Vorname',
        'genericItems.fields.lastName': 'Nachname',
        'genericItems.fields.email': 'E-Mail',
        'genericItems.fields.phone': 'Telefon',
        'genericItems.fields.url': 'URL',
        'genericItems.fields.urlDescription': 'Linkbeschreibung',
        'genericItems.history.placeholder': 'Später',
        'genericItems.pagination.ariaLabel': 'Pagination',
        'genericItems.pagination.previous': 'Zurück',
        'genericItems.pagination.next': 'Weiter',
        'genericItems.pagination.pageLabel': 'Seite {{page}}',
        'genericItems.actions.addAddress': 'Adresse hinzufügen',
        'genericItems.actions.addOpeningHour': 'Öffnungszeit hinzufügen',
        'genericItems.actions.addImage': 'Aus Medienbibliothek wählen',
        'genericItems.actions.addLocation': 'Ort hinzufügen',
        'genericItems.actions.addAccessibilityInformation': 'Barrierefreiheit hinzufügen',
        'genericItems.actions.addPriceInformation': 'Preis hinzufügen',
        'genericItems.actions.uploadMedia': 'Bild hochladen',
        'genericItems.actions.uploadingMedia': 'Bild wird hochgeladen',
        'genericItems.actions.addMediaManual': 'Medium manuell ergänzen',
        'genericItems.actions.selectImage': 'Bild auswählen',
        'genericItems.actions.addContentBlock': 'Block hinzufügen',
        'genericItems.actions.addCategory': 'Kategorie hinzufügen',
        'genericItems.actions.addLink': 'Link hinzufügen',
        'genericItems.actions.addContact': 'Kontakt hinzufügen',
        'genericItems.actions.addDate': 'Termin hinzufügen',
        'genericItems.actions.removeImage': 'Bild entfernen',
        'genericItems.actions.removeCategory': 'Kategorie {{name}} entfernen',
        'genericItems.actions.remove': 'Entfernen',
        'genericItems.content.addressItem': 'Adresse',
        'genericItems.content.blockItem': 'Inhaltsblock',
        'genericItems.content.openingHourItem': 'Öffnungszeit',
        'genericItems.content.locationItem': 'Ort',
        'genericItems.content.accessibilityInformationItem': 'Barrierefreiheitsangabe',
        'genericItems.content.priceInformationItem': 'Preiseintrag',
        'genericItems.values.notAvailable': 'Nicht verfügbar',
        'genericItems.values.mediaContentTypes.unspecified': 'Nicht festgelegt',
        'genericItems.values.mediaContentTypes.image': 'Bild',
        'genericItems.values.mediaContentTypes.audio': 'Audio',
        'genericItems.values.mediaContentTypes.video': 'Video',
        'genericItems.values.mediaContentTypes.logo': 'Logo',
        'genericItems.values.mediaContentTypes.attachment': 'Anhang',
        'genericItems.values.weekdays.MO': 'Montag',
        'genericItems.values.weekdays.TU': 'Dienstag',
        'genericItems.values.weekdays.WE': 'Mittwoch',
        'genericItems.values.weekdays.TH': 'Donnerstag',
        'genericItems.values.weekdays.FR': 'Freitag',
        'genericItems.values.weekdays.SA': 'Samstag',
        'genericItems.values.weekdays.SU': 'Sonntag',
        'genericItems.richText.blockType': 'Textformat',
        'genericItems.richText.paragraph': 'Absatz',
        'genericItems.richText.heading2': 'Überschrift 2',
        'genericItems.richText.heading3': 'Überschrift 3',
        'genericItems.richText.blockquote': 'Zitat',
        'genericItems.richText.bulletList': 'Aufzählung',
        'genericItems.richText.orderedList': 'Nummerierung',
        'genericItems.richText.bold': 'Fett',
        'genericItems.richText.italic': 'Kursiv',
        'genericItems.richText.undo': 'Zurück',
        'genericItems.richText.redo': 'Vorwärts',
        'genericItems.richText.applyLink': 'Link setzen',
        'genericItems.richText.linkInput': 'Link-URL',
        'genericItems.messages.imagePickerEmpty': 'Keine passenden Bilder gefunden.',
        'genericItems.messages.categoryOptionsLoading': 'Kategorien werden geladen.',
        'genericItems.messages.categoryOptionsLoadError': 'Kategorien konnten nicht geladen werden.',
        'genericItems.messages.mediaUploadInitializing': 'Upload wird vorbereitet.',
        'genericItems.messages.mediaUploadUploading': 'Bild wird hochgeladen.',
        'genericItems.messages.mediaUploadFinalizing': 'Bild wird eingebunden.',
        'genericItems.messages.mediaUploadSuccess': 'Bild wurde hinzugefügt.',
        'genericItems.messages.mediaUploadError': 'Bild konnte nicht hochgeladen werden.',
        'genericItems.messages.mediaUploadUnsupportedType': 'Dieser Dateityp wird nicht unterstützt.',
        'genericItems.messages.mediaUploadUnavailableUrl': 'Dieses Medium hat keine öffentliche URL.',
        'genericItems.validation.categories': 'Kategorien benötigen einen Namen mit maximal 128 Zeichen.',
        'genericItems.validation.priceInformations': 'Preisangaben müssen valide Zahlen enthalten.',
        'genericItems.validation.webUrls': 'URLs müssen mit https:// beginnen.',
        'genericItems.editor.createTitle': 'Generic Item anlegen',
        'genericItems.editor.createDescription': 'Erstellen',
        'genericItems.editor.editTitle': 'Generic Item bearbeiten',
        'genericItems.editor.editDescription': 'Bearbeiten',
      };
      return map[key] ?? key;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the empty state when no generic items exist', async () => {
    render(<GenericItemsListPage />);

    await waitFor(() => {
      expect(screen.getByText('Noch keine Generic Items vorhanden')).toBeTruthy();
    });
  });

  it('renders create and edit pages', async () => {
    render(<GenericItemsCreatePage />);
    expect(screen.getByRole('heading', { name: 'Generic Item anlegen' })).toBeTruthy();

    render(<GenericItemsEditPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehender Eintrag')).toBeTruthy();
    });
  });
});
