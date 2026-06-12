import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PoiCreatePage, PoiEditPage } from './poi.pages.js';

const navigateMock = vi.hoisted(() => vi.fn());
const createPoiMock = vi.hoisted(() => vi.fn());
const getPoiMock = vi.hoisted(() => vi.fn());
const listHostMediaAssetsMock = vi.hoisted(() => vi.fn());
const paramsMock = vi.hoisted(() => vi.fn(() => ({})));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { readonly to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
  useParams: () => paramsMock(),
  useSearch: () => ({}),
}));

vi.mock('@sva/plugin-sdk', () => ({
  findHostMediaReferenceAssetId: vi.fn(),
  listHostMediaAssets: listHostMediaAssetsMock,
  listHostMediaReferencesByTarget: vi.fn(),
  replaceHostMediaReferences: vi.fn(),
  toHostMediaFieldOptions: (assets: readonly { assetId: string; label: string }[]) => assets,
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('./plugin.js', () => ({
  pluginPoiMediaPickers: {
    teaserImage: {
      roles: ['teaser'],
    },
  },
}));

vi.mock('./poi.api.js', () => ({
  PoiApiError: class PoiApiError extends Error {},
  listPoi: vi.fn(),
  getPoi: getPoiMock,
  createPoi: createPoiMock,
  updatePoi: vi.fn(),
  deletePoi: vi.fn(),
}));

describe('PoiCreatePage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    createPoiMock.mockReset();
    getPoiMock.mockReset();
    listHostMediaAssetsMock.mockReset();
    paramsMock.mockReset();
    paramsMock.mockReturnValue({});
    listHostMediaAssetsMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('maps validation errors through the shared StudioField bridge before submit', async () => {
    render(<PoiCreatePage />);

    fireEvent.click(screen.getByRole('tab', { name: 'detailTabs.content.title' }));
    await waitFor(() => {
      expect(screen.getByLabelText('fields.url')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('fields.url'), {
      target: { value: 'http://invalid.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() => {
      expect(screen.getAllByRole('alert').some((element) => element.textContent?.includes('validation.name'))).toBe(true);
      expect(screen.getAllByRole('alert').some((element) => element.textContent?.includes('validation.webUrls'))).toBe(true);
    });

    const urlInput = screen.getByLabelText('fields.url');
    fireEvent.click(screen.getByRole('link', { name: 'validation.name' }));
    await waitFor(() => {
      expect(screen.getByLabelText('fields.name')).toBeTruthy();
    });
    const nameInput = screen.getByLabelText('fields.name');

    expect(nameInput.getAttribute('aria-invalid')).toBe('true');
    expect(urlInput.getAttribute('aria-invalid')).toBe('true');

    expect(document.activeElement).toBe(nameInput);
    expect(createPoiMock).not.toHaveBeenCalled();
  });

  it('surfaces category validation through the resolver when other fields are already valid', async () => {
    render(<PoiCreatePage />);

    fireEvent.change(screen.getByLabelText('fields.name'), {
      target: { value: 'Valid POI' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'detailTabs.content.title' }));
    await waitFor(() => {
      expect(screen.getByLabelText('fields.url')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('fields.url'), {
      target: { value: 'https://example.com' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'detailTabs.basis.title' }));
    await waitFor(() => {
      expect(screen.getByLabelText('fields.categoryName')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('fields.categoryName'), {
      target: { value: 'x'.repeat(129) },
    });

    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() => {
      expect(screen.getAllByRole('alert').some((element) => element.textContent?.includes('validation.categoryName'))).toBe(true);
    });

    expect(screen.getByLabelText('fields.categoryName').getAttribute('aria-invalid')).toBe('true');
    expect(createPoiMock).not.toHaveBeenCalled();
  });

  it('blocks invalid JSON payloads and submits compacted data after correction', async () => {
    createPoiMock.mockResolvedValue({
      id: 'poi-1',
      contentType: 'poi',
      status: 'published',
      name: 'Test POI',
      createdAt: '2026-05-22T10:00:00.000Z',
      updatedAt: '2026-05-22T10:00:00.000Z',
    });

    render(<PoiCreatePage />);

    fireEvent.change(screen.getByLabelText('fields.name'), {
      target: { value: ' Test POI ' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'detailTabs.content.title' }));
    await waitFor(() => {
      expect(screen.getByLabelText('fields.payload')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('fields.payload'), {
      target: { value: '{"hero":' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() => {
      expect(screen.getAllByRole('alert').some((element) => element.textContent?.includes('validation.payload'))).toBe(true);
    });

    const payloadInput = screen.getByLabelText('fields.payload');
    expect(payloadInput.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(payloadInput);

    fireEvent.change(payloadInput, {
      target: { value: '{"hero":"Willkommen"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() => {
      expect(createPoiMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test POI',
          payload: { hero: 'Willkommen' },
        })
      );
      expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/poi/$id', params: { id: 'poi-1' } });
    });
  });

  it('shows the translated missing-content fallback when loading an edit form fails generically', async () => {
    paramsMock.mockReturnValue({ id: 'poi-404' });
    getPoiMock.mockRejectedValue(new Error('network down'));

    render(<PoiEditPage />);

    expect(screen.getByText('messages.loading')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('messages.missingContent')).toBeTruthy();
    });
  });
});
