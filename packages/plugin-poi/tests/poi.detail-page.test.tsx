import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { listHostMediaReferencesByTarget, registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPoi } from '../src/poi.api.js';

import { PoiDetailPage } from '../src/poi.detail-page.js';

vi.mock('../src/poi.api.js', () => ({
  createPoi: vi.fn(),
  deletePoi: vi.fn(),
  getPoi: vi.fn(),
  listPoi: vi.fn(),
  PoiApiError: class PoiApiError extends Error {},
  updatePoi: vi.fn(),
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

describe('PoiDetailPage', () => {
  beforeEach(() => {
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'poi.detail.createTitle': 'POI anlegen',
        'poi.detail.editTitle': 'POI bearbeiten',
        'poi.actions.save': 'Speichern',
        'poi.detailTabs.basis.title': 'Basis',
        'poi.detailTabs.content.title': 'Inhalt',
        'poi.detailTabs.settings.title': 'Einstellungen',
        'poi.detailTabs.history.title': 'Historie',
        'poi.cards.content.descriptions.title': 'Beschreibungen',
        'poi.cards.content.contact.title': 'Kontakt',
        'poi.cards.content.location.title': 'Lage und Adresse',
        'poi.cards.content.openingHours.title': 'Öffnungszeiten',
        'poi.cards.content.links.title': 'Weblinks',
        'poi.cards.content.payload.title': 'Zusatzdaten',
        'poi.history.empty.title': 'Noch keine Historie verfügbar.',
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

  it('shows poi-specific cards inside the content tab', async () => {
    render(<PoiDetailPage mode="create" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Inhalt' }));

    expect(screen.getByText('Beschreibungen')).toBeTruthy();
    expect(screen.getByText('Kontakt')).toBeTruthy();
    expect(screen.getByText('Lage und Adresse')).toBeTruthy();
    expect(screen.getByText('Öffnungszeiten')).toBeTruthy();
    expect(screen.getByText('Weblinks')).toBeTruthy();
    expect(screen.getByText('Zusatzdaten')).toBeTruthy();
  });

  it('renders a global save action and a history placeholder for poi', async () => {
    render(<PoiDetailPage mode="create" />);

    expect(await screen.findByRole('button', { name: 'Speichern' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));
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
});
