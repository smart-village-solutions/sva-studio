import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { listHostMediaAssets, listHostMediaReferencesByTarget, registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPoi, deletePoi, getPoi, updatePoi } from '../src/poi.api.js';

import { PoiDetailPage } from '../src/poi.detail-page.js';

const navigateMock = vi.fn();
const replaceHostMediaReferencesMock = vi.fn(async (input: unknown) => input);

vi.mock('../src/poi.api.js', () => ({
  createPoi: vi.fn(),
  deletePoi: vi.fn(),
  getPoi: vi.fn(),
  listPoi: vi.fn(),
  PoiApiError: class PoiApiError extends Error {},
  updatePoi: vi.fn(),
}));

vi.mock('../src/poi.location-map.js', () => ({
  PoiLocationMap: () => <div data-testid="poi-location-map" />,
}));

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
    getHostMapGeocodingConfig: vi.fn(async () => ({
      provider: 'geoapify',
      styleUrl: 'https://tiles.example/styles/poi',
      autocompleteEnabled: false,
      geocodeEnabled: true,
      reverseGeocodeEnabled: true,
      killSwitchEnabled: false,
    })),
    listHostMediaAssets: vi.fn(async () => []),
    listHostMediaReferencesByTarget: vi.fn(async () => []),
    uploadHostMediaFile: vi.fn(async () => ({ assetId: 'uploaded-asset', uploadSessionId: 'upload-1' })),
    replaceHostMediaReferences: (...args: Parameters<typeof replaceHostMediaReferencesMock>) =>
      replaceHostMediaReferencesMock(...args),
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigateMock,
}));

describe('PoiDetailPage', () => {
  const switchSection = (value: string) => {
    fireEvent.change(screen.getByLabelText('Bereich'), { target: { value } });
  };

  beforeEach(() => {
    navigateMock.mockReset();
    replaceHostMediaReferencesMock.mockClear();
    vi.mocked(createPoi).mockReset();
    vi.mocked(deletePoi).mockReset();
    vi.mocked(getPoi).mockReset();
    vi.mocked(updatePoi).mockReset();
    vi.mocked(listHostMediaAssets).mockReset();
    vi.mocked(listHostMediaAssets).mockResolvedValue([] as never);
    vi.mocked(listHostMediaReferencesByTarget).mockReset();
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValue([] as never);
    vi.unstubAllGlobals();
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'poi.detail.createTitle': 'Ort anlegen',
        'poi.detail.editTitle': 'Ort bearbeiten',
        'poi.actions.save': 'Speichern',
        'poi.actions.delete': 'Löschen',
        'poi.detailTabs.basis.title': 'Basis',
        'poi.detailTabs.content.title': 'Inhalt',
        'poi.detailTabs.settings.title': 'Einstellungen',
        'poi.detailTabs.history.title': 'Historie',
        'poi.tabs.mobileLabel': 'Bereich',
        'poi.tabs.ariaLabel': 'Bereiche',
        'poi.cards.location.address.title': 'Lage und Adresse',
        'poi.cards.location.address.description': 'Adressdaten, Karte und Koordinaten',
        'poi.cards.description.text.title': 'Beschreibungen',
        'poi.cards.description.text.description': 'Texte',
        'poi.cards.contact.primary.title': 'Kontakt',
        'poi.cards.contact.primary.description': 'Kontaktfelder',
        'poi.cards.openingHours.entries.title': 'Öffnungszeiten',
        'poi.cards.openingHours.entries.description': 'Zeitfenster',
        'poi.cards.openingHours.entry.title': 'Öffnungszeit',
        'poi.cards.links.entries.title': 'Weblinks',
        'poi.cards.links.entries.description': 'Weblinks',
        'poi.cards.operator.details.title': 'Betreiber',
        'poi.cards.operator.details.description': 'Betriebsdaten',
        'poi.cards.prices.entries.title': 'Preise',
        'poi.cards.prices.entries.description': 'Preisangaben',
        'poi.cards.media.entries.title': 'Medieninhalte',
        'poi.cards.media.entries.description': 'Medienquellen',
        'poi.cards.settings.media.title': 'Bilder',
        'poi.cards.settings.media.description': 'Bilder des Ortes verwalten',
        'poi.cards.advanced.payload.title': 'Zusatzdaten',
        'poi.cards.advanced.payload.description': 'Payload und Zusatzfelder',
        'poi.fields.name': 'Name',
        'poi.fields.operatorName': 'Name des Betreibers',
        'poi.fields.firstName': 'Vorname',
        'poi.fields.lastName': 'Nachname',
        'poi.fields.street': 'Straße',
        'poi.fields.city': 'Ort',
        'poi.fields.zip': 'PLZ',
        'poi.fields.locationName': 'Ortsbezeichnung',
        'poi.fields.latitude': 'Breitengrad',
        'poi.fields.longitude': 'Längengrad',
        'poi.fields.dateFrom': 'Startdatum',
        'poi.fields.dateTo': 'Enddatum',
        'poi.fields.description': 'Beschreibung',
        'poi.fields.mobileDescription': 'Mobile Beschreibung',
        'poi.fields.url': 'URL',
        'poi.fields.urlDescription': 'Link-Beschreibung',
        'poi.fields.email': 'E-Mail',
        'poi.fields.phone': 'Telefon',
        'poi.fields.fax': 'Fax',
        'poi.fields.weekday': 'Wochentag',
        'poi.fields.open': 'Geöffnet',
        'poi.fields.timeFrom': 'Startzeit',
        'poi.fields.timeTo': 'Endzeit',
        'poi.fields.priceCategory': 'Preiskategorie',
        'poi.fields.priceDescription': 'Preisbeschreibung',
        'poi.fields.mediaCaption': 'Medienbeschriftung',
        'poi.fields.mediaCopyright': 'Copyright',
        'poi.fields.mediaContentType': 'Medientyp',
        'poi.fields.payload': 'Payload',
        'poi.messages.validationError': 'Bitte Eingaben prüfen.',
        'poi.validation.webUrls': 'URLs müssen mit https:// beginnen.',
        'poi.validation.geoLocation': 'Koordinaten müssen gültige Breiten- und Längengrade sein.',
        'poi.history.empty.title': 'Noch keine Historie verfügbar.',
        'poi.messages.createSuccess': 'Ort erstellt.',
        'poi.messages.updateSuccess': 'Ort aktualisiert.',
        'poi.messages.deleteError': 'Ort konnte nicht gelöscht werden.',
        'poi.messages.locationGeocodeError': 'Geo-Koordinaten nicht verfügbar.',
        'poi.messages.locationGeocodeEmpty': 'Keine Geo-Koordinaten gefunden.',
        'poi.messages.locationMapUnavailable': 'Karte deaktiviert.',
        'poi.messages.locationMapError': 'Karte nicht verfügbar.',
        'poi.messages.mediaReferencesUnavailable': 'Medienreferenzen konnten nicht geladen werden.',
        'poi.actions.deleteConfirm': 'Wirklich löschen?',
        'poi.actions.geocodeAddress': 'Geo-Koordinaten ermitteln',
        'poi.actions.geocodingAddress': 'Geo-Koordinaten werden ermittelt',
        'poi.actions.addOpeningHour': 'Öffnungszeit hinzufügen',
        'poi.actions.addImage': 'Bild hinzufügen',
        'poi.actions.selectImage': 'Auswählen',
        'poi.actions.removeImage': 'Entfernen',
        'poi.actions.closeImagePicker': 'Schließen',
        'poi.fields.imageSearch': 'Dateiname filtern',
        'poi.fields.imageFileName': 'Dateiname',
        'poi.messages.imagePickerEmpty': 'Keine Bilder gefunden.',
      };

      return labels[key] ?? key;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the fixed tab order for poi', async () => {
    render(<PoiDetailPage mode="create" />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Basis' })).toBeTruthy();
    });

    expect(screen.getByRole('tab', { name: 'Inhalt' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Einstellungen' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Historie' })).toBeTruthy();
  });

  it('shows the content section cards inside the content tab', async () => {
    render(<PoiDetailPage mode="create" />);
    switchSection('content');

    await waitFor(() => {
      expect(screen.getAllByLabelText('Straße').length).toBeGreaterThan(1);
      expect(screen.getAllByLabelText('Breitengrad').length).toBeGreaterThan(1);
      expect(screen.getByLabelText('Name des Betreibers')).toBeTruthy();
      expect(screen.getAllByLabelText('Vorname').length).toBeGreaterThan(1);
      expect(screen.getAllByLabelText('Fax').length).toBeGreaterThan(1);
      expect(screen.getByLabelText('Startdatum')).toBeTruthy();
      expect(screen.getByLabelText('Enddatum')).toBeTruthy();
      expect(screen.getByLabelText('Wochentag')).toBeTruthy();
      expect(screen.getAllByLabelText('URL').length).toBeGreaterThan(1);
      expect(screen.getByText('Medieninhalte')).toBeTruthy();
      expect(screen.getByLabelText('Preiskategorie')).toBeTruthy();
      expect(screen.getByLabelText('Preisbeschreibung')).toBeTruthy();
      expect(screen.getByLabelText('Medienbeschriftung')).toBeTruthy();
    });
  });

  it('manages poi image references in the settings tab through the media library overlay', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
    } as never);
    vi.mocked(listHostMediaAssets).mockResolvedValueOnce([
      {
        id: 'asset-1',
        fileName: 'rathaus-aussen.jpg',
        mimeType: 'image/jpeg',
        previewUrl: 'https://cdn.example.test/rathaus-aussen.jpg',
        metadata: { title: 'Rathaus außen' },
      },
      {
        id: 'asset-2',
        fileName: 'stadtpark.jpg',
        mimeType: 'image/jpeg',
        previewUrl: 'https://cdn.example.test/stadtpark.jpg',
        metadata: { title: 'Stadtpark' },
      },
    ] as never);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValueOnce([
      { id: 'reference-1', assetId: 'asset-1', role: 'attachment_image' },
    ] as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('settings');

    await waitFor(() => {
      expect(screen.getByText('Bilder')).toBeTruthy();
      expect(screen.getByText('Rathaus außen')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Bild hinzufügen' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByLabelText('Dateiname filtern')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Dateiname filtern'), { target: { value: 'stadtpark' } });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Rathaus außen')).toBeNull();
    expect(within(dialog).getByText('Stadtpark')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Auswählen' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText('Stadtpark')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Entfernen' })[0]!);

    await waitFor(() => {
      expect(screen.queryByText('Rathaus außen')).toBeNull();
      expect(screen.getByText('Stadtpark')).toBeTruthy();
    });
  });

  it('keeps the image picker stable when legacy media references contain non-string asset ids', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
    } as never);
    vi.mocked(listHostMediaAssets).mockResolvedValueOnce([
      { id: 'asset-1', metadata: { title: 'Rathaus außen' } },
      { id: 'asset-2', metadata: { title: 'Stadtpark' } },
    ] as never);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValueOnce([
      { id: 'reference-1', assetId: 42 as never, role: 'attachment_image' },
    ] as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('settings');
    fireEvent.click(screen.getByRole('button', { name: 'Bild hinzufügen' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Dateiname filtern'), { target: { value: 'stadtpark' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Auswählen' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getAllByText('Stadtpark').length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: 'Entfernen' })).toHaveLength(2);
    });
  });

  it('renders a global save action and a history placeholder for poi', async () => {
    render(<PoiDetailPage mode="create" />);

    expect(await screen.findByRole('button', { name: 'Speichern' })).toBeTruthy();
    switchSection('history');
    expect(screen.getByText('Noch keine Historie verfügbar.')).toBeTruthy();
  });

  it('keeps the poi editor loading until media references are hydrated', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      description: 'Zentraler Servicepunkt',
      active: true,
      categoryName: 'Verwaltung',
      addresses: [{ street: 'Marktplatz 1', city: 'Musterhausen' }],
      webUrls: [{ url: 'https://example.com/poi' }],
      payload: { source: 'test' },
    } as never);
    let resolveReferences: ((value: readonly unknown[]) => void) | null = null;
    vi.mocked(listHostMediaReferencesByTarget).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReferences = resolve as (value: readonly unknown[]) => void;
        }) as never
    );

    render(<PoiDetailPage mode="edit" contentId="poi-1" instanceId="de-musterhausen" />);

    await waitFor(() => {
      expect(screen.getByText('poi.messages.loading')).toBeTruthy();
    });

    resolveReferences?.([]);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });
  });

  it('blocks submission on invalid payload json and invalid https links', async () => {
    render(<PoiDetailPage mode="create" />);

    switchSection('content');
    fireEvent.change(document.getElementById('poi-link-url-0') as HTMLInputElement, {
      target: { value: 'http://example.com/poi' },
    });
    switchSection('settings');
    fireEvent.change(screen.getByLabelText('Payload'), { target: { value: '{' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).not.toHaveBeenCalled();
    });

    expect(screen.getByLabelText('Payload').getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps the basis tab active when the name is missing', async () => {
    render(<PoiDetailPage mode="create" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Name')).toBeTruthy();
    });
  });

  it('keeps the content tab active when only the web url is invalid', async () => {
    render(<PoiDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    switchSection('content');
    fireEvent.change(document.getElementById('poi-link-url-0') as HTMLInputElement, {
      target: { value: 'http://invalid.example' },
    });
    switchSection('basis');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).not.toHaveBeenCalled();
      expect(screen.getAllByLabelText('URL').length).toBeGreaterThan(1);
    });
  });

  it('focuses the operator url field when the operator web url is invalid', async () => {
    render(<PoiDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    switchSection('content');
    fireEvent.change(screen.getByLabelText('Name des Betreibers'), { target: { value: 'Stadtwerke' } });
    fireEvent.change(document.getElementById('poi-operator-url') as HTMLInputElement, {
      target: { value: 'http://invalid.example/operator' },
    });
    switchSection('basis');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(document.getElementById('poi-operator-url'));
      expect(screen.getByText('URLs müssen mit https:// beginnen.')).toBeTruthy();
      expect(document.getElementById('poi-operator-url')?.getAttribute('aria-invalid')).toBe('true');
    });
  });

  it('focuses the primary contact url field when the primary contact web url is invalid', async () => {
    render(<PoiDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    switchSection('content');
    fireEvent.change(document.getElementById('poi-contact-url') as HTMLInputElement, {
      target: { value: 'http://invalid.example/contact' },
    });
    switchSection('basis');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(document.getElementById('poi-contact-url'));
      expect(screen.getByText('URLs müssen mit https:// beginnen.')).toBeTruthy();
      expect(document.getElementById('poi-contact-url')?.getAttribute('aria-invalid')).toBe('true');
    });
  });

  it('focuses the first media source url when a media url is invalid', async () => {
    render(<PoiDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    switchSection('content');
    fireEvent.change(document.getElementById('poi-media-url-0') as HTMLInputElement, {
      target: { value: 'http://invalid.example/media.jpg' },
    });
    switchSection('basis');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(document.getElementById('poi-media-url-0'));
      expect(screen.getByText('URLs müssen mit https:// beginnen.')).toBeTruthy();
      expect(document.getElementById('poi-media-url-0')?.getAttribute('aria-invalid')).toBe('true');
    });
  });

  it('focuses the invalid media source url row when later media entries are invalid', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
      mediaContents: [
        { captionText: 'Erstes Bild', sourceUrl: { url: 'https://example.test/one.jpg' } },
        { captionText: 'Zweites Bild', sourceUrl: { url: 'http://invalid.example/two.jpg' } },
      ],
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('content');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(updatePoi)).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(document.getElementById('poi-media-url-1'));
      expect(document.getElementById('poi-media-url-0')?.getAttribute('aria-invalid')).toBeNull();
      expect(document.getElementById('poi-media-url-1')?.getAttribute('aria-invalid')).toBe('true');
    });
  });

  it('focuses the operator latitude field when operator coordinates are invalid', async () => {
    render(<PoiDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    switchSection('content');
    fireEvent.change(screen.getByLabelText('Name des Betreibers'), { target: { value: 'Stadtwerke' } });
    fireEvent.change(document.getElementById('poi-operator-latitude') as HTMLInputElement, {
      target: { value: '91' },
    });
    fireEvent.change(document.getElementById('poi-operator-longitude') as HTMLInputElement, {
      target: { value: '13' },
    });
    switchSection('basis');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(document.getElementById('poi-operator-latitude'));
      expect(screen.getAllByText('Koordinaten müssen gültige Breiten- und Längengrade sein.')).toHaveLength(2);
      expect(document.getElementById('poi-operator-latitude')?.getAttribute('aria-invalid')).toBe('true');
      expect(document.getElementById('poi-operator-longitude')?.getAttribute('aria-invalid')).toBe('true');
    });
  });

  it('renders and persists the mobile description field in the content section', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      description: 'Lang',
      mobileDescription: 'Kurz mobil',
      payload: {},
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('content');

    await waitFor(() => {
      expect(screen.getByDisplayValue('Kurz mobil')).toBeTruthy();
    });
  });

  it('reflects loaded opening hours as checked checkboxes', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      openingHours: [{ weekday: 'MO', open: true }],
      payload: {},
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('content');

    await waitFor(() => {
      expect(screen.getByLabelText('Geöffnet')).toBeTruthy();
    });

    expect((screen.getByLabelText('Geöffnet') as HTMLInputElement).checked).toBe(true);
  });

  it('updates poi items and preserves the loaded image references on save', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      description: 'Zentraler Servicepunkt',
      active: true,
      categoryName: 'Verwaltung',
      addresses: [{ street: 'Marktplatz 1', city: 'Musterhausen' }],
      webUrls: [{ url: 'https://example.com/poi' }],
      payload: { source: 'test' },
    } as never);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValueOnce([
      {
        id: 'reference-1',
        assetId: 'asset-1',
        role: 'attachment_image',
      },
    ] as never);
    vi.mocked(updatePoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" instanceId="de-musterhausen" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(updatePoi)).toHaveBeenCalledTimes(1);
      expect(replaceHostMediaReferencesMock).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        instanceId: 'de-musterhausen',
        targetType: 'poi',
        targetId: 'poi-1',
        references: [
          {
            assetId: 'asset-1',
            role: 'attachment_image',
            sortOrder: 0,
          },
        ],
      });
      expect(screen.getByText('Ort aktualisiert.')).toBeTruthy();
    });
  });

  it('passes the explicit instance context into media host requests when available', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: '1517831',
      name: 'Rathaus',
      payload: {},
    } as never);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValueOnce([
      {
        id: 'reference-1',
        assetId: 'asset-1',
        role: 'attachment_image',
      },
    ] as never);
    vi.mocked(updatePoi).mockResolvedValueOnce({
      id: '1517831',
      name: 'Rathaus',
    } as never);

    render(<PoiDetailPage mode="edit" contentId="1517831" instanceId="de-musterhausen" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    expect(vi.mocked(listHostMediaAssets)).toHaveBeenCalledWith({
      fetch: expect.any(Function),
      instanceId: 'de-musterhausen',
    });
    expect(vi.mocked(listHostMediaReferencesByTarget)).toHaveBeenCalledWith({
      fetch: expect.any(Function),
      instanceId: 'de-musterhausen',
      targetType: 'poi',
      targetId: '1517831',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(replaceHostMediaReferencesMock).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        instanceId: 'de-musterhausen',
        targetType: 'poi',
        targetId: '1517831',
        references: [
          {
            assetId: 'asset-1',
            role: 'attachment_image',
            sortOrder: 0,
          },
        ],
      });
    });
  });

  it('persists poi image references together on save', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
    } as never);
    vi.mocked(listHostMediaAssets).mockResolvedValueOnce([
      { id: 'asset-1', metadata: { title: 'Teaser' } },
      { id: 'asset-2', metadata: { title: 'Bestehend' } },
      { id: 'asset-3', metadata: { title: 'Neu' } },
    ] as never);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValueOnce([
      { id: 'reference-1', assetId: 'asset-1', role: 'attachment_image', sortOrder: 1 },
      { id: 'reference-2', assetId: 'asset-2', role: 'attachment_image', sortOrder: 0 },
    ] as never);
    vi.mocked(updatePoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('settings');
    await waitFor(() => {
      const removeButtons = screen.getAllByRole('button', { name: 'Entfernen' });
      expect(removeButtons).toHaveLength(2);
      const firstCard = removeButtons[0]!.closest('article');
      const secondCard = removeButtons[1]!.closest('article');
      expect(firstCard).not.toBeNull();
      expect(secondCard).not.toBeNull();
      expect(within(firstCard as HTMLElement).getAllByText('Bestehend').length).toBeGreaterThan(0);
      expect(within(secondCard as HTMLElement).getAllByText('Teaser').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bild hinzufügen' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Auswählen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(replaceHostMediaReferencesMock).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        targetType: 'poi',
        targetId: 'poi-1',
        references: [
          { assetId: 'asset-2', role: 'attachment_image', sortOrder: 0 },
          { assetId: 'asset-1', role: 'attachment_image', sortOrder: 1 },
          { assetId: 'asset-3', role: 'attachment_image', sortOrder: 2 },
        ],
      });
    });
  });

  it('preserves non-image media references when saving image changes', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
    } as never);
    vi.mocked(listHostMediaAssets).mockResolvedValueOnce([
      { id: 'asset-1', metadata: { title: 'Bestehend' } },
      { id: 'asset-3', metadata: { title: 'Neu' } },
    ] as never);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValueOnce([
      { id: 'reference-1', assetId: 'asset-1', role: 'attachment_image', sortOrder: 0 },
      { id: 'reference-2', assetId: 'asset-teaser', role: 'teaser_image', sortOrder: 4 },
      { id: 'reference-3', assetId: 'asset-download', role: 'download', sortOrder: 5 },
    ] as never);
    vi.mocked(updatePoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('settings');
    fireEvent.click(screen.getByRole('button', { name: 'Bild hinzufügen' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Auswählen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(replaceHostMediaReferencesMock).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        targetType: 'poi',
        targetId: 'poi-1',
        references: [
          { id: 'reference-2', assetId: 'asset-teaser', role: 'teaser_image', sortOrder: 4 },
          { id: 'reference-3', assetId: 'asset-download', role: 'download', sortOrder: 5 },
          { assetId: 'asset-1', role: 'attachment_image', sortOrder: 0 },
          { assetId: 'asset-3', role: 'attachment_image', sortOrder: 1 },
        ],
      });
    });
  });

  it('sends an empty replacement when all loaded poi images are removed', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
    } as never);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValueOnce([
      { id: 'reference-1', assetId: 'asset-1', role: 'attachment_image', sortOrder: 0 },
    ] as never);
    vi.mocked(updatePoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('settings');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Entfernen' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(replaceHostMediaReferencesMock).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        targetType: 'poi',
        targetId: 'poi-1',
        references: [],
      });
    });
  });

  it('creates poi items, skips media replacement without references, and navigates to the new detail page', async () => {
    vi.mocked(createPoi).mockResolvedValueOnce({
      id: 'poi-created',
      name: 'Neuer POI',
    } as never);

    render(<PoiDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).toHaveBeenCalledTimes(1);
      expect(replaceHostMediaReferencesMock).not.toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/poi/$id', params: { id: 'poi-created' } });
    });
  });

  it('shows translated fallback errors when loading or saving fails unexpectedly', async () => {
    vi.mocked(getPoi).mockRejectedValueOnce(new Error('load boom'));

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByText('poi.messages.missingContent')).toBeTruthy();
    });

    cleanup();
    vi.mocked(createPoi).mockRejectedValueOnce(new Error('save boom'));

    render(<PoiDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(screen.getByText('poi.messages.saveError')).toBeTruthy();
    });
  });

  it('does not delete or navigate away when deletion is cancelled', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
    } as never);
    vi.stubGlobal('confirm', vi.fn(() => false));

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(vi.mocked(deletePoi)).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows the delete fallback error when deleting fails unexpectedly', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
    } as never);
    vi.mocked(deletePoi).mockRejectedValueOnce(new Error('delete boom'));
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(screen.getByText('Ort konnte nicht gelöscht werden.')).toBeTruthy();
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  it('falls back to zero existing media references when loading media links fails', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
    } as never);
    vi.mocked(listHostMediaReferencesByTarget).mockRejectedValueOnce(new Error('media boom'));
    vi.mocked(updatePoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(updatePoi)).toHaveBeenCalledTimes(1);
      expect(replaceHostMediaReferencesMock).not.toHaveBeenCalled();
    });
  });

  it('blocks media reference replacement when existing references failed to load', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
    } as never);
    vi.mocked(listHostMediaAssets).mockResolvedValueOnce([
      { id: 'asset-3', metadata: { title: 'Neu' } },
    ] as never);
    vi.mocked(listHostMediaReferencesByTarget).mockRejectedValueOnce(new Error('media boom'));
    vi.mocked(updatePoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('settings');
    fireEvent.click(screen.getByRole('button', { name: 'Bild hinzufügen' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Auswählen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(screen.getByText('Medienreferenzen konnten nicht geladen werden.')).toBeTruthy();
    });

    expect(vi.mocked(updatePoi)).toHaveBeenCalledTimes(1);
    expect(replaceHostMediaReferencesMock).not.toHaveBeenCalled();
  });

  it('deletes poi items after confirmation and returns to the content overview', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
    } as never);
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(vi.mocked(deletePoi)).toHaveBeenCalledWith('poi-1');
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/content' });
    });
  });
});
