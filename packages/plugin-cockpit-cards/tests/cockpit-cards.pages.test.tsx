import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ create: vi.fn(), navigate: vi.fn() }));

vi.mock('../src/cockpit-cards.api.js', () => ({
  createCockpitCard: state.create,
  deleteCockpitCard: vi.fn(),
  getCockpitCard: vi.fn(),
  listCockpitCards: vi.fn(),
  updateCockpitCard: vi.fn(),
}));
vi.mock('@sva/plugin-categories', () => ({
  listCategories: vi.fn().mockResolvedValue([{ id: 'category-1', name: 'Startseite' }]),
  flattenCategoriesForTable: (items: unknown[]) => items,
}));
vi.mock('@sva/plugin-sdk', () => ({
  fetchIamContentHistory: vi.fn().mockResolvedValue([]),
  listHostMediaAssets: vi
    .fn()
    .mockResolvedValue([
      {
        id: 'image-1',
        fileName: 'bild.jpg',
        mimeType: 'image/jpeg',
        visibility: 'public',
        previewUrl: 'https://example.test/bild.jpg',
      },
    ]),
  uploadHostMediaFile: vi.fn(),
  usePluginTranslation: () => (key: string) => key,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => state.navigate,
  useParams: () => ({}),
  useSearch: () => ({ page: 1, pageSize: 25 }),
}));

describe('cockpit cards editor', () => {
  beforeEach(() => {
    state.create.mockReset();
    state.navigate.mockReset();
  });

  it('places text and image controls together in the content tab', async () => {
    const { CockpitCardsCreatePage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsCreatePage />);
    const contentPanel = screen.getByLabelText('fields.text').closest('[role="tabpanel"]');
    const addImage = screen.getByRole('button', { name: 'actions.addImage' });
    expect(contentPanel?.contains(addImage)).toBe(true);
    expect(screen.getByLabelText('actions.selectImage')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /media/i })).toBeNull();
  });

  it('offers only categories returned by the categories plugin', async () => {
    const { CockpitCardsCreatePage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsCreatePage />);
    expect(await screen.findByRole('option', { name: 'Startseite' })).toBeTruthy();
  });
});
