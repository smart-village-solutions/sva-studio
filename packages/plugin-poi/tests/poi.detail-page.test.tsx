import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    suggestHostMapAddresses: vi.fn(async () => []),
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
        'poi.detail.createTitle': 'POI anlegen',
        'poi.detail.editTitle': 'POI bearbeiten',
        'poi.actions.save': 'Speichern',
        'poi.actions.delete': 'Löschen',
        'poi.detailTabs.basis.title': 'Basis',
        'poi.detailTabs.location.title': 'Ort',
        'poi.detailTabs.description.title': 'Beschreibung',
        'poi.detailTabs.contact.title': 'Kontakt',
        'poi.detailTabs.openingHours.title': 'Öffnungszeiten',
        'poi.detailTabs.links.title': 'Links',
        'poi.detailTabs.operator.title': 'Betreiber',
        'poi.detailTabs.prices.title': 'Preise',
        'poi.detailTabs.media.title': 'Medien & Dateien',
        'poi.detailTabs.advanced.title': 'Erweiterte Daten',
        'poi.detailTabs.history.title': 'Historie',
        'poi.tabs.mobileLabel': 'Bereich',
        'poi.tabs.ariaLabel': 'Bereiche',
        'poi.cards.location.address.title': 'Lage und Adresse',
        'poi.cards.location.address.description': 'Adressdaten',
        'poi.cards.location.coordinates.title': 'Koordinaten',
        'poi.cards.location.coordinates.description': 'Geo-Daten',
        'poi.cards.location.map.title': 'Karte',
        'poi.cards.location.map.description': 'Marker setzen',
        'poi.cards.location.search.title': 'Adresssuche',
        'poi.cards.location.search.description': 'Adresse suchen und übernehmen',
        'poi.cards.description.text.title': 'Beschreibungen',
        'poi.cards.description.text.description': 'Texte',
        'poi.cards.contact.primary.title': 'Kontakt',
        'poi.cards.contact.primary.description': 'Kontaktfelder',
        'poi.cards.openingHours.entries.title': 'Öffnungszeiten',
        'poi.cards.openingHours.entries.description': 'Zeitfenster',
        'poi.cards.links.entries.title': 'Weblinks',
        'poi.cards.links.entries.description': 'Weblinks',
        'poi.cards.operator.details.title': 'Betreiber',
        'poi.cards.operator.details.description': 'Betriebsdaten',
        'poi.cards.prices.entries.title': 'Preise',
        'poi.cards.prices.entries.description': 'Preisangaben',
        'poi.cards.media.references.title': 'Medien',
        'poi.cards.media.references.description': 'Teaserbild und Dateien',
        'poi.cards.advanced.payload.title': 'Zusatzdaten',
        'poi.cards.advanced.payload.description': 'Payload und Zusatzfelder',
        'poi.fields.name': 'Name',
        'poi.fields.street': 'Straße',
        'poi.fields.city': 'Ort',
        'poi.fields.zip': 'PLZ',
        'poi.fields.addressSearch': 'Adresse suchen',
        'poi.fields.searchResults': 'Suchergebnisse',
        'poi.fields.latitude': 'Breitengrad',
        'poi.fields.longitude': 'Längengrad',
        'poi.fields.description': 'Beschreibung',
        'poi.fields.mobileDescription': 'Mobile Beschreibung',
        'poi.fields.url': 'URL',
        'poi.fields.email': 'E-Mail',
        'poi.fields.weekday': 'Wochentag',
        'poi.fields.payload': 'Payload',
        'poi.messages.validationError': 'Bitte Eingaben prüfen.',
        'poi.history.empty.title': 'Noch keine Historie verfügbar.',
        'poi.messages.createSuccess': 'POI erstellt.',
        'poi.messages.updateSuccess': 'POI aktualisiert.',
        'poi.messages.deleteError': 'POI konnte nicht gelöscht werden.',
        'poi.messages.locationSearchError': 'Adresssuche nicht verfügbar.',
        'poi.messages.locationSearchEmpty': 'Keine Treffer gefunden.',
        'poi.messages.locationMapUnavailable': 'Karte deaktiviert.',
        'poi.messages.locationMapError': 'Karte nicht verfügbar.',
        'poi.actions.deleteConfirm': 'Wirklich löschen?',
        'poi.actions.searchAddress': 'Adresse suchen',
        'poi.actions.applySearchResult': 'Übernehmen',
        'poi.actions.reverseGeocode': 'Adresse aus Koordinaten übernehmen',
        'poi.actions.reverseGeocoding': 'Adresse wird ermittelt',
        'poi.actions.uploadMedia': 'Medium hochladen',
        'poi.actions.uploadingMedia': 'Medium wird hochgeladen',
        'poi.fields.attachmentAsset': 'Weiteres Medium',
        'poi.messages.mediaUploadError': 'Upload fehlgeschlagen.',
        'poi.messages.mediaUploadSuccess': 'Upload erfolgreich.',
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

    expect(screen.getByRole('tab', { name: 'Ort' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Beschreibung' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Kontakt' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Öffnungszeiten' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Links' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Betreiber' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Preise' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Medien & Dateien' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Erweiterte Daten' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Historie' })).toBeTruthy();
  });

  it('shows the new task-oriented editor sections', async () => {
    render(<PoiDetailPage mode="create" />);

    await screen.findByRole('tab', { name: 'Ort' });
    switchSection('location');

    await waitFor(() => {
      expect(screen.getByLabelText('Straße')).toBeTruthy();
      expect(screen.getByLabelText('Breitengrad')).toBeTruthy();
    });

    switchSection('description');
    await waitFor(() => {
      expect(screen.getByLabelText('Mobile Beschreibung')).toBeTruthy();
    });

    switchSection('contact');
    await waitFor(() => {
      expect(screen.getByLabelText('E-Mail')).toBeTruthy();
    });

    switchSection('openingHours');
    await waitFor(() => {
      expect(screen.getByLabelText('Wochentag')).toBeTruthy();
    });

    switchSection('links');
    await waitFor(() => {
      expect(screen.getByLabelText('URL')).toBeTruthy();
    });

    switchSection('advanced');
    await waitFor(() => {
      expect(screen.getByLabelText('Payload')).toBeTruthy();
    });
  });

  it('renders a global save action and a history placeholder for poi', async () => {
    render(<PoiDetailPage mode="create" />);

    expect(await screen.findByRole('button', { name: 'Speichern' })).toBeTruthy();
    switchSection('history');
    expect(screen.getByText('Noch keine Historie verfügbar.')).toBeTruthy();
  });

  it('renders the poi editor after the core item loaded even when media references are still pending', async () => {
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
    vi.mocked(listHostMediaReferencesByTarget).mockImplementationOnce(
      () => new Promise(() => undefined)
    );

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });
  });

  it('blocks submission on invalid payload json and invalid https links', async () => {
    render(<PoiDetailPage mode="create" />);

    await screen.findByRole('tab', { name: 'Links' });
    switchSection('links');
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'http://example.com/poi' } });
    switchSection('advanced');
    fireEvent.change(screen.getByLabelText('Payload'), { target: { value: '{' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).not.toHaveBeenCalled();
    });

    expect(screen.getByLabelText('Payload')).toBeTruthy();
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
    switchSection('links');
    fireEvent.change(await screen.findByLabelText('URL'), { target: { value: 'http://invalid.example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).not.toHaveBeenCalled();
      expect(screen.getByLabelText('URL')).toBeTruthy();
    });
  });

  it('updates poi items and preserves the loaded teaser image reference on save', async () => {
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
        role: 'teaser_image',
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

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(updatePoi)).toHaveBeenCalledTimes(1);
      expect(replaceHostMediaReferencesMock).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        targetType: 'poi',
        targetId: 'poi-1',
        references: [
          {
            assetId: 'asset-1',
            role: 'teaser_image',
            sortOrder: 0,
          },
        ],
      });
      expect(screen.getByText('POI aktualisiert.')).toBeTruthy();
    });
  });

  it('persists teaser and attachment references together on save', async () => {
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
      { id: 'reference-1', assetId: 'asset-1', role: 'teaser_image' },
      { id: 'reference-2', assetId: 'asset-2', role: 'attachment_image', sortOrder: 1 },
    ] as never);
    vi.mocked(updatePoi).mockResolvedValueOnce({
      id: 'poi-1',
      name: 'Rathaus',
    } as never);

    render(<PoiDetailPage mode="edit" contentId="poi-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rathaus')).toBeTruthy();
    });

    switchSection('media');
    await waitFor(() => {
      expect(screen.getByLabelText('Weiteres Medium')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Weiteres Medium'), { target: { value: 'asset-3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(replaceHostMediaReferencesMock).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        targetType: 'poi',
        targetId: 'poi-1',
        references: [
          { assetId: 'asset-1', role: 'teaser_image', sortOrder: 0 },
          { assetId: 'asset-3', role: 'attachment_image', sortOrder: 0 },
        ],
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
      expect(screen.getByText('POI konnte nicht gelöscht werden.')).toBeTruthy();
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
