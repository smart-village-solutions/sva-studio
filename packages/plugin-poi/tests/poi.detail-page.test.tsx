import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { listHostMediaReferencesByTarget, registerPluginTranslationResolver } from '@sva/plugin-sdk';
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

describe('PoiDetailPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    replaceHostMediaReferencesMock.mockClear();
    vi.unstubAllGlobals();
    registerPluginTranslationResolver((key) => {
      const labels: Record<string, string> = {
        'poi.detail.createTitle': 'POI anlegen',
        'poi.detail.editTitle': 'POI bearbeiten',
        'poi.actions.save': 'Speichern',
        'poi.actions.delete': 'Löschen',
        'poi.detailTabs.basis.title': 'Basis',
        'poi.detailTabs.content.title': 'Inhalt',
        'poi.detailTabs.settings.title': 'Einstellungen',
        'poi.detailTabs.history.title': 'Historie',
        'poi.tabs.mobileLabel': 'Bereich',
        'poi.tabs.ariaLabel': 'Bereiche',
        'poi.cards.content.descriptions.title': 'Beschreibungen',
        'poi.cards.content.contact.title': 'Kontakt',
        'poi.cards.content.location.title': 'Lage und Adresse',
        'poi.cards.content.openingHours.title': 'Öffnungszeiten',
        'poi.cards.content.links.title': 'Weblinks',
        'poi.cards.content.payload.title': 'Zusatzdaten',
        'poi.fields.name': 'Name',
        'poi.fields.url': 'URL',
        'poi.fields.payload': 'Payload',
        'poi.messages.validationError': 'Bitte Eingaben prüfen.',
        'poi.history.empty.title': 'Noch keine Historie verfügbar.',
        'poi.messages.createSuccess': 'POI erstellt.',
        'poi.messages.updateSuccess': 'POI aktualisiert.',
        'poi.actions.deleteConfirm': 'Wirklich löschen?',
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

  it('blocks submission on invalid payload json and invalid https links', async () => {
    render(<PoiDetailPage mode="create" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Inhalt' }));
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'http://example.com/poi' } });
    fireEvent.change(screen.getByLabelText('Payload'), { target: { value: '{' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(vi.mocked(createPoi)).not.toHaveBeenCalled();
    });

    expect(screen.getByDisplayValue('http://example.com/poi')).toBeTruthy();
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
