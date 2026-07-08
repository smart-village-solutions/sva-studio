import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { listHostMediaAssets, registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPoi, getPoi, listPoi, listPoiCategories, updatePoi } from '../src/poi.api.js';
import { PoiCreatePage, PoiEditPage, PoiListPage } from '../src/poi.pages.js';

vi.mock('@sva/studio-ui-react', async () => {
  const actual = await vi.importActual<typeof import('@sva/studio-ui-react')>('@sva/studio-ui-react');
  return {
    ...actual,
    RichTextHtmlEditor: ({
      id,
      value,
      onChange,
      labelId,
    }: {
      id: string;
      value: string;
      onChange: (nextValue: string) => void;
      labelId?: string;
    }) => (
      <textarea
        id={id}
        aria-labelledby={labelId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ),
  };
});

vi.mock('../src/poi.api.js', () => ({
  listPoi: vi.fn(async () => ({
    data: [],
    pagination: { page: 1, pageSize: 25, hasNextPage: false },
  })),
  getPoi: vi.fn(async () => ({
    id: 'poi-1',
    name: 'Stadtbibliothek',
    description: 'Öffentliche Bibliothek',
    mobileDescription: 'Bücher und mehr',
    active: true,
    categoryName: 'Bildung',
    addresses: [{ street: 'Markt 2', city: 'Musterhausen' }],
    webUrls: [{ url: 'https://example.com/poi' }],
    openingHours: [{ weekday: 'Montag', timeFrom: '09:00' }],
    mediaContents: [{ captionText: 'Bibliothek', sourceUrl: { url: 'https://example.com/poi/library.jpg' } }],
    payload: { source: 'legacy' },
  })),
  listPoiCategories: vi.fn(async () => []),
  createPoi: vi.fn(async () => ({ id: 'poi-created' })),
  updatePoi: vi.fn(async () => ({ id: 'poi-1' })),
  deletePoi: vi.fn(),
  PoiApiError: class PoiApiError extends Error {},
}));

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
    listHostMediaAssets: vi.fn(async () => []),
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigateMock,
  useParams: () => paramsMock(),
  useSearch: () => ({ page: 1, pageSize: 25 }),
}));

vi.mock('../src/poi.map-geocoding-client.js', () => ({
  getMapGeocodingConfig: vi.fn(async () => ({
    provider: 'geoapify' as const,
    styleUrl: 'https://tileserver.example/style.json',
    autocompleteEnabled: true,
    geocodeEnabled: true,
    reverseGeocodeEnabled: true,
    killSwitchEnabled: false,
  })),
  suggestMapAddresses: vi.fn(),
  reverseMapCoordinates: vi.fn(),
}));

const navigateMock = vi.fn();
const paramsMock = vi.fn(() => ({ id: 'poi-1' }));

describe('PoiListPage', () => {
  const switchSection = (value: string) => {
    fireEvent.change(screen.getByLabelText('Bereich'), { target: { value } });
  };
  const getEditableNameInput = () =>
    screen
      .getAllByLabelText('Name')
      .find((element): element is HTMLInputElement => element instanceof HTMLInputElement && element.readOnly === false);

  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    paramsMock.mockReset();
    paramsMock.mockReturnValue({ id: 'poi-1' });
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'poi.list.title': 'Orte',
        'poi.list.description': 'Orte aus dem Mainserver bearbeiten.',
        'poi.messages.loading': 'Orte werden geladen.',
        'poi.messages.loadError': 'Orte konnten nicht geladen werden.',
        'poi.messages.missingContent': 'Der Ort konnte nicht geladen werden.',
        'poi.messages.saveError': 'Der Ort konnte nicht gespeichert werden.',
        'poi.messages.createSuccess': 'Der Ort wurde erstellt.',
        'poi.messages.updateSuccess': 'Der Ort wurde aktualisiert.',
        'poi.messages.validationError': 'Bitte korrigieren Sie die markierten Felder.',
        'poi.empty.title': 'Noch keine Orte vorhanden',
        'poi.actions.create': 'Ort anlegen',
        'poi.actions.save': 'Speichern',
        'poi.actions.update': 'Änderungen speichern',
        'poi.actions.back': 'Zurück zur Liste',
        'poi.actions.delete': 'Löschen',
        'poi.actions.clearMedia': 'Medium entfernen',
        'poi.fields.actions': 'Aktionen',
        'poi.fields.name': 'Name',
        'poi.fields.description': 'Beschreibung',
        'poi.fields.mobileDescription': 'Mobile Beschreibung',
        'poi.fields.active': 'Aktiv',
        'poi.fields.categoryName': 'Kategorie',
        'poi.fields.categories': 'Kategorien',
        'poi.fields.categoriesHelp': 'Wählen Sie keine, eine oder mehrere Kategorien aus.',
        'poi.fields.categoriesSearch': 'Kategorien suchen',
        'poi.fields.categoriesSearchPlaceholder': 'Kategorie suchen oder auswählen',
        'poi.fields.street': 'Straße',
        'poi.fields.city': 'Ort',
        'poi.fields.email': 'E-Mail',
        'poi.fields.url': 'Web-URL',
        'poi.fields.urlDescription': 'Link-Beschreibung',
        'poi.fields.weekday': 'Wochentag',
        'poi.fields.dateFrom': 'Startdatum',
        'poi.fields.dateTo': 'Enddatum',
        'poi.fields.timeFrom': 'Startzeit',
        'poi.fields.timeTo': 'Endzeit',
        'poi.fields.open': 'Geöffnet',
        'poi.fields.payload': 'Payload JSON',
        'poi.fields.imageSearch': 'Dateiname filtern',
        'poi.fields.createdAt': 'Erstellt',
        'poi.fields.updatedAt': 'Aktualisiert',
        'poi.pagination.ariaLabel': 'Orte-Pagination',
        'poi.pagination.previous': 'Zurück',
        'poi.pagination.next': 'Weiter',
        'poi.pagination.pageLabel': 'Seite {{page}}',
        'poi.values.notAvailable': 'Nicht verfügbar',
        'poi.values.active': 'Ja',
        'poi.detail.createTitle': 'Ort anlegen',
        'poi.detail.createDescription': 'Erstellen Sie einen neuen Ort.',
        'poi.detail.editTitle': 'Ort bearbeiten',
        'poi.detail.editDescription': 'Aktualisieren oder löschen Sie den Ort.',
        'poi.detailTabs.basis.title': 'Basis',
        'poi.detailTabs.content.title': 'Inhalt',
        'poi.detailTabs.settings.title': 'Einstellungen',
        'poi.detailTabs.history.title': 'Historie',
        'poi.tabs.mobileLabel': 'Bereich',
        'poi.tabs.ariaLabel': 'Bereiche',
        'poi.cards.basis.identity.title': 'Basisdaten',
        'poi.cards.basis.identity.description': 'Name, Kategorie und Aktivstatus.',
        'poi.cards.basis.meta.title': 'Metadaten',
        'poi.cards.basis.meta.description': 'Zeitliche Einordnung des Eintrags.',
        'poi.cards.location.address.title': 'Lage und Adresse',
        'poi.cards.location.address.description': 'Adressdaten des Ortes.',
        'poi.cards.location.coordinates.title': 'Koordinaten',
        'poi.cards.location.coordinates.description': 'Geo-Daten des Ortes.',
        'poi.cards.description.text.title': 'Beschreibungen',
        'poi.cards.description.text.description': 'Redaktionelle Beschreibungen des Ortes.',
        'poi.cards.contact.primary.title': 'Kontakt',
        'poi.cards.contact.primary.description': 'Kontaktinformationen für den Ort.',
        'poi.cards.openingHours.entries.title': 'Öffnungszeiten',
        'poi.cards.openingHours.entries.description': 'Aktuelle Öffnungsinformationen.',
        'poi.cards.openingHours.entry.title': 'Öffnungszeit',
        'poi.cards.links.entries.title': 'Weblinks',
        'poi.cards.links.entries.description': 'Externe Verweise zum Ort.',
        'poi.cards.operator.details.title': 'Betreiber',
        'poi.cards.operator.details.description': 'Betreiberdaten und Kontakte.',
        'poi.cards.prices.entries.title': 'Preise',
        'poi.cards.prices.entries.description': 'Preisangaben des Ortes.',
        'poi.cards.settings.media.title': 'Bilder',
        'poi.cards.settings.media.description': 'Bilder des Ortes verwalten.',
        'poi.cards.advanced.payload.title': 'Zusatzdaten',
        'poi.cards.advanced.payload.description': 'Zusätzliche Mainserver-Daten als JSON.',
        'poi.history.empty.title': 'Noch keine Historie verfügbar.',
        'poi.history.empty.description': 'Historienereignisse für Orte werden in einem späteren Schritt angebunden.',
        'poi.editor.createTitle': 'Ort anlegen',
        'poi.editor.createDescription': 'Erstellen Sie einen neuen Ort.',
        'poi.editor.editTitle': 'Ort bearbeiten',
        'poi.editor.editDescription': 'Aktualisieren oder löschen Sie den Ort.',
        'poi.validation.name': 'Der Name ist erforderlich.',
        'poi.validation.webUrls': 'URLs müssen mit https:// beginnen.',
        'poi.validation.categoryName': 'Die Kategorie darf maximal 128 Zeichen haben.',
        'poi.validation.categories': 'Kategorien benötigen einen Namen mit maximal 128 Zeichen.',
        'poi.validation.payload': 'Payload muss gültiges JSON sein.',
        'poi.fields.locationName': 'Ortsbezeichnung',
        'poi.fields.assetId': 'Asset-ID',
        'poi.fields.label': 'Bezeichnung',
        'poi.fields.timeTo': 'Schließt',
        'poi.fields.priceName': 'Preisname',
        'poi.fields.amount': 'Betrag',
        'poi.fields.certificateName': 'Zertifikat',
        'poi.fields.accessibilityDescription': 'Barrierefreiheit',
        'poi.fields.accessibilityTypes': 'Barrierefreiheits-Typen',
        'poi.fields.tags': 'Tags',
        'poi.actions.add': 'Hinzufügen',
        'poi.actions.addMediaManual': 'Manuell hinzufügen',
        'poi.actions.addCategory': 'Kategorie hinzufügen',
        'poi.actions.addOpeningHour': 'Öffnungszeit hinzufügen',
        'poi.actions.remove': 'Entfernen',
        'poi.actions.removeCategory': 'Kategorie {{name}} entfernen',
        'poi.actions.addImage': 'Aus Mediathek auswählen',
        'poi.actions.uploadMedia': 'Medium hochladen',
        'poi.actions.selectImage': 'Auswählen',
        'poi.actions.removeImage': 'Entfernen',
        'poi.messages.imagePickerEmpty': 'Keine Bilder gefunden.',
        'poi.messages.categoryOptionsLoading': 'Kategorien werden geladen.',
        'poi.messages.categoryOptionsLoadError': 'Die Kategorien konnten nicht geladen werden.',
      };
      return labels[key] ?? key;
    });
    vi.mocked(listHostMediaAssets).mockResolvedValue([
      {
        id: 'asset-teaser',
        fileName: 'teaser-asset.jpg',
        mimeType: 'image/jpeg',
        previewUrl: 'https://cdn.example.test/teaser-asset.jpg',
        metadata: { title: 'Teaser Asset' },
      },
    ]);
    vi.mocked(listPoiCategories).mockResolvedValue([
      { id: 'cat-1', name: 'Bildung' },
      { id: 'cat-2', name: 'Verwaltung' },
    ] as never);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the empty state when no poi exist', async () => {
    render(<PoiListPage />);

    await waitFor(() => {
      expect(screen.getByText('Noch keine Orte vorhanden')).toBeTruthy();
    });
  });

  it('renders a load error when listing poi fails', async () => {
    vi.mocked(listPoi).mockRejectedValueOnce(new Error('boom'));

    render(<PoiListPage />);

    await waitFor(() => {
      expect(screen.getByText('Orte konnten nicht geladen werden.')).toBeTruthy();
    });
  });

  it('creates poi mediaContents from the media library selection', async () => {
    render(<PoiCreatePage />);

    await waitFor(() => {
      expect(listHostMediaAssets).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rathaus' } });
    fireEvent.change(screen.getByLabelText('Kategorien suchen'), { target: { value: 'Verwaltung' } });
    switchSection('content');
    fireEvent.change(screen.getByLabelText('Beschreibung', { selector: 'textarea' }), {
      target: { value: 'Bürgerservice vor Ort' },
    });
    fireEvent.change(document.getElementById('poi-link-url-0') as HTMLInputElement, {
      target: { value: 'https://example.com/poi' },
    });
    switchSection('content');
    fireEvent.click(screen.getByRole('button', { name: 'Aus Mediathek auswählen' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Auswählen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(createPoi).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Rathaus',
          categoryName: 'Verwaltung',
          categories: [{ name: 'Verwaltung' }],
          description: 'Bürgerservice vor Ort',
          webUrls: [{ url: 'https://example.com/poi' }],
          mediaContents: [
            expect.objectContaining({
              captionText: 'Teaser Asset',
              contentType: 'image',
              sourceUrl: {
                url: 'https://cdn.example.test/teaser-asset.jpg',
                description: 'teaser-asset.jpg',
              },
            }),
          ],
        })
      );
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/poi/$id', params: { id: 'poi-created' } });
    });
  }, 10_000);

  it('loads existing poi mediaContents on edit and keeps the update flow stable', async () => {
    render(<PoiEditPage />);

    await waitFor(() => {
      expect(getPoi).toHaveBeenCalledWith('poi-1');
      expect(screen.getByDisplayValue('Stadtbibliothek')).toBeTruthy();
    });

    switchSection('content');
    await waitFor(() => {
      expect(screen.getByDisplayValue('https://example.com/poi/library.jpg')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    switchSection('basis');
    await waitFor(() => {
      expect(getEditableNameInput()).toBeTruthy();
    });
    const nameInput = getEditableNameInput();
    expect(nameInput).toBeTruthy();
    fireEvent.change(nameInput as HTMLInputElement, { target: { value: 'Aktualisierte Stadtbibliothek' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(updatePoi).toHaveBeenCalledWith(
        'poi-1',
        expect.objectContaining({
          name: 'Aktualisierte Stadtbibliothek',
          description: 'Öffentliche Bibliothek',
          webUrls: [{ url: 'https://example.com/poi' }],
          mediaContents: [],
          payload: { source: 'legacy' },
        })
      );
      expect(screen.getByText('Der Ort wurde aktualisiert.')).toBeTruthy();
    });
  });

  it('clears a previous success status before a validation-blocked submit', async () => {
    render(<PoiEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtbibliothek')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(screen.getByText('Der Ort wurde aktualisiert.')).toBeTruthy();
    });

    switchSection('content');
    await waitFor(() => {
      expect(screen.getAllByLabelText('Web-URL').length).toBeGreaterThan(1);
    });
    fireEvent.change(document.getElementById('poi-link-url-0') as HTMLInputElement, {
      target: { value: 'http://invalid.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(screen.queryByText('Der Ort wurde aktualisiert.')).toBeNull();
      expect(updatePoi).toHaveBeenCalledTimes(1);
    });
  });
});
