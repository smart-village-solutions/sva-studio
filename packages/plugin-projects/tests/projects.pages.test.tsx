import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  create: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  listAssets: vi.fn(),
  upload: vi.fn(),
  getAsset: vi.fn(),
  getDelivery: vi.fn(),
  updateAsset: vi.fn(),
  listReferences: vi.fn(),
  replaceReferences: vi.fn(),
  saveWithReferences: vi.fn(),
  navigate: vi.fn(),
  params: {} as { id?: string; contentId?: string },
  search: { page: 1, pageSize: 25 },
  accessSnapshot: {
    isResolved: true,
    assignedModules: ['projects'],
    permissionActions: [
      'projects.read',
      'projects.create',
      'projects.update',
      'projects.delete',
      'media.read',
      'media.reference.manage',
      'media.create',
      'media.update',
    ],
    roles: [],
  },
}));

vi.mock('../src/projects.api.js', () => ({
  createProject: state.create,
  deleteProject: state.delete,
  getProject: state.get,
  listProjects: state.list,
  updateProject: state.update,
}));
vi.mock('@sva/plugin-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/plugin-sdk')>();
  return {
    ...actual,
    getHostMediaAsset: state.getAsset,
    getHostMediaDelivery: state.getDelivery,
    listHostMediaAssets: state.listAssets,
    listHostMediaReferencesByTarget: state.listReferences,
    replaceHostMediaReferences: state.replaceReferences,
    saveContentWithHostMediaReferences: state.saveWithReferences,
    updateHostMediaAsset: state.updateAsset,
    uploadHostMediaFile: state.upload,
    readSessionAccessSnapshot: () => state.accessSnapshot,
    subscribeSessionAccessSnapshot: () => () => undefined,
    usePluginTranslation: () => (key: string) => key,
  };
});
vi.mock('@sva/studio-ui-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/studio-ui-react')>();
  return {
    ...actual,
    RichTextHtmlEditor: ({
      id,
      labelId,
      onChange,
      value,
      ariaInvalid,
    }: {
      id: string;
      labelId: string;
      onChange: (value: string) => void;
      value: string;
      ariaInvalid?: boolean;
    }) => (
      <textarea
        id={id}
        aria-labelledby={labelId}
        aria-invalid={ariaInvalid}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    ),
  };
});
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => state.navigate,
  useParams: () => state.params,
  useSearch: () => state.search,
}));

const project = {
  id: 'project-1',
  language: 'de',
  title: 'Brückenbau',
  description: 'Neue Fußgängerbrücke',
  fullText: '<p>Details</p>',
  images: [
    { url: 'https://example.test/one.jpg', altText: 'Brücke', position: 0 },
    { url: 'https://example.test/two.jpg', altText: 'Baustelle', position: 1 },
  ],
  status: 'published' as const,
  published: true,
  publishedAt: '2026-08-03T10:00:00.000Z',
  author: { type: 'organization' as const, id: 'org-1', displayName: 'Stadt' },
  deleted: false,
  createdAt: '2026-08-03T09:00:00.000Z',
  updatedAt: '2026-08-03T10:00:00.000Z',
};

const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText('fields.language'), {
    target: { value: 'de-x-kommunal' },
  });
  fireEvent.change(screen.getByLabelText('fields.title'), { target: { value: 'Neues Projekt' } });
  fireEvent.change(screen.getByLabelText('fields.description'), { target: { value: 'Kurztext' } });
  fireEvent.click(screen.getByRole('tab', { name: 'tabs.content' }));
  fireEvent.change(screen.getByLabelText('fields.fullText'), {
    target: { value: '<p>Inhalt</p>' },
  });
};

describe('projects pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.params = {};
    state.listAssets.mockResolvedValue([]);
    state.listReferences.mockResolvedValue([]);
    state.replaceReferences.mockResolvedValue([]);
    state.saveWithReferences.mockImplementation(
      async (input: { saveContent: () => Promise<unknown> }) => ({
        status: 'complete',
        saved: await input.saveContent(),
      })
    );
    state.accessSnapshot = {
      isResolved: true,
      assignedModules: ['projects'],
      permissionActions: [
        'projects.read',
        'projects.create',
        'projects.update',
        'projects.delete',
        'media.read',
        'media.reference.manage',
        'media.create',
        'media.update',
      ],
      roles: [],
    };
  });

  it('renders the domain and history tabs and creates a normalized project', async () => {
    const { ProjectsCreatePage } = await import('../src/projects.pages.js');
    render(<ProjectsCreatePage />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'tabs.basis',
      'tabs.content',
      'tabs.settings',
      'tabs.history',
    ]);
    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: 'actions.addImage' }));
    fireEvent.change(screen.getByLabelText('fields.imageUrl'), {
      target: { value: 'https://example.test/project.jpg' },
    });
    fireEvent.change(screen.getByLabelText('fields.altText'), { target: { value: 'Projektbild' } });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'actions.create' }).at(-1) as HTMLElement
    );

    await waitFor(() => expect(state.create).toHaveBeenCalledTimes(1));
    expect(state.create.mock.calls[0]?.[0]).toMatchObject({
      language: 'de-x-kommunal',
      title: 'Neues Projekt',
      description: 'Kurztext',
      fullText: '<p>Inhalt</p>',
      images: [{ url: 'https://example.test/project.jpg', altText: 'Projektbild', position: 0 }],
    });
    expect(state.create.mock.calls[0]?.[0]).not.toHaveProperty('author');
  });

  it('marks invalid controls for the shared validation styling', async () => {
    const { ProjectsCreatePage } = await import('../src/projects.pages.js');
    render(<ProjectsCreatePage />);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'actions.create' }).at(-1) as HTMLElement
    );
    await waitFor(() =>
      expect(screen.getByLabelText('fields.title').getAttribute('aria-invalid')).toBe('true')
    );
  });

  it('loads, reorders, updates and soft-deletes an existing project', async () => {
    state.params = { id: 'project-1' };
    state.get.mockResolvedValue(project);
    state.update.mockResolvedValue(project);
    state.delete.mockResolvedValue(undefined);
    const { ProjectsEditPage } = await import('../src/projects.pages.js');
    render(<ProjectsEditPage />);

    await screen.findByDisplayValue('Brückenbau');
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'actions.moveImageUp' }).at(1) as HTMLElement
    );
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.settings' }));
    expect(screen.getByText('fields.yes')).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'actions.update' }).at(-1) as HTMLElement
    );
    await waitFor(() => expect(state.update).toHaveBeenCalledTimes(1));
    expect(
      state.update.mock.calls[0]?.[1].images.map((image: { altText: string }) => image.altText)
    ).toEqual(['Baustelle', 'Brücke']);

    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    await waitFor(() => expect(state.delete).toHaveBeenCalledWith('project-1', 'user'));
    expect(state.navigate).toHaveBeenCalledWith({ to: '/admin/content' });
  });

  it('renders loading, populated pagination, empty and error list states', async () => {
    let resolveList!: (value: unknown) => void;
    state.list.mockReturnValueOnce(new Promise((resolve) => (resolveList = resolve)));
    const { ProjectsListPage } = await import('../src/projects.pages.js');
    const view = render(<ProjectsListPage />);
    expect(screen.getByText('messages.loading')).toBeTruthy();

    resolveList({ data: [project], pagination: { page: 1, pageSize: 25, hasNextPage: true } });
    await waitFor(() => expect(screen.getAllByText('Brückenbau').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'pagination.next' }));
    expect(state.navigate).toHaveBeenCalled();

    view.unmount();
    state.list.mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    const empty = render(<ProjectsListPage />);
    await screen.findByText('messages.empty');
    empty.unmount();

    state.list.mockRejectedValueOnce(new Error('offline'));
    render(<ProjectsListPage />);
    await screen.findByText('messages.loadError');
  });

  it('exposes the three media entry points and keeps manual images editable', async () => {
    state.listAssets.mockResolvedValue([
      {
        id: 'image-1',
        fileName: 'Bild.jpg',
        mimeType: 'image/jpeg',
        previewUrl: 'https://example.test/a.jpg',
      },
      {
        id: 'pdf-1',
        fileName: 'Datei.pdf',
        mimeType: 'application/pdf',
        previewUrl: 'https://example.test/a.pdf',
      },
    ]);
    const { ProjectsCreatePage } = await import('../src/projects.pages.js');
    render(<ProjectsCreatePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content' }));

    expect(await screen.findByRole('button', { name: 'actions.selectImage' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'actions.uploadImage' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'actions.addImage' }));
    expect(screen.getAllByLabelText('fields.imageUrl')).toHaveLength(1);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'actions.removeImage' })[0] as HTMLElement
    );
    expect(screen.queryAllByLabelText('fields.imageUrl')).toHaveLength(0);
  });

  it('selects a library asset, reviews metadata and adds the linked image', async () => {
    state.create.mockResolvedValue(project);
    state.listAssets.mockResolvedValue([
      {
        id: 'image-1',
        fileName: 'Bild.jpg',
        mimeType: 'image/jpeg',
        visibility: 'public',
        previewUrl: 'https://example.test/preview.jpg',
        metadata: { title: 'Vorschau' },
      },
    ]);
    state.getAsset.mockResolvedValue({
      id: 'image-1',
      fileName: 'Bild.jpg',
      mimeType: 'image/jpeg',
      visibility: 'public',
      previewUrl: 'https://example.test/preview.jpg',
      metadata: {
        title: 'Vorschau',
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
      fileName: 'Bild.jpg',
      mimeType: 'image/jpeg',
      visibility: 'public',
      metadata: {
        title: 'Neue Vorschau',
        altText: 'Alt',
        description: 'Beschreibung',
        copyright: 'Stadt',
        license: 'CC0',
      },
    });
    const { ProjectsCreatePage } = await import('../src/projects.pages.js');
    render(<ProjectsCreatePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.selectImage' }));
    fireEvent.click(await screen.findByRole('button', { name: 'media.select' }));
    await screen.findByDisplayValue('Vorschau');
    fireEvent.change(screen.getByDisplayValue('Vorschau'), { target: { value: 'Neue Vorschau' } });
    fireEvent.click(screen.getByRole('button', { name: 'media.useMedia' }));

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
      storageKey: 'media/upload.jpg',
      mimeType: 'image/jpeg',
      visibility: 'public',
      metadata: {},
    });
    state.updateAsset.mockResolvedValue({
      id: 'uploaded-1',
      storageKey: 'media/upload.jpg',
      mimeType: 'image/jpeg',
      visibility: 'public',
      metadata: {},
    });
    state.getDelivery.mockResolvedValue({
      deliveryUrl: 'https://example.test/upload.jpg',
      isPublicUrl: true,
    });
    const { ProjectsCreatePage } = await import('../src/projects.pages.js');
    render(<ProjectsCreatePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.uploadImage' }));
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: { files: [new File(['image'], 'upload.jpg', { type: 'image/jpeg' })] },
    });
    const useMedia = await screen.findByRole('button', { name: 'media.useMedia' });
    await waitFor(() => expect(useMedia.hasAttribute('disabled')).toBe(false));
    fireEvent.click(useMedia);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getAllByLabelText('fields.imageUrl')).toHaveLength(1);
    expect(state.upload).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'public', mediaType: 'image' })
    );
  });

  it('hides library and upload entry points without media permissions while retaining manual URLs', async () => {
    state.accessSnapshot = {
      isResolved: true,
      assignedModules: ['projects'],
      permissionActions: ['projects.read', 'projects.create', 'projects.update', 'projects.delete'],
      roles: [],
    };
    const { ProjectsCreatePage } = await import('../src/projects.pages.js');
    render(<ProjectsCreatePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content' }));

    expect(screen.queryByRole('button', { name: 'actions.selectImage' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'actions.uploadImage' })).toBeNull();
    expect(screen.getByRole('button', { name: 'actions.addImage' })).toBeTruthy();
  });

  it('loads project content when optional reference access fails', async () => {
    state.params = { id: 'project-1' };
    state.get.mockResolvedValue(project);
    state.listReferences.mockRejectedValueOnce(new Error('forbidden'));
    const { ProjectsEditPage } = await import('../src/projects.pages.js');
    render(<ProjectsEditPage />);
    expect(await screen.findByDisplayValue('Brückenbau')).toBeTruthy();
    expect(screen.queryByText('messages.loadError')).toBeNull();
  });

  it('binds a created project after retrying a partial reference failure', async () => {
    state.listAssets.mockResolvedValue([
      { id: 'image-1', fileName: 'Bild.jpg', mimeType: 'image/jpeg', visibility: 'public' },
    ]);
    state.getAsset.mockResolvedValue({
      id: 'image-1',
      fileName: 'Bild.jpg',
      mimeType: 'image/jpeg',
      visibility: 'public',
      metadata: {},
    });
    state.getDelivery.mockResolvedValue({
      deliveryUrl: 'https://example.test/persistent.jpg',
      isPublicUrl: true,
    });
    state.create.mockResolvedValue(project);
    const retry = vi.fn().mockResolvedValue(undefined);
    state.saveWithReferences.mockImplementationOnce(
      async (input: { saveContent: () => Promise<unknown> }) => ({
        status: 'reference_failed',
        saved: await input.saveContent(),
        retryReferenceSync: retry,
      })
    );
    const { ProjectsCreatePage } = await import('../src/projects.pages.js');
    render(<ProjectsCreatePage />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: 'actions.selectImage' }));
    fireEvent.click(await screen.findByRole('button', { name: 'media.select' }));
    fireEvent.click(await screen.findByRole('button', { name: 'media.useMedia' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.create' }).at(-1)!);
    await screen.findByText('messages.mediaReferencePartialFailure');
    expect(
      screen
        .getAllByRole('button', { name: 'actions.create' })
        .every((button) => button.hasAttribute('disabled'))
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'actions.retryMediaReferences' }));
    await waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: '/admin/projects/$id',
        params: { id: 'project-1' },
      })
    );
    expect(state.create).toHaveBeenCalledTimes(1);
  });

  it('saves canonical ordered references after content and retries only a failed reference sync', async () => {
    state.params = { id: 'project-1' };
    state.get.mockResolvedValue(project);
    state.listReferences.mockResolvedValue([
      { assetId: 'asset-1', role: 'gallery_item', sortOrder: 0 },
      { assetId: 'asset-2', role: 'gallery_item', sortOrder: 1 },
    ]);
    state.update.mockResolvedValue(project);
    const retry = vi.fn().mockResolvedValue(undefined);
    state.saveWithReferences.mockImplementationOnce(
      async (input: { saveContent: () => Promise<unknown> }) => ({
        status: 'reference_failed',
        saved: await input.saveContent(),
        retryReferenceSync: retry,
      })
    );
    const { ProjectsEditPage } = await import('../src/projects.pages.js');
    render(<ProjectsEditPage />);
    await screen.findByDisplayValue('Brückenbau');

    fireEvent.click(
      screen.getAllByRole('button', { name: 'actions.update' }).at(-1) as HTMLElement
    );
    await screen.findByText('messages.mediaReferencePartialFailure');
    expect(state.update).toHaveBeenCalledTimes(1);
    expect(state.saveWithReferences).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'projects.project',
        references: [
          { assetId: 'asset-1', role: 'gallery_item', sortOrder: 0 },
          { assetId: 'asset-2', role: 'gallery_item', sortOrder: 1 },
        ],
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'actions.retryMediaReferences' }));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
    expect(state.update).toHaveBeenCalledTimes(1);
  });

  it('shows load, save, media and delete failures without navigating', async () => {
    state.params = { id: 'project-1' };
    state.get.mockRejectedValueOnce(new Error('offline'));
    const { ProjectsEditPage, ProjectsCreatePage } = await import('../src/projects.pages.js');
    const failedLoad = render(<ProjectsEditPage />);
    await screen.findByText('messages.loadError');
    failedLoad.unmount();

    state.create.mockRejectedValueOnce(new Error('failed'));
    state.listAssets.mockRejectedValueOnce(new Error('media failed'));
    const createView = render(<ProjectsCreatePage />);
    fillRequiredFields();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'actions.create' }).at(-1) as HTMLElement
    );
    await screen.findByText('messages.saveError');
    createView.unmount();

    state.get.mockResolvedValueOnce(project);
    state.delete.mockRejectedValueOnce(new Error('delete failed'));
    render(<ProjectsEditPage />);
    await screen.findByDisplayValue('Brückenbau');
    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    await screen.findByText('messages.deleteError');
    expect(state.navigate).not.toHaveBeenCalled();
  });
});
