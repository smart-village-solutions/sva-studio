import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  create: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  listCategories: vi.fn(),
  listAssets: vi.fn(),
  upload: vi.fn(),
  history: vi.fn(),
  navigate: vi.fn(),
  params: {} as { id?: string; contentId?: string },
  search: { page: 1, pageSize: 25 } as { page?: number; pageSize?: number },
}));

vi.mock('../src/cockpit-cards.api.js', () => ({
  createCockpitCard: state.create,
  deleteCockpitCard: state.delete,
  getCockpitCard: state.get,
  listCockpitCards: state.list,
  updateCockpitCard: state.update,
}));
vi.mock('@sva/plugin-categories', () => ({
  listCategories: state.listCategories,
  flattenCategoriesForTable: (items: unknown[]) => items,
}));
vi.mock('@sva/plugin-sdk', () => ({
  fetchIamContentHistory: state.history,
  formatDateTimeInEditorTimeZone: (value: string) => `formatted:${value}`,
  listHostMediaAssets: state.listAssets,
  uploadHostMediaFile: state.upload,
  usePluginTranslation: () => (key: string) => key,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => state.navigate,
  useParams: () => state.params,
  useSearch: () => state.search,
}));

const record = {
  id: 'card-1',
  title: 'Bestehende Karte',
  genericType: 'CockpitCard' as const,
  contentBlocks: [{ body: 'Bestehender Text' }],
  payload: { languageCode: 'de', sortWeight: 2, legacy: 'keep' },
  categories: [{ name: 'Startseite' }],
  mediaContents: [
    { sourceUrl: { url: 'https://example.test/old.jpg' }, contentType: 'image' as const },
  ],
  webUrls: [{ url: 'https://example.test/alt' }],
  visible: false,
  publicationDate: '2026-08-02T10:00:00.000Z',
  createdAt: '',
  updatedAt: '',
};

const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText('fields.heading'), { target: { value: 'Neue Karte' } });
  fireEvent.change(screen.getByLabelText('fields.text'), { target: { value: 'Neuer Text' } });
  fireEvent.change(screen.getByLabelText('fields.category'), { target: { value: 'Startseite' } });
  fireEvent.click(screen.getByRole('button', { name: 'actions.addImage' }));
  fireEvent.change(screen.getByLabelText('fields.imageUrl'), {
    target: { value: 'https://example.test/new.jpg' },
  });
};

describe('cockpit cards pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.params = {};
    state.search = { page: 1, pageSize: 25 };
    state.listCategories.mockResolvedValue([{ id: 'category-1', name: 'Startseite' }]);
    state.listAssets.mockResolvedValue([
      {
        id: 'image-1',
        fileName: 'bild.jpg',
        mimeType: 'image/jpeg',
        visibility: 'public',
        previewUrl: 'https://example.test/bild.jpg',
      },
      { id: 'document-1', fileName: 'info.pdf', mimeType: 'application/pdf' },
    ]);
    state.history.mockResolvedValue([]);
  });

  it('places text and image controls together and loads category and media options', async () => {
    const { CockpitCardsCreatePage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsCreatePage />);
    const contentPanel = screen.getByLabelText('fields.text').closest('[role="tabpanel"]');
    const addImage = screen.getByRole('button', { name: 'actions.addImage' });
    expect(contentPanel?.contains(addImage)).toBe(true);
    expect(await screen.findByRole('option', { name: 'Startseite' })).toBeTruthy();
    expect(await screen.findByRole('option', { name: 'bild.jpg' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'info.pdf' })).toBeNull();
  });

  it('creates a card with the complete normalized payload', async () => {
    state.create.mockResolvedValue({ id: 'card-new' });
    const { CockpitCardsCreatePage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsCreatePage />);
    await screen.findByRole('option', { name: 'Startseite' });
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('fields.languageCode'), { target: { value: 'en-us' } });
    fireEvent.change(screen.getByLabelText('fields.link'), {
      target: { value: 'https://example.test/ziel' },
    });
    fireEvent.change(screen.getByLabelText('fields.sortWeight'), { target: { value: '7' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.save' })[1]!);

    await waitFor(() => expect(state.create).toHaveBeenCalledTimes(1));
    expect(state.create.mock.calls[0]?.[0]).toMatchObject({
      title: 'Neue Karte',
      contentBlocks: [{ body: 'Neuer Text' }],
      payload: { languageCode: 'en-US', sortWeight: 7 },
      categoryName: 'Startseite',
      categories: [{ name: 'Startseite' }],
      webUrls: [{ url: 'https://example.test/ziel' }],
    });
    expect(state.navigate).toHaveBeenCalledWith({
      to: '/admin/cockpit-cards/$id',
      params: { id: 'card-new' },
    });
  });

  it('loads, updates and deletes an existing card', async () => {
    state.params = { id: 'card-1' };
    state.get.mockResolvedValue(record);
    state.update.mockResolvedValue(record);
    state.delete.mockResolvedValue(undefined);
    const { CockpitCardsEditPage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsEditPage />);
    await screen.findByDisplayValue('Bestehende Karte');
    fireEvent.change(screen.getByLabelText('fields.text'), { target: { value: 'Geändert' } });
    fireEvent.click(screen.getByLabelText('fields.visible'));
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.save' })[1]!);
    await waitFor(() => expect(state.update).toHaveBeenCalledWith('card-1', expect.objectContaining({
      contentBlocks: [{ body: 'Geändert' }],
      payload: { languageCode: 'de', sortWeight: 2, legacy: 'keep' },
      visible: true,
    })));
    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    await waitFor(() => expect(state.delete).toHaveBeenCalledWith('card-1'));
    expect(state.navigate).toHaveBeenCalledWith({ to: '/admin/content' });
  });

  it('surfaces load, save, delete, category and media failures', async () => {
    state.params = { contentId: 'card-1' };
    state.get.mockRejectedValue(new Error('load failed'));
    state.listCategories.mockRejectedValue(new Error('categories failed'));
    state.listAssets.mockRejectedValue(new Error('media failed'));
    const { CockpitCardsCreatePage, CockpitCardsEditPage } = await import(
      '../src/cockpit-cards.pages.js'
    );
    const edit = render(<CockpitCardsEditPage />);
    await screen.findByText('messages.loadError');
    edit.unmount();

    state.create.mockRejectedValue(new Error('save failed'));
    const failedDependencies = render(<CockpitCardsCreatePage />);
    await screen.findByText('messages.categoriesError');
    await screen.findByText('messages.mediaError');
    failedDependencies.unmount();

    state.listCategories.mockResolvedValue([{ id: 'category-1', name: 'Startseite' }]);
    state.listAssets.mockResolvedValue([]);
    render(<CockpitCardsCreatePage />);
    await screen.findByRole('option', { name: 'Startseite' });
    fillRequiredFields();
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.save' })[1]!);
    await screen.findByText('messages.saveErrorWithReason');
  });

  it('selects, reorders, removes and uploads images', async () => {
    state.upload.mockResolvedValue({ previewUrl: 'https://example.test/upload.jpg' });
    const { CockpitCardsCreatePage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsCreatePage />);
    const select = await screen.findByLabelText('actions.selectImage');
    fireEvent.change(select, { target: { value: 'https://example.test/bild.jpg' } });
    fireEvent.click(screen.getByRole('button', { name: 'actions.addImage' }));
    const down = screen.getAllByRole('button', { name: 'actions.moveImageDown' })[0]!;
    fireEvent.click(down);
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.moveImageUp' })[1]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.removeImage' })[1]!);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['image'], 'upload.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(state.upload).toHaveBeenCalledTimes(1));
    expect(await screen.findByDisplayValue('https://example.test/upload.jpg')).toBeTruthy();
  });

  it('renders history entries and history errors', async () => {
    state.history.mockResolvedValue([
      { id: 'h1', createdAt: '2026-08-01', action: 'update', actor: 'Ada', summary: '', changedFields: ['title'] },
    ]);
    const { CockpitCardsHistory } = await import('../src/cockpit-cards.pages.js');
    const view = render(<CockpitCardsHistory contentId="card-1" />);
    await waitFor(() => expect(state.history).toHaveBeenCalledWith('card-1'));
    expect(await screen.findByText('formatted:2026-08-01')).toBeTruthy();
    expect(screen.getByText('title')).toBeTruthy();
    view.unmount();

    state.history.mockRejectedValue(new Error('history failed'));
    render(<CockpitCardsHistory contentId="card-1" />);
    expect(await screen.findByText('history.error')).toBeTruthy();
  });

  it('renders list loading, data, empty and error states with normalized pagination', async () => {
    const { CockpitCardsListPage } = await import('../src/cockpit-cards.pages.js');
    state.search = { page: -1, pageSize: 42 };
    state.list.mockResolvedValue({ data: [record], pagination: { page: 1, pageSize: 25, hasNextPage: false } });
    const data = render(<CockpitCardsListPage />);
    expect((await screen.findAllByText('Bestehende Karte')).length).toBeGreaterThan(0);
    expect(state.list).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    expect(screen.getAllByText('de').length).toBeGreaterThan(0);
    data.unmount();

    state.list.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 50, hasNextPage: false } });
    state.search = { page: 2, pageSize: 50 };
    const empty = render(<CockpitCardsListPage />);
    expect(await screen.findByText('list.empty')).toBeTruthy();
    expect(state.list).toHaveBeenLastCalledWith({ page: 2, pageSize: 50 });
    empty.unmount();

    state.list.mockRejectedValue(new Error('list failed'));
    render(<CockpitCardsListPage />);
    expect(await screen.findByText('messages.loadError')).toBeTruthy();
  });
});
