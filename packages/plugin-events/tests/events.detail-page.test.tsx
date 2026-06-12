import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { listHostMediaReferencesByTarget, registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEvent } from '../src/events.api.js';

import { EventsDetailPage } from '../src/events.detail-page.js';

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
    replaceHostMediaReferences: vi.fn(async (input: unknown) => input),
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
}));

describe('EventsDetailPage', () => {
  beforeEach(() => {
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'events.detail.createTitle': 'Event anlegen',
        'events.detail.editTitle': 'Event bearbeiten',
        'events.actions.save': 'Speichern',
        'events.detailTabs.basis.title': 'Basis',
        'events.detailTabs.content.title': 'Inhalt',
        'events.detailTabs.settings.title': 'Einstellungen',
        'events.detailTabs.history.title': 'Historie',
        'events.cards.content.dates.title': 'Termine',
        'events.cards.content.addresses.title': 'Orte und Adressen',
        'events.cards.content.contact.title': 'Kontakt',
        'events.cards.content.links.title': 'Links',
        'events.cards.content.recurrence.title': 'Wiederholung',
        'events.cards.content.poi.title': 'POI-Verknüpfung',
        'events.history.empty.title': 'Noch keine Historie verfügbar.',
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
});
