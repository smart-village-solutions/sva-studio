import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  registerPluginTranslationResolver,
  replaceHostMediaReferences,
} from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEvent, getEvent, listEvents, updateEvent } from '../src/events.api.js';
import { EventsCreatePage, EventsEditPage, EventsListPage } from '../src/events.pages.js';

vi.mock('../src/events.api.js', () => ({
  listEvents: vi.fn(async () => ({
    data: [],
    pagination: { page: 1, pageSize: 25, hasNextPage: false },
  })),
  listPoiForEventSelection: vi.fn(async () => []),
  getEvent: vi.fn(async () => ({
    id: 'event-1',
    title: 'Bestehendes Event',
    description: 'Beschreibung',
    categoryName: 'Kultur',
    dates: [{ dateStart: '2026-04-14T09:30:00.000Z' }],
    addresses: [{ street: 'Markt 1', city: 'Musterhausen' }],
    urls: [{ url: 'https://example.com/events' }],
  })),
  createEvent: vi.fn(async () => ({ id: 'event-created' })),
  updateEvent: vi.fn(async () => ({ id: 'event-1' })),
  deleteEvent: vi.fn(),
  EventsApiError: class EventsApiError extends Error {},
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
const paramsMock = vi.fn(() => ({ id: 'event-1' }));
const searchMock = vi.fn(() => ({ page: 1, pageSize: 25 }));

describe('EventsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    paramsMock.mockReset();
    searchMock.mockReset();
    paramsMock.mockReturnValue({ id: 'event-1' });
    searchMock.mockReturnValue({ page: 1, pageSize: 25 });
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'events.list.title': 'Events',
        'events.list.description': 'Veranstaltungen aus dem Mainserver bearbeiten.',
        'events.messages.loading': 'Events werden geladen.',
        'events.messages.loadError': 'Events konnten nicht geladen werden.',
        'events.messages.missingContent': 'Das Event konnte nicht geladen werden.',
        'events.messages.saveError': 'Event konnte nicht gespeichert werden.',
        'events.messages.createSuccess': 'Event wurde erstellt.',
        'events.messages.updateSuccess': 'Event wurde aktualisiert.',
        'events.messages.validationError': 'Bitte korrigieren Sie die markierten Felder.',
        'events.empty.title': 'Noch keine Events vorhanden',
        'events.actions.create': 'Event anlegen',
        'events.actions.update': 'Änderungen speichern',
        'events.actions.clearMedia': 'Medium entfernen',
        'events.fields.actions': 'Aktionen',
        'events.fields.title': 'Titel',
        'events.fields.description': 'Beschreibung',
        'events.fields.headerImage': 'Headerbild',
        'events.fields.categoryName': 'Kategorie',
        'events.fields.dateStart': 'Startdatum',
        'events.fields.dateEnd': 'Enddatum',
        'events.fields.street': 'Straße',
        'events.fields.city': 'Ort',
        'events.fields.email': 'E-Mail',
        'events.fields.url': 'Web-URL',
        'events.fields.mediaPlaceholder': 'Medium auswählen',
        'events.fields.pointOfInterestId': 'Zugehöriger POI',
        'events.fields.repeat': 'Wiederholung',
        'events.pagination.ariaLabel': 'Events-Pagination',
        'events.pagination.previous': 'Zurück',
        'events.pagination.next': 'Weiter',
        'events.pagination.pageLabel': 'Seite {{page}}',
        'events.editor.createTitle': 'Event anlegen',
        'events.editor.createDescription': 'Erstellen Sie einen neuen Veranstaltungseintrag.',
        'events.editor.editTitle': 'Event bearbeiten',
        'events.editor.editDescription': 'Aktualisieren oder löschen Sie den Veranstaltungseintrag.',
        'events.validation.title': 'Der Titel ist erforderlich.',
        'events.validation.dates': 'Datumswerte müssen gültig sein.',
        'events.validation.urls': 'URLs müssen mit https:// beginnen.',
        'events.validation.categoryName': 'Die Kategorie darf maximal 128 Zeichen haben.',
      };
      return labels[key] ?? key;
    });
    vi.mocked(listHostMediaAssets).mockResolvedValue([{ id: 'asset-header', metadata: { title: 'Header Asset' } }]);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValue([]);
    vi.mocked(replaceHostMediaReferences).mockResolvedValue({
      targetType: 'events',
      targetId: 'event-1',
      references: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the empty state when no events exist', async () => {
    render(<EventsListPage />);

    await waitFor(() => {
      expect(screen.getByText('Noch keine Events vorhanden')).toBeTruthy();
    });
  });

  it('renders a load error when listing events fails', async () => {
    vi.mocked(listEvents).mockRejectedValueOnce(new Error('boom'));

    render(<EventsListPage />);

    await waitFor(() => {
      expect(screen.getByText('Events konnten nicht geladen werden.')).toBeTruthy();
    });
  });

  it('navigates through paginated list results', async () => {
    vi.mocked(listEvents).mockResolvedValueOnce({
      data: [
        {
          id: 'event-1',
          title: 'Stadtfest',
          categoryName: 'Kultur',
          dates: [{ dateStart: '2026-04-14T09:30:00.000Z' }],
        },
      ],
      pagination: { page: 2, pageSize: 25, hasNextPage: true },
    });

    render(<EventsListPage />);

    await waitFor(() => {
      expect(screen.getByText('Seite {{page}}')).toBeTruthy();
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

    render(<EventsListPage />);

    await waitFor(() => {
      expect(listEvents).toHaveBeenCalledWith({ page: 3, pageSize: 50 });
    });

    cleanup();
    searchMock.mockReturnValueOnce({ page: undefined, pageSize: 0 });
    vi.mocked(listEvents).mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    render(<EventsListPage />);

    await waitFor(() => {
      expect(listEvents).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    });
  });

  it('creates host media references alongside the legacy event payload without leaking storage artifacts', async () => {
    render(<EventsCreatePage />);

    await waitFor(() => {
      expect(listHostMediaAssets).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Konzertabend' } });
    fireEvent.change(screen.getByLabelText('Beschreibung'), { target: { value: 'Live im Stadtpark' } });
    fireEvent.change(screen.getByLabelText('Headerbild'), { target: { value: 'asset-header' } });
    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: '2026-04-14T09:30' } });
    fireEvent.change(screen.getByLabelText('Web-URL'), { target: { value: 'https://example.com/events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Event anlegen' }));

    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Konzertabend',
          description: 'Live im Stadtpark',
          urls: [{ url: 'https://example.com/events' }],
        })
      );
      expect(replaceHostMediaReferences).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        targetType: 'events',
        targetId: 'event-created',
        references: [{ assetId: 'asset-header', role: 'header_image', sortOrder: 0 }],
      });
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/events/$id', params: { id: 'event-created' } });
    });
  });

  it('loads existing host media references on edit and keeps the update flow stable', async () => {
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValue([
      {
        id: 'ref-event-1',
        assetId: 'asset-header',
        targetType: 'events',
        targetId: 'event-1',
        role: 'header_image',
        sortOrder: 0,
      },
    ]);

    render(<EventsEditPage />);

    await waitFor(() => {
      expect(getEvent).toHaveBeenCalledWith('event-1');
      expect(screen.getByDisplayValue('Bestehendes Event')).toBeTruthy();
      expect((screen.getByLabelText('Headerbild') as HTMLSelectElement).value).toBe('asset-header');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Medium entfernen' }));
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Aktualisiertes Event' } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith(
        'event-1',
        expect.objectContaining({
          title: 'Aktualisiertes Event',
          description: 'Beschreibung',
          urls: [{ url: 'https://example.com/events' }],
        })
      );
      expect(screen.getByText('Event wurde aktualisiert.')).toBeTruthy();
    });
  });
});
