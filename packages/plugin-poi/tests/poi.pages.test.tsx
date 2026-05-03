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
  useSearch: () => searchMock(),
}));

const navigateMock = vi.fn();
const paramsMock = vi.fn(() => ({ id: 'poi-1' }));
const searchMock = vi.fn(() => ({ page: 1, pageSize: 25 }));

const interpolate = (template: string, variables?: Record<string, string | number>) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = variables?.[key];
    return value === undefined ? match : String(value);
  });

const registerPoiTranslations = () => {
  registerPluginTranslationResolver((key, variables) => {
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
      'poi.actions.update': 'Änderungen speichern',
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
      'poi.fields.weekday': 'Wochentag',
      'poi.fields.timeFrom': 'Öffnet',
      'poi.fields.payload': 'Payload JSON',
      'poi.fields.mediaPlaceholder': 'Medium auswählen',
      'poi.pagination.ariaLabel': 'POI-Pagination',
      'poi.pagination.previous': 'Zurück',
      'poi.pagination.next': 'Weiter',
      'poi.pagination.pageLabel': 'Seite {{page}}',
      'poi.editor.createTitle': 'POI anlegen',
      'poi.editor.createDescription': 'Erstellen Sie einen neuen Point of Interest.',
      'poi.editor.editTitle': 'POI bearbeiten',
      'poi.editor.editDescription': 'Aktualisieren oder löschen Sie den Point of Interest.',
      'poi.validation.name': 'Der Name ist erforderlich.',
      'poi.validation.webUrls': 'URLs müssen mit https:// beginnen.',
      'poi.validation.categoryName': 'Die Kategorie darf maximal 128 Zeichen haben.',
      'poi.validation.payload': 'Payload muss gültiges JSON sein.',
    };
    return interpolate(labels[key] ?? key, variables);
  });
};

describe('PoiListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    paramsMock.mockReset();
    searchMock.mockReset();
    paramsMock.mockReturnValue({ id: 'poi-1' });
    searchMock.mockReturnValue({ page: 1, pageSize: 25 });
    registerPoiTranslations();
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

  it('navigates through paginated list results', async () => {
    vi.mocked(listPoi).mockResolvedValueOnce({
      data: [
        {
          id: 'poi-1',
          name: 'Rathaus',
          categoryName: 'Verwaltung',
          active: true,
        },
      ],
      pagination: { page: 2, pageSize: 25, hasNextPage: true },
    });

    render(<PoiListPage />);

    await waitFor(() => {
      expect(screen.getByText('Seite 2')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(navigateMock).toHaveBeenCalledTimes(2);

    const previousTarget = navigateMock.mock.calls[0]?.[0] as {
      search: (current: Record<string, unknown>) => Record<string, unknown>;
    };
    const nextTarget = navigateMock.mock.calls[1]?.[0] as {
      search: (current: Record<string, unknown>) => Record<string, unknown>;
    };

    expect(previousTarget.search({ filter: 'open' })).toEqual({
      filter: 'open',
      page: 1,
      pageSize: 25,
    });
    expect(nextTarget.search({ filter: 'open' })).toEqual({
      filter: 'open',
      page: 3,
      pageSize: 25,
    });
  });

  it('reads pagination values from search params and falls back for invalid values', async () => {
    searchMock.mockReturnValueOnce({ page: 3, pageSize: 50 });

    render(<PoiListPage />);

    await waitFor(() => {
      expect(listPoi).toHaveBeenCalledWith({ page: 3, pageSize: 50 });
    });

    cleanup();
    searchMock.mockReturnValueOnce({ page: undefined, pageSize: 0 });
    vi.mocked(listPoi).mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    render(<PoiListPage />);

    await waitFor(() => {
      expect(listPoi).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    });
  });

  it('creates host media references alongside the legacy poi payload without leaking storage artifacts', async () => {
    render(<PoiCreatePage />);

    await waitFor(() => {
      expect(listHostMediaAssets).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rathaus' } });
    fireEvent.change(screen.getByLabelText('Beschreibung'), { target: { value: 'Bürgerservice vor Ort' } });
    fireEvent.change(screen.getByLabelText('Teaserbild'), { target: { value: 'asset-teaser' } });
    fireEvent.change(screen.getByLabelText('Web-URL'), { target: { value: 'https://example.com/poi' } });
    fireEvent.click(screen.getByRole('button', { name: 'POI anlegen' }));

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
      expect((screen.getByLabelText('Teaserbild') as HTMLSelectElement).value).toBe('asset-teaser');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Medium entfernen' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Aktualisierte Stadtbibliothek' } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

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
});
