import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  registerPluginTranslationResolver,
  replaceHostMediaReferences,
} from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPoi, getPoi, listPoi, updatePoi } from '../src/poi.api.js';
import { PoiCreatePage, PoiEditPage, PoiListPage } from '../src/poi.pages.js';

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
    payload: { source: 'legacy' },
  })),
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
    listHostMediaReferencesByTarget: vi.fn(async () => []),
    replaceHostMediaReferences: vi.fn(async (input: unknown) => input),
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigateMock,
  useParams: () => paramsMock(),
  useSearch: () => ({ page: 1, pageSize: 25 }),
}));

const navigateMock = vi.fn();
const paramsMock = vi.fn(() => ({ id: 'poi-1' }));

describe('PoiListPage', () => {
  const switchSection = (value: string) => {
    fireEvent.change(screen.getByLabelText('Bereich'), { target: { value } });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    paramsMock.mockReset();
    paramsMock.mockReturnValue({ id: 'poi-1' });
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'poi.list.title': 'POI',
        'poi.list.description': 'Points of Interest aus dem Mainserver bearbeiten.',
        'poi.messages.loading': 'POI werden geladen.',
        'poi.messages.loadError': 'POI konnten nicht geladen werden.',
        'poi.messages.missingContent': 'Der POI konnte nicht geladen werden.',
        'poi.messages.saveError': 'POI konnte nicht gespeichert werden.',
        'poi.messages.createSuccess': 'POI wurde erstellt.',
        'poi.messages.updateSuccess': 'POI wurde aktualisiert.',
        'poi.messages.validationError': 'Bitte korrigieren Sie die markierten Felder.',
        'poi.empty.title': 'Noch keine POI vorhanden',
        'poi.actions.create': 'POI anlegen',
        'poi.actions.save': 'Speichern',
        'poi.actions.update': 'Änderungen speichern',
        'poi.actions.back': 'Zurück zur Liste',
        'poi.actions.delete': 'Löschen',
        'poi.actions.clearMedia': 'Medium entfernen',
        'poi.fields.actions': 'Aktionen',
        'poi.fields.name': 'Name',
        'poi.fields.description': 'Beschreibung',
        'poi.fields.mobileDescription': 'Mobile Beschreibung',
        'poi.fields.teaserImage': 'Teaserbild',
        'poi.fields.active': 'Aktiv',
        'poi.fields.categoryName': 'Kategorie',
        'poi.fields.street': 'Straße',
        'poi.fields.city': 'Ort',
        'poi.fields.email': 'E-Mail',
        'poi.fields.url': 'Web-URL',
        'poi.fields.urlDescription': 'Link-Beschreibung',
        'poi.fields.weekday': 'Wochentag',
        'poi.fields.timeFrom': 'Öffnet',
        'poi.fields.open': 'Geöffnet',
        'poi.fields.payload': 'Payload JSON',
        'poi.fields.mediaPlaceholder': 'Medium auswählen',
        'poi.fields.createdAt': 'Erstellt',
        'poi.fields.updatedAt': 'Aktualisiert',
        'poi.pagination.ariaLabel': 'POI-Pagination',
        'poi.pagination.previous': 'Zurück',
        'poi.pagination.next': 'Weiter',
        'poi.pagination.pageLabel': 'Seite {{page}}',
        'poi.values.notAvailable': 'Nicht verfügbar',
        'poi.values.active': 'Ja',
        'poi.detail.createTitle': 'POI anlegen',
        'poi.detail.createDescription': 'Erstellen Sie einen neuen Point of Interest.',
        'poi.detail.editTitle': 'POI bearbeiten',
        'poi.detail.editDescription': 'Aktualisieren oder löschen Sie den Point of Interest.',
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
        'poi.cards.basis.identity.title': 'Basisdaten',
        'poi.cards.basis.identity.description': 'Name, Kategorie und Aktivstatus.',
        'poi.cards.basis.meta.title': 'Metadaten',
        'poi.cards.basis.meta.description': 'Zeitliche Einordnung des Eintrags.',
        'poi.cards.location.address.title': 'Lage und Adresse',
        'poi.cards.location.address.description': 'Adressdaten des POI.',
        'poi.cards.location.coordinates.title': 'Koordinaten',
        'poi.cards.location.coordinates.description': 'Geo-Daten des POI.',
        'poi.cards.description.text.title': 'Beschreibungen',
        'poi.cards.description.text.description': 'Redaktionelle Beschreibungen des POI.',
        'poi.cards.contact.primary.title': 'Kontakt',
        'poi.cards.contact.primary.description': 'Kontaktinformationen für den POI.',
        'poi.cards.openingHours.entries.title': 'Öffnungszeiten',
        'poi.cards.openingHours.entries.description': 'Aktuelle Öffnungsinformationen.',
        'poi.cards.links.entries.title': 'Weblinks',
        'poi.cards.links.entries.description': 'Externe Verweise zum POI.',
        'poi.cards.operator.details.title': 'Betreiber',
        'poi.cards.operator.details.description': 'Betreiberdaten und Kontakte.',
        'poi.cards.prices.entries.title': 'Preise',
        'poi.cards.prices.entries.description': 'Preisangaben des POI.',
        'poi.cards.media.references.title': 'Medien',
        'poi.cards.media.references.description': 'Teaserbild und weitere Dateireferenzen.',
        'poi.cards.advanced.payload.title': 'Zusatzdaten',
        'poi.cards.advanced.payload.description': 'Zusätzliche Mainserver-Daten als JSON.',
        'poi.history.empty.title': 'Noch keine Historie verfügbar.',
        'poi.history.empty.description': 'Historienereignisse für POI werden in einem späteren Schritt angebunden.',
        'poi.editor.createTitle': 'POI anlegen',
        'poi.editor.createDescription': 'Erstellen Sie einen neuen Point of Interest.',
        'poi.editor.editTitle': 'POI bearbeiten',
        'poi.editor.editDescription': 'Aktualisieren oder löschen Sie den Point of Interest.',
        'poi.validation.name': 'Der Name ist erforderlich.',
        'poi.validation.webUrls': 'URLs müssen mit https:// beginnen.',
        'poi.validation.categoryName': 'Die Kategorie darf maximal 128 Zeichen haben.',
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
        'poi.actions.remove': 'Entfernen',
      };
      return labels[key] ?? key;
    });
    vi.mocked(listHostMediaAssets).mockResolvedValue([{ id: 'asset-teaser', metadata: { title: 'Teaser Asset' } }]);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValue([]);
    vi.mocked(replaceHostMediaReferences).mockResolvedValue({
      targetType: 'poi',
      targetId: 'poi-1',
      references: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the empty state when no poi exist', async () => {
    render(<PoiListPage />);

    await waitFor(() => {
      expect(screen.getByText('Noch keine POI vorhanden')).toBeTruthy();
    });
  });

  it('renders a load error when listing poi fails', async () => {
    vi.mocked(listPoi).mockRejectedValueOnce(new Error('boom'));

    render(<PoiListPage />);

    await waitFor(() => {
      expect(screen.getByText('POI konnten nicht geladen werden.')).toBeTruthy();
    });
  });

  it('creates host media references alongside the legacy poi payload without leaking storage artifacts', async () => {
    render(<PoiCreatePage />);

    await waitFor(() => {
      expect(listHostMediaAssets).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rathaus' } });
    switchSection('description');
    await waitFor(() => {
      expect(screen.getByLabelText('Beschreibung', { selector: 'textarea' })).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Beschreibung', { selector: 'textarea' }), {
      target: { value: 'Bürgerservice vor Ort' },
    });
    switchSection('links');
    fireEvent.change(screen.getByLabelText('Web-URL'), { target: { value: 'https://example.com/poi' } });
    switchSection('media');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Teaserbild' })).toBeTruthy();
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Teaserbild' }), { target: { value: 'asset-teaser' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(createPoi).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Rathaus',
          description: 'Bürgerservice vor Ort',
          webUrls: [{ url: 'https://example.com/poi' }],
        })
      );
      expect(replaceHostMediaReferences).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        targetType: 'poi',
        targetId: 'poi-created',
        references: [{ assetId: 'asset-teaser', role: 'teaser_image', sortOrder: 0 }],
      });
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/poi/$id', params: { id: 'poi-created' } });
    });
  });

  it('loads existing host media references on edit and keeps the update flow stable', async () => {
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValue([
      {
        id: 'ref-poi-1',
        assetId: 'asset-teaser',
        targetType: 'poi',
        targetId: 'poi-1',
        role: 'teaser_image',
        sortOrder: 0,
      },
    ]);

    render(<PoiEditPage />);

    await waitFor(() => {
      expect(getPoi).toHaveBeenCalledWith('poi-1');
      expect(screen.getByDisplayValue('Stadtbibliothek')).toBeTruthy();
    });

    switchSection('media');
    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: 'Teaserbild' }) as HTMLSelectElement).value).toBe('asset-teaser');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Medium entfernen' }));
    switchSection('basis');
    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Aktualisierte Stadtbibliothek' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(updatePoi).toHaveBeenCalledWith(
        'poi-1',
        expect.objectContaining({
          name: 'Aktualisierte Stadtbibliothek',
          description: 'Öffentliche Bibliothek',
          webUrls: [{ url: 'https://example.com/poi' }],
          payload: { source: 'legacy' },
        })
      );
      expect(screen.getByText('POI wurde aktualisiert.')).toBeTruthy();
    });
  });

  it('clears a previous success status before a validation-blocked submit', async () => {
    render(<PoiEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtbibliothek')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(screen.getByText('POI wurde aktualisiert.')).toBeTruthy();
    });

    switchSection('links');
    await waitFor(() => {
      expect(screen.getByLabelText('Web-URL')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Web-URL'), { target: { value: 'http://invalid.example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(screen.queryByText('POI wurde aktualisiert.')).toBeNull();
      expect(updatePoi).toHaveBeenCalledTimes(1);
    });
  });
});
