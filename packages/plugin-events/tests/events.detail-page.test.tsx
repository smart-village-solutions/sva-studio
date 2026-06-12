import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { listHostMediaReferencesByTarget, registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEvent, deleteEvent, getEvent, updateEvent } from '../src/events.api.js';

import { EventsDetailPage } from '../src/events.detail-page.js';

const navigateMock = vi.fn();
const replaceHostMediaReferencesMock = vi.fn(async (input: unknown) => input);

vi.mock('../src/events.api.js', () => ({
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  EventsApiError: class EventsApiError extends Error {},
  getEvent: vi.fn(),
  listEvents: vi.fn(),
  listPoiForEventSelection: vi.fn(async () => []),
  updateEvent: vi.fn(),
}));

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
    listHostMediaAssets: vi.fn(async () => []),
    listHostMediaReferencesByTarget: vi.fn(async () => []),
    replaceHostMediaReferences: (...args: Parameters<typeof replaceHostMediaReferencesMock>) =>
      replaceHostMediaReferencesMock(...args),
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigateMock,
}));

describe('EventsDetailPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    replaceHostMediaReferencesMock.mockClear();
    vi.unstubAllGlobals();
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'events.detail.createTitle': 'Event anlegen',
        'events.detail.editTitle': 'Event bearbeiten',
        'events.actions.save': 'Speichern',
        'events.actions.delete': 'Löschen',
        'events.detailTabs.basis.title': 'Basis',
        'events.detailTabs.content.title': 'Inhalt',
        'events.detailTabs.settings.title': 'Einstellungen',
        'events.detailTabs.history.title': 'Historie',
        'events.tabs.mobileLabel': 'Bereich',
        'events.tabs.ariaLabel': 'Bereiche',
        'events.cards.content.dates.title': 'Termine',
        'events.cards.content.addresses.title': 'Orte und Adressen',
        'events.cards.content.contact.title': 'Kontakt',
        'events.cards.content.links.title': 'Links',
        'events.cards.content.recurrence.title': 'Wiederholung',
        'events.cards.content.poi.title': 'POI-Verknüpfung',
        'events.fields.title': 'Titel',
        'events.fields.url': 'URL',
        'events.fields.dateStart': 'Startdatum',
        'events.messages.validationError': 'Bitte Eingaben prüfen.',
        'events.history.empty.title': 'Noch keine Historie verfügbar.',
        'events.messages.updateSuccess': 'Event aktualisiert.',
        'events.actions.deleteConfirm': 'Wirklich löschen?',
      };

      return labels[key] ?? key;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the fixed tab order for events', async () => {
    render(<EventsDetailPage mode="create" />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Basis' })).toBeTruthy();
    });

    expect(screen.getByRole('tab', { name: 'Inhalt' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Einstellungen' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Historie' })).toBeTruthy();
  });

  it('shows event-specific cards inside the content tab', async () => {
    render(<EventsDetailPage mode="create" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Inhalt' }));

    await waitFor(() => {
      expect(screen.getByText('Termine')).toBeTruthy();
    });

    expect(screen.getByText('Orte und Adressen')).toBeTruthy();
    expect(screen.getByText('Kontakt')).toBeTruthy();
    expect(screen.getByText('Links')).toBeTruthy();
    expect(screen.getByText('Wiederholung')).toBeTruthy();
    expect(screen.getByText('POI-Verknüpfung')).toBeTruthy();
  });

  it('renders a global save action and a history placeholder for events', async () => {
    render(<EventsDetailPage mode="create" />);

    expect(await screen.findByRole('button', { name: 'Speichern' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));
    await waitFor(() => {
      expect(screen.getByText('Noch keine Historie verfügbar.')).toBeTruthy();
    });
  });

  it('renders the event editor after the core item loaded even when media references are still pending', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1944004',
      title: 'Stadtfest',
      description: 'Innenstadt',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
      addresses: [{ street: 'Marktplatz 1', city: 'Musterhausen' }],
      urls: [{ url: 'https://example.com/events' }],
    } as never);
    vi.mocked(listHostMediaReferencesByTarget).mockImplementationOnce(
      () => new Promise(() => undefined)
    );

    render(<EventsDetailPage mode="edit" contentId="1944004" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtfest')).toBeTruthy();
    });
  });

  it('blocks submission on invalid title, invalid date input, and non-https links', async () => {
    render(<EventsDetailPage mode="create" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Inhalt' }));
    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: 'invalid-date' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'http://example.com/events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createEvent)).not.toHaveBeenCalled();
    });

    expect(screen.getByDisplayValue('http://example.com/events')).toBeTruthy();
  });

  it('updates events and preserves the loaded header image reference on save', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      description: 'Innenstadt',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
      addresses: [{ street: 'Marktplatz 1', city: 'Musterhausen' }],
      urls: [{ url: 'https://example.com/events' }],
    } as never);
    vi.mocked(listHostMediaReferencesByTarget).mockResolvedValueOnce([
      {
        id: 'reference-1',
        assetId: 'asset-1',
        role: 'header_image',
      },
    ] as never);
    vi.mocked(updateEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
    } as never);

    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtfest')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(updateEvent)).toHaveBeenCalledTimes(1);
      expect(replaceHostMediaReferencesMock).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        targetType: 'events',
        targetId: 'event-1',
        references: [
          {
            assetId: 'asset-1',
            role: 'header_image',
            sortOrder: 0,
          },
        ],
      });
      expect(screen.getByText('Event aktualisiert.')).toBeTruthy();
    });
  });

  it('deletes events after confirmation and returns to the content overview', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({
      id: 'event-1',
      title: 'Stadtfest',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
    } as never);
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<EventsDetailPage mode="edit" contentId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Stadtfest')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(vi.mocked(deleteEvent)).toHaveBeenCalledWith('event-1');
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/content' });
    });
  });
});
