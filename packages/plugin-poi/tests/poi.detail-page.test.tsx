import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  getHostMediaAsset,
  listHostMediaAssets,
  registerPluginTranslationResolver,
  updateHostMediaAsset,
  uploadHostMediaFile,
} from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPoi, deletePoi, getPoi, listPoiCategories, updatePoi } from '../src/poi.api.js';

import { PoiDetailPage } from '../src/poi.detail-page.js';

const navigateMock = vi.fn();

vi.mock('../src/poi.api.js', () => ({
  createPoi: vi.fn(),
  deletePoi: vi.fn(),
  getPoi: vi.fn(),
  listPoiCategories: vi.fn(async () => []),
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
    getHostMediaAsset: vi.fn(async ({ assetId }: { assetId: string }) => {
      const asset = resolveMockMediaAsset(assetId);
      return {
        id: assetId,
        instanceId: 'instance-1',
        storageKey: `media/${asset.fileName}`,
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 2048,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {
          title: asset.title,
          copyright: 'Stadt Musterhausen',
        },
        technical: {},
        previewUrl: asset.previewUrl,
      };
    }),
    listHostMediaAssets: vi.fn(async () => []),
    updateHostMediaAsset: vi.fn(async ({ assetId, metadata }: { assetId: string; metadata: Record<string, string> }) => {
      const asset = resolveMockMediaAsset(assetId);
      return {
        id: assetId,
        instanceId: 'instance-1',
        storageKey: `media/${asset.fileName}`,
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 2048,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {
          title: metadata.title ?? asset.title,
          altText: metadata.altText ?? '',
          description: metadata.description ?? '',
          copyright: metadata.copyright ?? 'Stadt Musterhausen',
          license: metadata.license ?? '',
        },
        technical: {},
        previewUrl: asset.previewUrl,
      };
    }),
    uploadHostMediaFile: vi.fn(async () => ({ assetId: 'uploaded-asset', uploadSessionId: 'upload-1' })),
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigateMock,
}));

const resolveMockMediaAsset = (assetId: string) => {
  if (assetId === 'asset-2') {
    return {
      title: 'Stadtpark',
      previewUrl: 'https://cdn.example.test/stadtpark.jpg',
      fileName: 'stadtpark.jpg',
    };
  }
  if (assetId === 'asset-3') {
    return {
      title: 'Neu',
      previewUrl: 'https://cdn.example.test/neu.jpg',
      fileName: 'neu.jpg',
    };
  }
  if (assetId === 'asset-uploaded') {
    return {
      title: 'Upload Rathaus',
      previewUrl: 'https://cdn.example.test/upload-rathaus.webp',
      fileName: 'upload-rathaus.webp',
    };
  }

  return {
    title: 'Rathaus außen',
    previewUrl: 'https://cdn.example.test/rathaus-aussen.jpg',
    fileName: 'rathaus-aussen.jpg',
  };
};

describe('PoiDetailPage', () => {
  const switchSection = (value: string) => {
    fireEvent.change(screen.getByLabelText('Bereich'), { target: { value } });
  };

  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(createPoi).mockReset();
    vi.mocked(deletePoi).mockReset();
    vi.mocked(getPoi).mockReset();
    vi.mocked(listPoiCategories).mockReset();
    vi.mocked(listPoiCategories).mockResolvedValue([] as never);
    vi.mocked(updatePoi).mockReset();
    vi.mocked(listHostMediaAssets).mockReset();
    vi.mocked(listHostMediaAssets).mockResolvedValue([] as never);
    vi.mocked(getHostMediaAsset).mockReset();
    vi.mocked(updateHostMediaAsset).mockReset();
    vi.mocked(uploadHostMediaFile).mockReset();
    vi.mocked(uploadHostMediaFile).mockResolvedValue({ assetId: 'uploaded-asset', uploadSessionId: 'upload-1' } as never);
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
        'poi.cards.media.entries.description': 'Quellen und Metadaten der übertragenen Medien pflegen.',
        'poi.cards.settings.media.title': 'Bilder',
        'poi.cards.settings.media.description': 'Bilder des Ortes verwalten',
        'poi.cards.advanced.payload.title': 'Zusatzdaten',
        'poi.cards.advanced.payload.description': 'Payload und Zusatzfelder',
        'poi.fields.name': 'Name',
        'poi.fields.categories': 'Kategorien',
        'poi.fields.categoriesHelp': 'Wählen Sie keine, eine oder mehrere Kategorien aus.',
        'poi.fields.categoriesSearch': 'Kategorien suchen',
        'poi.fields.categoriesSearchPlaceholder': 'Kategorie suchen oder auswählen',
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
        'poi.fields.externalId': 'Externe ID',
        'poi.fields.keywords': 'Schlagwörter',
        'poi.fields.payload': 'Payload',
        'poi.messages.validationError': 'Bitte Eingaben prüfen.',
        'poi.messages.categoryOptionsLoading': 'Kategorien werden geladen.',
        'poi.messages.categoryOptionsLoadError': 'Kategorien konnten nicht geladen werden.',
        'poi.validation.webUrls': 'URLs müssen mit https:// beginnen.',
        'poi.validation.geoLocation': 'Koordinaten müssen gültige Breiten- und Längengrade sein.',
        'poi.validation.categories': 'Kategorien benötigen einen Namen mit maximal 128 Zeichen.',
        'poi.history.empty.title': 'Noch keine Historie verfügbar.',
        'poi.messages.createSuccess': 'Ort erstellt.',
        'poi.messages.updateSuccess': 'Ort aktualisiert.',
        'poi.messages.deleteError': 'Ort konnte nicht gelöscht werden.',
        'poi.messages.locationGeocodeError': 'Geo-Koordinaten nicht verfügbar.',
        'poi.messages.locationGeocodeEmpty': 'Keine Geo-Koordinaten gefunden.',
        'poi.messages.locationMapUnavailable': 'Karte deaktiviert.',
        'poi.messages.locationMapError': 'Karte nicht verfügbar.',
        'poi.messages.mediaUploadInitializing': 'Upload wird vorbereitet.',
        'poi.messages.mediaUploadUploading': 'Medium wird hochgeladen.',
        'poi.messages.mediaUploadFinalizing': 'Upload wird abgeschlossen.',
        'poi.messages.mediaUploadSuccess': 'Medium wurde hochgeladen und zugeordnet.',
        'poi.messages.mediaUploadError': 'Das Medium konnte nicht hochgeladen werden.',
        'poi.messages.mediaUploadUnsupportedType': 'Nur JPG, PNG und WebP können hochgeladen werden.',
        'poi.messages.mediaUploadUnavailableUrl': 'Für dieses Medium ist keine öffentliche URL verfügbar.',
        'poi.messages.mediaPickerTitle': 'Medium hinzufügen',
        'poi.messages.mediaPickerUseMedia': 'Medium übernehmen',
        'poi.messages.mediaPickerAssetLoadError': 'Das Medium konnte nicht geladen werden.',
        'poi.actions.deleteConfirm': 'Wirklich löschen?',
        'poi.actions.geocodeAddress': 'Geo-Koordinaten ermitteln',
        'poi.actions.geocodingAddress': 'Geo-Koordinaten werden ermittelt',
        'poi.actions.addOpeningHour': 'Öffnungszeit hinzufügen',
        'poi.actions.addCategory': 'Kategorie hinzufügen',
        'poi.actions.addMediaManual': 'Manuell hinzufügen',
        'poi.actions.addImage': 'Aus Mediathek auswählen',
        'poi.actions.uploadMedia': 'Medium hochladen',
        'poi.actions.selectImage': 'Auswählen',
        'poi.actions.removeImage': 'Entfernen',
        'poi.actions.closeImagePicker': 'Schließen',
        'poi.actions.removeCategory': 'Kategorie {{name}} entfernen',
        'poi.fields.imageSearch': 'Dateiname filtern',
        'poi.fields.imageFileName': 'Dateiname',
        'poi.messages.imagePickerEmpty': 'Keine Bilder gefunden.',
        'poi.values.mediaContentTypes.unspecified': 'Nicht festgelegt',
        'poi.values.mediaContentTypes.image': 'Bild',
        'poi.values.mediaContentTypes.audio': 'Audio',
        'poi.values.mediaContentTypes.video': 'Video',
        'poi.values.mediaContentTypes.logo': 'Logo',
        'poi.values.mediaContentTypes.attachment': 'Anhang',
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
      expect(screen.getByText('Quellen und Metadaten der übertragenen Medien pflegen.')).toBeTruthy();
      expect(screen.getByLabelText('Preiskategorie')).toBeTruthy();
      expect(screen.getByLabelText('Preisbeschreibung')).toBeTruthy();
      expect(screen.queryByLabelText('Medienbeschriftung')).toBeNull();
    });
    const mediaSection = screen.getByText('Medieninhalte').closest('section');
    expect(mediaSection).toBeTruthy();
    const libraryAction = within(mediaSection as HTMLElement).getByText('Aus Mediathek auswählen');
    const uploadAction = within(mediaSection as HTMLElement).getByText('Medium hochladen');
    const manualAction = within(mediaSection as HTMLElement).getByText('Manuell hinzufügen');
    expect(libraryAction.compareDocumentPosition(uploadAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(uploadAction.compareDocumentPosition(manualAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('manages poi mediaContents in the content tab through the media library overlay', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
      mediaContents: [
        {
          captionText: 'Rathaus außen',
          contentType: 'image/jpeg',
          sourceUrl: { url: 'https://cdn.example.test/rathaus-aussen.jpg', description: 'rathaus-aussen.jpg' },
        },
      ],
    } as never);
    vi.mocked(listHostMediaAssets).mockResolvedValue([
      {
        id: 'asset-1',
        fileName: 'rathaus-aussen.jpg',
        mimeType: 'image/jpeg',
        previewUrl: 'https://cdn.example.test/rathaus-aussen.jpg',
        visibility: 'public',
        metadata: { title: 'Rathaus außen' },
      },
      {
        id: 'asset-2',
        fileName: 'stadtpark.jpg',
        mimeType: 'image/jpeg',
        previewUrl: 'https://cdn.example.test/stadtpark.jpg',
        visibility: 'public',
        metadata: { title: 'Stadtpark' },
      },
      {
        id: 'asset-protected',
        fileName: 'intern.jpg',
        mimeType: 'image/jpeg',
        previewUrl: 'https://signed.example.test/intern.jpg',
        visibility: 'protected',
        metadata: { title: 'Intern' },
      },
      {
        id: 'asset-without-url',
        fileName: 'ohne-url.jpg',
        mimeType: 'image/jpeg',
        previewUrl: null,
        visibility: 'public',
        metadata: { title: 'Ohne URL' },
      },
    ] as never);
    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('content');

    await waitFor(() => {
      expect(screen.getByText('Medieninhalte')).toBeTruthy();
      expect(screen.getByDisplayValue('https://cdn.example.test/rathaus-aussen.jpg')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aus Mediathek auswählen' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByLabelText('Dateiname filtern')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Dateiname filtern'), { target: { value: 'stadtpark' } });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Rathaus außen')).toBeNull();
    expect(within(dialog).getByText('Stadtpark')).toBeTruthy();
    expect(within(dialog).queryByText('Intern')).toBeNull();
    expect(within(dialog).queryByText('Ohne URL')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Auswählen' }));

    await waitFor(() => {
      expect(vi.mocked(getHostMediaAsset)).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        assetId: 'asset-2',
        instanceId: undefined,
      });
      expect(screen.getByRole('button', { name: 'Medium übernehmen' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Medium übernehmen' }));

    await waitFor(() => {
      expect(vi.mocked(updateHostMediaAsset)).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByDisplayValue('https://cdn.example.test/stadtpark.jpg')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aus Mediathek auswählen' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
    expect(within(screen.getByRole('dialog')).getByText('Stadtpark')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    const removeButtons = screen.getAllByRole('button', { name: 'Entfernen' });
    expect(removeButtons[0]).toBeTruthy();
    fireEvent.click(removeButtons[0] as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.queryByDisplayValue('https://cdn.example.test/rathaus-aussen.jpg')).toBeNull();
      expect(screen.getByDisplayValue('https://cdn.example.test/stadtpark.jpg')).toBeTruthy();
    });
  });

  it('renders a global save action and a history placeholder for poi', async () => {
    render(<PoiDetailPage mode="create" />);

    expect(await screen.findByRole('button', { name: 'Speichern' })).toBeTruthy();
    switchSection('history');
    expect(screen.getByText('Noch keine Historie verfügbar.')).toBeTruthy();
  });

  it('loads the poi editor from GraphQL content and keeps missing legacy media references optional', async () => {
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

    render(<PoiDetailPage mode="edit" contentId="poi-1" instanceId="de-musterhausen" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });
  });

  it('keeps edit loading stable when legacy host references are absent and graphQL mediaContents are empty', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" instanceId="de-musterhausen" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('content');
    await waitFor(() => {
      expect(screen.queryByDisplayValue('https://cdn.example.test/teaser.jpg')).toBeNull();
      expect(screen.queryByDisplayValue('https://cdn.example.test/anhang.jpg')).toBeNull();
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

  it('creates poi with news-style category multiselect selections', async () => {
    vi.mocked(listPoiCategories).mockResolvedValueOnce([
      { id: 'cat-1', name: 'Verwaltung' },
      { id: 'cat-2', name: 'Service' },
    ] as never);

    render(<PoiDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    const categoryInput = screen.getByLabelText('Kategorien suchen');
    fireEvent.change(categoryInput, { target: { value: 'Verwaltung' } });
    fireEvent.blur(categoryInput);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Neuer POI',
          categoryName: 'Verwaltung',
          categories: [{ name: 'Verwaltung' }],
        })
      );
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
    fireEvent.click(screen.getByRole('button', { name: 'Manuell hinzufügen' }));
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

  it('updates poi items and preserves loaded mediaContents on save', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      description: 'Zentraler Servicepunkt',
      active: true,
      categoryName: 'Verwaltung',
      addresses: [{ street: 'Marktplatz 1', city: 'Musterhausen' }],
      webUrls: [{ url: 'https://example.com/poi' }],
      mediaContents: [
        {
          captionText: 'Rathaus außen',
          contentType: 'image/jpeg',
          sourceUrl: { url: 'https://cdn.example.test/rathaus-aussen.jpg', description: 'rathaus-aussen.jpg' },
        },
      ],
      payload: { source: 'test' },
    } as never);
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
      expect(vi.mocked(updatePoi)).toHaveBeenCalledWith(
        'poi-1',
        expect.objectContaining({
          mediaContents: [
            expect.objectContaining({
              captionText: 'Rathaus außen',
              contentType: 'image',
              sourceUrl: {
                url: 'https://cdn.example.test/rathaus-aussen.jpg',
                description: 'rathaus-aussen.jpg',
              },
            }),
          ],
        })
      );
      expect(screen.getByText('Ort aktualisiert.')).toBeTruthy();
    });
  });

  it('preserves loaded externalId and keywords on save', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      externalId: 'poi-ext-7',
      keywords: 'service,amt',
      payload: {},
    } as never);
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
      expect(screen.getByDisplayValue('poi-ext-7')).toBeTruthy();
      expect(screen.getByDisplayValue('service,amt')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(updatePoi)).toHaveBeenCalledWith(
        'poi-1',
        expect.objectContaining({
          externalId: 'poi-ext-7',
          keywords: 'service,amt',
        })
      );
    });
  });

  it('passes the explicit instance context into media asset requests when available', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: '1517831',
      name: 'Rathaus',
      payload: {},
    } as never);

    render(<PoiDetailPage mode="edit" contentId="1517831" instanceId="de-musterhausen" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    expect(vi.mocked(listHostMediaAssets)).toHaveBeenCalledWith({
      fetch: expect.any(Function),
      instanceId: 'de-musterhausen',
      visibility: 'public',
    });
  });

  it('persists selected library images as poi mediaContents on save', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      payload: {},
    } as never);
    vi.mocked(listHostMediaAssets).mockResolvedValue([
      {
        id: 'asset-3',
        fileName: 'neu.jpg',
        mimeType: 'image/jpeg',
        previewUrl: 'https://cdn.example.test/neu.jpg',
        metadata: { title: 'Neu' },
      },
    ] as never);
    vi.mocked(updatePoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('content');
    fireEvent.click(screen.getByRole('button', { name: 'Aus Mediathek auswählen' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Auswählen' }));

    await waitFor(() => {
      expect(vi.mocked(getHostMediaAsset)).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        assetId: 'asset-3',
        instanceId: undefined,
      });
      expect(screen.getByRole('button', { name: 'Medium übernehmen' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Medium übernehmen' }));

    await waitFor(() => {
      expect(vi.mocked(updateHostMediaAsset)).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(updatePoi)).toHaveBeenCalledWith(
        'poi-1',
        expect.objectContaining({
          mediaContents: [
            expect.objectContaining({
              captionText: 'Neu',
              contentType: 'image',
              sourceUrl: { url: 'https://cdn.example.test/neu.jpg', description: 'neu.jpg' },
            }),
          ],
        })
      );
    });
  });

  it('saves an empty mediaContents list when all loaded poi images are removed', async () => {
    vi.mocked(getPoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
      mediaContents: [
        {
          captionText: 'Rathaus außen',
          sourceUrl: { url: 'https://cdn.example.test/rathaus.jpg', description: 'rathaus.jpg' },
        },
      ],
      payload: {},
    } as never);
    vi.mocked(updatePoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('content');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Entfernen' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(updatePoi)).toHaveBeenCalledWith('poi-1', expect.objectContaining({ mediaContents: [] }));
    });
  });

  it('creates poi items and navigates to the new detail page', async () => {
    vi.mocked(createPoi).mockResolvedValueOnce({
      id: 'poi-created',
      name: 'Neuer POI',
    } as never);

    render(<PoiDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/poi/$id', params: { id: 'poi-created' } });
    });
  });

  it('creates poi items with selected library images in mediaContents', async () => {
    vi.mocked(listHostMediaAssets).mockResolvedValue([
      {
        id: 'asset-rathaus',
        fileName: 'rathaus-aussen.jpg',
        mimeType: 'image/jpeg',
        previewUrl: 'https://cdn.example.test/rathaus-aussen.jpg',
        metadata: { title: 'Rathaus außen', copyright: 'Stadt Musterhausen' },
      },
    ] as never);
    vi.mocked(createPoi).mockResolvedValueOnce({
      id: 'poi-created',
      name: 'Neuer POI',
    } as never);

    render(<PoiDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    switchSection('content');
    fireEvent.click(screen.getByRole('button', { name: 'Aus Mediathek auswählen' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText('Rathaus außen')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Auswählen' }));

    await waitFor(() => {
      expect(vi.mocked(getHostMediaAsset)).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        assetId: 'asset-rathaus',
        instanceId: undefined,
      });
      expect(screen.getByRole('button', { name: 'Medium übernehmen' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Medium übernehmen' }));

    await waitFor(() => {
      expect(vi.mocked(updateHostMediaAsset)).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByDisplayValue('https://cdn.example.test/rathaus-aussen.jpg')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaContents: [
            expect.objectContaining({
              captionText: 'Rathaus außen',
              copyright: 'Stadt Musterhausen',
              contentType: 'image',
              sourceUrl: {
                url: 'https://cdn.example.test/rathaus-aussen.jpg',
                description: 'rathaus-aussen.jpg',
              },
            }),
          ],
        })
      );
    });
  });

  it('uploads media files and assigns the uploaded image to created poi items', async () => {
    const uploadedFile = new File(['image-bytes'], 'upload-rathaus.webp', { type: 'image/webp' });

    vi.mocked(uploadHostMediaFile).mockResolvedValueOnce({
      assetId: 'asset-uploaded',
      uploadSessionId: 'upload-session-1',
    } as never);
    vi.mocked(listHostMediaAssets)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        {
          id: 'asset-uploaded',
          fileName: 'upload-rathaus.webp',
          mimeType: 'image/webp',
          previewUrl: 'https://cdn.example.test/upload-rathaus.webp',
          metadata: { title: 'Upload Rathaus', copyright: 'Stadt Musterhausen' },
        },
      ] as never);
    vi.mocked(createPoi).mockResolvedValueOnce({
      id: 'poi-created',
      name: 'Neuer POI',
    } as never);

    render(<PoiDetailPage mode="create" instanceId="de-musterhausen" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    switchSection('content');
    fireEvent.click(screen.getByRole('button', { name: 'Medium hochladen' }));
    fireEvent.change(screen.getByTestId('media-upload-input'), { target: { files: [uploadedFile] } });

    await waitFor(() => {
      expect(vi.mocked(uploadHostMediaFile)).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        file: uploadedFile,
        mediaType: 'image',
        visibility: 'public',
        instanceId: 'de-musterhausen',
      });
      expect(screen.getByRole('button', { name: 'Medium übernehmen' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Medium übernehmen' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://cdn.example.test/upload-rathaus.webp')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaContents: [
            expect.objectContaining({
              captionText: 'Upload Rathaus',
              copyright: 'Stadt Musterhausen',
              contentType: 'image',
              sourceUrl: {
                url: 'https://cdn.example.test/upload-rathaus.webp',
                description: 'upload-rathaus.webp',
              },
            }),
          ],
        })
      );
    });
  });

  it('keeps poi mediaContents unchanged when media upload fails', async () => {
    const failedFile = new File(['image-bytes'], 'broken-rathaus.png', { type: 'image/png' });

    vi.mocked(uploadHostMediaFile).mockRejectedValueOnce(new Error('upload boom'));

    render(<PoiDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    switchSection('content');
    fireEvent.click(screen.getByRole('button', { name: 'Medium hochladen' }));
    fireEvent.change(screen.getByTestId('media-upload-input'), { target: { files: [failedFile] } });

    await waitFor(() => {
      expect(screen.getByText('Das Medium konnte nicht hochgeladen werden.')).toBeTruthy();
    });

    expect(screen.queryByDisplayValue('broken-rathaus.png')).toBeNull();
  });

  it('shows an upload error when the uploaded media asset is missing after refresh', async () => {
    const uploadedFile = new File(['image-bytes'], 'missing-rathaus.webp', { type: 'image/webp' });

    vi.mocked(uploadHostMediaFile).mockResolvedValueOnce({
      assetId: 'asset-missing',
      uploadSessionId: 'upload-session-1',
    } as never);
    vi.mocked(getHostMediaAsset).mockRejectedValueOnce(new Error('missing asset'));

    render(<PoiDetailPage mode="create" />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
    switchSection('content');
    fireEvent.click(screen.getByRole('button', { name: 'Medium hochladen' }));
    fireEvent.change(screen.getByTestId('media-upload-input'), { target: { files: [uploadedFile] } });

    await waitFor(() => {
      expect(screen.getByText('Das Medium konnte nicht geladen werden.')).toBeTruthy();
    });

    expect(screen.queryByDisplayValue('missing-rathaus.webp')).toBeNull();
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
