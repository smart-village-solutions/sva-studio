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

vi.mock('@sva/studio-ui-react', async () => {
  const actual = await vi.importActual<typeof import('@sva/studio-ui-react')>('@sva/studio-ui-react');
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

vi.mock('../src/events.api.js', () => ({
  listEvents: vi.fn(async () => ({
    data: [],
    pagination: { page: 1, pageSize: 25, hasNextPage: false },
  })),
  listEventCategories: vi.fn(async () => [{ id: 'cat-1', name: 'Kultur' }, { id: 'cat-2', name: 'Open Air' }]),
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
  useSearch: () => ({ page: 1, pageSize: 25 }),
}));

const navigateMock = vi.fn();
const paramsMock = vi.fn(() => ({ id: 'event-1' }));

describe('EventsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    paramsMock.mockReset();
    paramsMock.mockReturnValue({ id: 'event-1' });
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
        'events.actions.save': 'Speichern',
        'events.actions.update': 'Änderungen speichern',
        'events.actions.clearMedia': 'Medium entfernen',
        'events.actions.back': 'Zurück zur Liste',
        'events.actions.delete': 'Löschen',
        'events.fields.actions': 'Aktionen',
        'events.fields.title': 'Titel',
        'events.fields.description': 'Beschreibung',
        'events.fields.headerImage': 'Headerbild',
        'events.fields.categories': 'Kategorien',
        'events.fields.categoriesHelp': 'Mehrfachauswahl',
        'events.fields.categoriesSearch': 'Kategorien suchen',
        'events.fields.categoriesSearchPlaceholder': 'Kategorie suchen oder auswählen',
        'events.fields.dateStart': 'Startdatum',
        'events.fields.dateEnd': 'Enddatum',
        'events.fields.street': 'Straße',
        'events.fields.city': 'Ort',
        'events.fields.email': 'E-Mail',
        'events.fields.url': 'Web-URL',
        'events.fields.urlDescription': 'Link-Beschreibung',
        'events.fields.mediaPlaceholder': 'Medium auswählen',
        'events.fields.pointOfInterestId': 'Zugehöriger POI',
        'events.fields.repeat': 'Wiederholung',
        'events.fields.phone': 'Telefon',
        'events.fields.timeStart': 'Startzeit',
        'events.fields.timeEnd': 'Endzeit',
        'events.fields.createdAt': 'Erstellt',
        'events.fields.updatedAt': 'Aktualisiert',
        'events.messages.categoryOptionsLoading': 'Kategorien werden geladen.',
        'events.messages.categoryOptionsLoadError': 'Kategorien konnten nicht geladen werden.',
        'events.pagination.ariaLabel': 'Events-Pagination',
        'events.pagination.previous': 'Zurück',
        'events.pagination.next': 'Weiter',
        'events.pagination.pageLabel': 'Seite {{page}}',
        'events.detail.createTitle': 'Event anlegen',
        'events.detail.createDescription': 'Erstellen Sie einen neuen Veranstaltungseintrag.',
        'events.detail.editTitle': 'Event bearbeiten',
        'events.detail.editDescription': 'Aktualisieren oder löschen Sie den Veranstaltungseintrag.',
        'events.detailTabs.basis.title': 'Basis',
        'events.detailTabs.content.title': 'Inhalt',
        'events.detailTabs.settings.title': 'Einstellungen',
        'events.detailTabs.history.title': 'Historie',
        'events.cards.basis.identity.title': 'Basisdaten',
        'events.cards.basis.identity.description': 'Titel und Kategorie des Events.',
        'events.cards.basis.meta.title': 'Metadaten',
        'events.cards.basis.meta.description': 'Zeitliche Einordnung des Eintrags.',
        'events.cards.content.descriptions.title': 'Beschreibung',
        'events.cards.content.descriptions.description': 'Redaktioneller Kerntext des Events.',
        'events.cards.content.dates.title': 'Termine',
        'events.cards.content.dates.description': 'Start- und Endzeit des Events.',
        'events.cards.content.addresses.title': 'Orte und Adressen',
        'events.cards.content.addresses.description': 'Adresse des Veranstaltungsorts.',
        'events.cards.content.contact.title': 'Kontakt',
        'events.cards.content.contact.description': 'Kontaktmöglichkeiten für Rückfragen.',
        'events.cards.content.links.title': 'Links',
        'events.cards.content.links.description': 'Externe Verweise zum Event.',
        'events.cards.content.recurrence.title': 'Wiederholung',
        'events.cards.content.recurrence.description': 'Wiederkehrende Durchführung des Events.',
        'events.cards.content.poi.title': 'POI-Verknüpfung',
        'events.cards.content.poi.description': 'Zuordnung zu einem bestehenden POI.',
        'events.cards.settings.media.title': 'Medien',
        'events.cards.settings.media.description': 'Headerbild für die Detailseite.',
        'events.history.empty.title': 'Noch keine Historie verfügbar.',
        'events.history.empty.description': 'Historienereignisse für Events werden in einem späteren Schritt angebunden.',
        'events.actions.addCategory': 'Kategorie hinzufügen',
        'events.actions.removeCategory': 'Kategorie {{name}} entfernen',
        'events.editor.createTitle': 'Event anlegen',
        'events.editor.createDescription': 'Erstellen Sie einen neuen Veranstaltungseintrag.',
        'events.editor.editTitle': 'Event bearbeiten',
        'events.editor.editDescription': 'Aktualisieren oder löschen Sie den Veranstaltungseintrag.',
        'events.validation.title': 'Der Titel ist erforderlich.',
        'events.validation.dates': 'Datumswerte müssen gültig sein.',
        'events.validation.urls': 'URLs müssen mit https:// beginnen.',
        'events.validation.categories': 'Kategorien benötigen einen Namen mit maximal 128 Zeichen.',
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

  it('creates host media references alongside the legacy event payload without leaking storage artifacts', async () => {
    render(<EventsCreatePage />);

    await waitFor(() => {
      expect(listHostMediaAssets).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Konzertabend' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Inhalt' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Beschreibung')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Beschreibung'), { target: { value: 'Live im Stadtpark' } });
    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: '2026-04-14' } });
    fireEvent.change(screen.getByLabelText('Web-URL'), { target: { value: 'https://example.com/events' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Einstellungen' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Headerbild')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Headerbild'), { target: { value: 'asset-header' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Konzertabend',
          description: 'Live im Stadtpark',
          dates: [{ dateStart: '2026-04-14' }],
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

  it('ignores impossible date-only input values that browsers reject natively', async () => {
    render(<EventsCreatePage />);

    await waitFor(() => {
      expect(listHostMediaAssets).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Konzertabend' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Inhalt' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Startdatum')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: '2026-03-40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Konzertabend',
          dates: [],
        })
      );
    });

    expect(screen.getByLabelText('Startdatum').getAttribute('value')).toBe('');
    expect(screen.getByLabelText('Startdatum').getAttribute('aria-invalid')).toBeNull();
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
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Einstellungen' }));
    await waitFor(() => {
      expect((screen.getByLabelText('Headerbild') as HTMLSelectElement).value).toBe('asset-header');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Medium entfernen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith(
        'event-1',
        expect.objectContaining({
          title: 'Bestehendes Event',
          description: 'Beschreibung',
          urls: [{ url: 'https://example.com/events' }],
        })
      );
      expect(screen.getByText('Event wurde aktualisiert.')).toBeTruthy();
    });
  });
});
