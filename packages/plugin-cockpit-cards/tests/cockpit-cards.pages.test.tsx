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
  getAsset: vi.fn(),
  getDelivery: vi.fn(),
  listReferences: vi.fn(),
  replaceReferences: vi.fn(),
  updateAsset: vi.fn(),
  saveWithReferences: vi.fn(),
  navigate: vi.fn(),
  params: {} as { id?: string; contentId?: string },
  search: { page: 1, pageSize: 25 } as { page?: number; pageSize?: number },
  sessionAccess: {
    permissionActions: ['media.read', 'media.reference.manage', 'media.create', 'media.update'],
  },
}));

vi.mock('../src/cockpit-cards.api.js', () => ({
  createCockpitCard: state.create,
  deleteCockpitCard: state.delete,
  getCockpitCard: state.get,
  listCockpitCards: state.list,
  listCockpitCardCategories: state.listCategories,
  updateCockpitCard: state.update,
}));
vi.mock('@sva/plugin-sdk', () => ({
  alignHostMediaReferencesByOrder: ({
    itemCount,
    references,
  }: {
    itemCount: number;
    references: readonly { assetId: string }[];
  }) =>
    Array.from({ length: itemCount }, (_, index) =>
      references[index]
        ? { assetId: references[index]!.assetId, status: 'synced' }
        : { status: 'missing' }
    ),
  fetchIamContentHistory: state.history,
  formatDateTimeInEditorTimeZone: (value: string) => `formatted:${value}`,
  getHostMediaAsset: state.getAsset,
  getHostMediaAssetFileName: () => 'asset.jpg',
  getHostMediaDelivery: state.getDelivery,
  listHostMediaAssets: state.listAssets,
  listHostMediaReferencesByTarget: state.listReferences,
  readSessionAccessSnapshot: () => state.sessionAccess,
  resolveContentMediaCapabilities: ({
    canEditContent,
    permissionActions,
  }: {
    canEditContent: boolean;
    permissionActions: readonly string[];
  }) => {
    const permissions = new Set(permissionActions);
    const canSelect =
      canEditContent && permissions.has('media.read') && permissions.has('media.reference.manage');
    return {
      canSelect,
      canUpload: canSelect && permissions.has('media.create'),
      canEditAssetMetadata: canEditContent && permissions.has('media.update'),
    };
  },
  replaceHostMediaReferences: state.replaceReferences,
  saveContentWithHostMediaReferences: state.saveWithReferences,
  subscribeSessionAccessSnapshot: () => () => undefined,
  updateHostMediaAsset: state.updateAsset,
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
  fireEvent.change(screen.getByLabelText('fields.category'), { target: { value: 'Startseite' } });
  fireEvent.click(screen.getByRole('tab', { name: 'tabs.content.label' }));
  fireEvent.change(screen.getByLabelText('fields.text'), { target: { value: 'Neuer Text' } });
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
    state.sessionAccess = {
      permissionActions: ['media.read', 'media.reference.manage', 'media.create', 'media.update'],
    };
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
    state.listReferences.mockResolvedValue([]);
    state.getDelivery.mockResolvedValue({
      deliveryUrl: 'https://example.test/image.jpg',
      isPublicUrl: true,
    });
    state.saveWithReferences.mockImplementation(
      async ({ saveContent }: { saveContent: () => Promise<unknown> }) => ({
        status: 'complete',
        saved: await saveContent(),
      })
    );
  });

  it('places text and image controls together and loads category and media options', async () => {
    const { CockpitCardsCreatePage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsCreatePage />);
    const tablist = screen.getByRole('tablist', { name: 'tabs.ariaLabel' });
    const basisTab = screen.getByRole('tab', { name: 'tabs.basis.label' });
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content.label' }));
    const contentPanel = screen.getByLabelText('fields.text').closest('[role="tabpanel"]');
    const addImage = screen.getByRole('button', { name: 'actions.addImage' });
    expect(tablist.className).toContain('ml-[10px]');
    expect(basisTab.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(contentPanel?.className).toContain('mt-0');
    expect(contentPanel?.contains(addImage)).toBe(true);
    expect(await screen.findByRole('option', { name: 'Startseite' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'actions.selectImage' }));
    await waitFor(() => expect(state.listAssets).toHaveBeenCalled());
    expect(screen.queryByText('info.pdf')).toBeNull();
  });

  it('reviews and accepts a linked image from the media library', async () => {
    state.getAsset.mockResolvedValue({
      id: 'image-1',
      fileName: 'bild.jpg',
      mimeType: 'image/jpeg',
      visibility: 'public',
      previewUrl: 'https://example.test/preview.jpg',
      metadata: {
        title: 'Titel',
        altText: 'Alt',
        description: 'Beschreibung',
        copyright: 'Stadt',
        license: 'CC0',
      },
    });
    state.getDelivery.mockResolvedValue({
      deliveryUrl: 'https://example.test/persistent.jpg',
      isPublicUrl: true,
    });
    state.updateAsset.mockResolvedValue({
      id: 'image-1',
      fileName: 'bild.jpg',
      mimeType: 'image/jpeg',
      visibility: 'public',
      metadata: {
        title: 'Neuer Titel',
        altText: 'Alt',
        description: 'Beschreibung',
        copyright: 'Stadt',
        license: 'CC0',
      },
    });
    const { CockpitCardsCreatePage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsCreatePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content.label' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.selectImage' }));
    await screen.findAllByRole('button', { name: 'actions.selectImage' });
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.selectImage' }).at(-1)!);
    await screen.findByDisplayValue('Titel');
    fireEvent.change(screen.getByDisplayValue('Titel'), { target: { value: 'Neuer Titel' } });
    fireEvent.click(screen.getByRole('button', { name: 'media.use' }));

    await waitFor(() =>
      expect(screen.getByDisplayValue('https://example.test/persistent.jpg')).toBeTruthy()
    );
    expect(state.getAsset).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'image-1' }));
    expect(state.updateAsset).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'image-1' }));
    state.getAsset.mockResolvedValueOnce({
      id: 'image-1',
      mimeType: 'image/jpeg',
      visibility: 'public',
      metadata: {},
    });
    fireEvent.click(screen.getByRole('button', { name: 'media.refresh' }));
    expect(await screen.findByText('media.refreshTitle')).toBeTruthy();
  });

  it('uploads and accepts a supported image through the overlay', async () => {
    state.upload.mockResolvedValue({
      assetId: 'uploaded-1',
      previewUrl: 'https://example.test/upload-preview.jpg',
    });
    state.getAsset.mockResolvedValue({
      id: 'uploaded-1',
      fileName: 'upload.jpg',
      mimeType: 'image/jpeg',
      visibility: 'public',
      metadata: {},
    });
    state.getDelivery.mockResolvedValue({
      deliveryUrl: 'https://example.test/upload.jpg',
      isPublicUrl: true,
    });
    const { CockpitCardsCreatePage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsCreatePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content.label' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.uploadImage' }));
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: { files: [new File(['image'], 'upload.jpg', { type: 'image/jpeg' })] },
    });
    await screen.findByDisplayValue('asset.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'media.use' }));
    await waitFor(() =>
      expect(screen.getByDisplayValue('https://example.test/upload.jpg')).toBeTruthy()
    );
    expect(state.upload).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'public', mediaType: 'image' })
    );
  });

  it('creates a card with the complete normalized payload', async () => {
    state.create.mockResolvedValue({ id: 'card-new' });
    const { CockpitCardsCreatePage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsCreatePage />);
    await screen.findByRole('option', { name: 'Startseite' });
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('fields.languageCode'), { target: { value: 'en-us' } });
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.settings.label' }));
    fireEvent.change(screen.getByLabelText('fields.link'), {
      target: { value: 'https://example.test/ziel' },
    });
    fireEvent.change(screen.getByLabelText('fields.sortWeight'), { target: { value: '7' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.create' }).at(-1)!);

    await waitFor(() => expect(state.create).toHaveBeenCalledTimes(1));
    expect(state.create.mock.calls[0]?.[0]).toMatchObject({
      title: 'Neue Karte',
      contentBlocks: [{ body: 'Neuer Text' }],
      payload: { languageCode: 'en-US', sortWeight: 7 },
      categoryName: 'Startseite',
      categories: [{ name: 'Startseite' }],
      webUrls: [{ url: 'https://example.test/ziel' }],
    });
    expect(state.create.mock.calls[0]?.[1]).toBe('user');
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
    expect(state.listReferences).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'cockpit-cards.cockpit-card',
        targetId: 'card-1',
      })
    );
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content.label' }));
    fireEvent.change(screen.getByLabelText('fields.text'), { target: { value: 'Geändert' } });
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.settings.label' }));
    fireEvent.click(screen.getByLabelText('fields.visible'));
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.update' }).at(-1)!);
    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith(
        'card-1',
        expect.objectContaining({
          contentBlocks: [{ body: 'Geändert' }],
          payload: { languageCode: 'de', sortWeight: 2, legacy: 'keep' },
          visible: true,
        }),
        'user'
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'deleteDialog.confirm' }));
    await waitFor(() => expect(state.delete).toHaveBeenCalledWith('card-1', 'user'));
    expect(state.navigate).toHaveBeenCalledWith({ to: '/admin/content' });
  });

  it('keeps library and upload actions unavailable without media permissions', async () => {
    state.sessionAccess = { permissionActions: [] };
    const { CockpitCardsCreatePage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsCreatePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content.label' }));
    expect(screen.queryByRole('button', { name: 'actions.selectImage' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'actions.uploadImage' })).toBeNull();
    expect(screen.getByRole('button', { name: 'actions.addImage' })).toBeTruthy();
  });

  it('saves linked references with the canonical target after the content save', async () => {
    state.params = { id: 'card-1' };
    state.get.mockResolvedValue(record);
    state.update.mockResolvedValue(record);
    state.listReferences.mockResolvedValue([
      { assetId: 'asset-1', role: 'gallery_item', sortOrder: 0 },
    ]);
    const { CockpitCardsEditPage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsEditPage />);
    await screen.findByDisplayValue('Bestehende Karte');
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.update' }).at(-1)!);
    await waitFor(() =>
      expect(state.saveWithReferences).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'cockpit-cards.cockpit-card',
          references: [{ assetId: 'asset-1', role: 'gallery_item', sortOrder: 0 }],
        })
      )
    );
  });

  it('keeps a failed reference retry visible and clears it after a successful retry', async () => {
    state.params = { id: 'card-1' };
    state.get.mockResolvedValue(record);
    state.update.mockResolvedValue(record);
    state.listReferences.mockResolvedValue([
      { assetId: 'asset-1', role: 'gallery_item', sortOrder: 0 },
    ]);
    const retry = vi
      .fn()
      .mockRejectedValueOnce(new Error('still unavailable'))
      .mockResolvedValueOnce(undefined);
    state.saveWithReferences.mockImplementationOnce(
      async ({ saveContent }: { saveContent: () => Promise<unknown> }) => ({
        status: 'reference_failed',
        saved: await saveContent(),
        retryReferenceSync: retry,
      })
    );
    const { CockpitCardsEditPage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsEditPage />);
    await screen.findByDisplayValue('Bestehende Karte');
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.update' }).at(-1)!);
    await screen.findByText('messages.mediaReferencePartialFailure');
    fireEvent.click(screen.getByRole('button', { name: 'actions.retryMediaReferences' }));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
    expect(screen.getByText('messages.mediaReferencePartialFailure')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'actions.retryMediaReferences' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'actions.retryMediaReferences' })).toBeNull()
    );
  });

  it('surfaces load, save, delete, category and media failures', async () => {
    state.params = { contentId: 'card-1' };
    state.get.mockRejectedValue(new Error('load failed'));
    state.listCategories.mockRejectedValue(new Error('categories failed'));
    state.listAssets.mockRejectedValue(new Error('media failed'));
    const { CockpitCardsCreatePage, CockpitCardsEditPage } =
      await import('../src/cockpit-cards.pages.js');
    const edit = render(<CockpitCardsEditPage />);
    await screen.findByText('messages.loadError');
    edit.unmount();

    state.create.mockRejectedValue(new Error('save failed'));
    const failedDependencies = render(<CockpitCardsCreatePage />);
    await screen.findByText('messages.categoriesError');
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content.label' }));
    expect(screen.getByRole('button', { name: 'actions.addImage' })).toBeTruthy();
    failedDependencies.unmount();

    state.listCategories.mockResolvedValue([{ id: 'category-1', name: 'Startseite' }]);
    state.listAssets.mockResolvedValue([]);
    render(<CockpitCardsCreatePage />);
    await screen.findByRole('option', { name: 'Startseite' });
    fillRequiredFields();
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.create' }).at(-1)!);
    await screen.findByText('messages.saveErrorWithReason');
  });

  it('routes validation summaries to the affected tab and reports delete failures', async () => {
    const { CockpitCardsCreatePage, CockpitCardsEditPage } =
      await import('../src/cockpit-cards.pages.js');
    const create = render(<CockpitCardsCreatePage />);
    await screen.findByRole('option', { name: 'Startseite' });
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.create' }).at(-1)!);
    expect(await screen.findByText('messages.validationError')).toBeTruthy();
    expect(screen.getByLabelText('fields.heading').getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByRole('tab', { name: 'tabs.basis.label' }).getAttribute('aria-selected')
    ).toBe('true');
    fireEvent.change(screen.getByLabelText('fields.heading'), { target: { value: 'Kachel' } });
    fireEvent.change(screen.getByLabelText('fields.category'), { target: { value: 'Startseite' } });
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content.label' }));
    fireEvent.change(screen.getByLabelText('fields.text'), { target: { value: '<b>Kachel</b>' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.create' }).at(-1)!);
    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: 'tabs.content.label' }).getAttribute('aria-selected')
      ).toBe('true')
    );
    create.unmount();

    state.params = { id: 'card-1' };
    state.get.mockResolvedValue(record);
    state.delete.mockRejectedValue(new Error('delete failed'));
    render(<CockpitCardsEditPage />);
    await screen.findByDisplayValue('Bestehende Karte');
    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'deleteDialog.confirm' }));
    expect(await screen.findByText('messages.deleteError')).toBeTruthy();
  });

  it('uses the generic save error for non-Error rejections', async () => {
    state.create.mockRejectedValue('save failed');
    const { CockpitCardsCreatePage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsCreatePage />);
    await screen.findByRole('option', { name: 'Startseite' });
    fillRequiredFields();
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.create' }).at(-1)!);
    expect(await screen.findByText('messages.saveError')).toBeTruthy();
  });

  it('adds, reorders and removes manual images through the shared block', async () => {
    const { CockpitCardsCreatePage } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsCreatePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content.label' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.addImage' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.addImage' }));
    const urls = screen.getAllByLabelText('fields.imageUrl');
    fireEvent.change(urls[0]!, { target: { value: 'https://example.test/one.jpg' } });
    fireEvent.change(urls[1]!, { target: { value: 'https://example.test/two.jpg' } });
    const down = screen.getAllByRole('button', { name: 'actions.moveImageDown' })[0]!;
    fireEvent.click(down);
    expect(
      screen.getAllByLabelText('fields.imageUrl').map((input) => (input as HTMLInputElement).value)
    ).toEqual(['https://example.test/two.jpg', 'https://example.test/one.jpg']);
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.removeImage' })[1]!);
    expect(screen.getAllByLabelText('fields.imageUrl')).toHaveLength(1);
  });

  it('renders history entries and history errors', async () => {
    state.history.mockResolvedValue([
      {
        id: 'h1',
        createdAt: '2026-08-01',
        action: 'update',
        actor: 'Ada',
        summary: '',
        changedFields: ['title'],
      },
    ]);
    const { CockpitCardsHistory } = await import('../src/cockpit-cards.pages.js');
    const view = render(<CockpitCardsHistory contentId="card-1" />);
    await waitFor(() =>
      expect(state.history).toHaveBeenCalledWith('card-1', {
        contentType: 'cockpit-cards.cockpit-card',
      })
    );
    expect(await screen.findByText('formatted:2026-08-01')).toBeTruthy();
    expect(screen.getByText('title')).toBeTruthy();
    view.unmount();

    state.history.mockRejectedValue(new Error('history failed'));
    render(<CockpitCardsHistory contentId="card-1" />);
    expect(await screen.findByText('history.error')).toBeTruthy();
  });

  it('formats every known history action and falls back to stored values', async () => {
    state.history.mockResolvedValue([
      {
        id: 'h1',
        createdAt: '',
        action: 'created',
        actor: 'Ada',
        summary: 'Angelegt',
        changedFields: [],
      },
      {
        id: 'h2',
        createdAt: '',
        action: 'updated',
        actor: 'Ada',
        summary: 'Geändert',
        changedFields: [],
      },
      {
        id: 'h3',
        createdAt: '',
        action: 'status_changed',
        actor: 'Ada',
        summary: 'Status',
        changedFields: [],
      },
      {
        id: 'h4',
        createdAt: '',
        action: 'imported',
        actor: 'Ada',
        summary: 'Import',
        changedFields: [],
      },
    ]);
    const { CockpitCardsHistory } = await import('../src/cockpit-cards.pages.js');
    render(<CockpitCardsHistory contentId="card-1" />);
    expect(await screen.findByText('history.actions.created')).toBeTruthy();
    expect(screen.getByText('history.actions.updated')).toBeTruthy();
    expect(screen.getByText('history.actions.statusChanged')).toBeTruthy();
    expect(screen.getByText('imported')).toBeTruthy();
    expect(screen.getByText('Angelegt')).toBeTruthy();
  });

  it('renders list loading, data, empty and error states with normalized pagination', async () => {
    const { CockpitCardsListPage } = await import('../src/cockpit-cards.pages.js');
    state.search = { page: -1, pageSize: 42 };
    state.list.mockResolvedValue({
      data: [record],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    const data = render(<CockpitCardsListPage />);
    expect((await screen.findAllByText('Bestehende Karte')).length).toBeGreaterThan(0);
    expect(state.list).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    expect(screen.getAllByText('de').length).toBeGreaterThan(0);
    data.unmount();

    state.list.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 50, hasNextPage: false },
    });
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
