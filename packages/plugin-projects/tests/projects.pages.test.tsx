import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectsCreatePage, ProjectsEditPage, ProjectsListPage } from '../src/projects.pages.js';

const state = vi.hoisted(() => ({
  ProjectsApiError: class ProjectsApiError extends Error {
    public constructor(
      public readonly code: string,
      message = code
    ) {
      super(message);
      this.name = 'ProjectsApiError';
    }
  },
  create: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  getDetail: vi.fn(),
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
    unscopedPermissionActions: [
      'projects.read',
      'projects.create',
      'projects.update',
      'projects.delete',
    ],
    roles: [],
  },
}));

vi.mock('../src/projects.api.js', () => ({
  ProjectsApiError: state.ProjectsApiError,
  createProject: state.create,
  deleteProject: state.delete,
  getProject: state.get,
  getProjectDetail: state.getDetail,
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
  useLocation: () => ({ state: {} }),
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
    state.create.mockResolvedValue(project);
    state.getDetail.mockImplementation(async (...args: unknown[]) => ({
      data: await state.get(...args),
      deviations: [],
      access: {},
    }));
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
      unscopedPermissionActions: [
        'projects.read',
        'projects.create',
        'projects.update',
        'projects.delete',
      ],
      roles: [],
    };
  });

  it('renders the domain and history tabs and creates a normalized project', async () => {
    render(<ProjectsCreatePage />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'tabs.basis',
      'tabs.content',
      'tabs.settings',
      'tabs.history',
    ]);
    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: 'media.add' }));
    fireEvent.click(screen.getByRole('button', { name: 'media.addByLink' }));
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
    render(<ProjectsCreatePage />);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'actions.create' }).at(-1) as HTMLElement
    );
    await waitFor(() =>
      expect(screen.getByLabelText('fields.title').getAttribute('aria-invalid')).toBe('true')
    );
  });

  it('shows the server reason for a typed project API save failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    state.create.mockRejectedValueOnce(
      new state.ProjectsApiError(
        'organization_mainserver_credentials_missing',
        'Für die aktive Organisation fehlen Mainserver-Credentials.'
      )
    );
    render(<ProjectsCreatePage />);
    fillRequiredFields();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'actions.create' }).at(-1) as HTMLElement
    );

    await screen.findByText('messages.saveErrorWithReason');
  });

  it('loads, reorders, updates and soft-deletes an existing project', async () => {
    state.params = { id: 'project-1' };
    state.get.mockResolvedValue(project);
    state.update.mockResolvedValue(project);
    state.delete.mockResolvedValue(undefined);
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
    expect(state.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/admin/content', state: expect.any(Function) })
    );
  });

  it('renders loading, populated pagination, empty and error list states', async () => {
    let resolveList!: (value: unknown) => void;
    state.list.mockReturnValueOnce(new Promise((resolve) => (resolveList = resolve)));
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

  it('opens the three media choices from one add action and keeps manual images editable', async () => {
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
    render(<ProjectsCreatePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content' }));

    const addMedia = await screen.findByRole('button', { name: 'media.add' });
    expect(screen.queryByRole('button', { name: 'actions.selectImage' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'actions.uploadImage' })).toBeNull();
    fireEvent.click(addMedia);
    expect(screen.getByRole('button', { name: 'media.upload' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'media.addFromLibrary' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'media.addByLink' }));
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
    render(<ProjectsCreatePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content' }));
    fireEvent.click(screen.getByRole('button', { name: 'media.add' }));
    fireEvent.click(screen.getByRole('button', { name: 'media.addFromLibrary' }));
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

  it('accepts a supported image locally without uploading it', async () => {
    render(<ProjectsCreatePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content' }));
    fireEvent.click(screen.getByRole('button', { name: 'media.add' }));
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: { files: [new File(['image'], 'upload.jpg', { type: 'image/jpeg' })] },
    });
    const useMedia = await screen.findByRole('button', { name: 'media.useMedia' });
    await waitFor(() => expect(useMedia.hasAttribute('disabled')).toBe(false));
    fireEvent.click(useMedia);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.querySelector<HTMLImageElement>('article img')?.src).toMatch(/^blob:/);
    expect((screen.getByLabelText('fields.imageUrl') as HTMLInputElement).value).toBe('');
    expect(state.upload).not.toHaveBeenCalled();
    expect(state.getAsset).not.toHaveBeenCalled();
  });

  it('hides library and upload entry points without media permissions while retaining manual URLs', async () => {
    state.accessSnapshot = {
      isResolved: true,
      assignedModules: ['projects'],
      permissionActions: ['projects.read', 'projects.create', 'projects.update', 'projects.delete'],
      unscopedPermissionActions: [
        'projects.read',
        'projects.create',
        'projects.update',
        'projects.delete',
      ],
      roles: [],
    };
    render(<ProjectsCreatePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.content' }));

    expect(screen.queryByRole('button', { name: 'actions.selectImage' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'actions.uploadImage' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'media.add' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(screen.getAllByLabelText('fields.imageUrl')).toHaveLength(1));
  });

  it('loads project content when optional reference access fails', async () => {
    state.params = { id: 'project-1' };
    state.get.mockResolvedValue(project);
    state.listReferences.mockRejectedValueOnce(new Error('forbidden'));
    render(<ProjectsEditPage />);
    expect(await screen.findByDisplayValue('Brückenbau')).toBeTruthy();
    expect(screen.queryByText('messages.loadError')).toBeNull();
  });

  it('reloads scoped resource access when the acting principal changes and fails closed', async () => {
    state.params = { id: 'project-1' };
    state.get.mockResolvedValue(project);
    state.accessSnapshot = {
      isResolved: true,
      assignedModules: ['projects'],
      permissionActions: ['projects.read', 'projects.update'],
      unscopedPermissionActions: ['projects.read'],
      roles: [],
    };
    const { rerender } = render(
      <ProjectsEditPage principalControl={{ kind: 'fixed', value: 'user', label: 'Persönlich' }} />
    );

    expect(await screen.findByDisplayValue('Brückenbau')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'actions.update' })).toBeNull();

    state.getDetail.mockResolvedValueOnce({
      data: project,
      deviations: [],
      access: { 'projects.update': true },
    });
    rerender(
      <ProjectsEditPage
        principalControl={{ kind: 'fixed', value: 'organization', label: 'Stadt' }}
      />
    );
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'actions.update' })).toHaveLength(2);
    });

    state.getDetail.mockRejectedValueOnce(new Error('forbidden'));
    rerender(
      <ProjectsEditPage principalControl={{ kind: 'fixed', value: 'user', label: 'Persönlich' }} />
    );
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'actions.update' })).toBeNull();
    });
    expect(state.getDetail).toHaveBeenNthCalledWith(1, 'project-1', 'user');
    expect(state.getDetail).toHaveBeenNthCalledWith(2, 'project-1', 'organization');
    expect(state.getDetail).toHaveBeenNthCalledWith(3, 'project-1', 'user');
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
    render(<ProjectsCreatePage />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: 'media.add' }));
    fireEvent.click(screen.getByRole('button', { name: 'media.addFromLibrary' }));
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
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    state.params = { id: 'project-1' };
    state.get.mockRejectedValueOnce(new Error('offline'));
    const failedLoad = render(<ProjectsEditPage />);
    await screen.findByText('messages.loadError');
    failedLoad.unmount();

    const saveFailure = new Error('failed before fetch');
    state.create.mockRejectedValueOnce(saveFailure);
    state.listAssets.mockRejectedValueOnce(new Error('media failed'));
    const createView = render(<ProjectsCreatePage />);
    fillRequiredFields();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'actions.create' }).at(-1) as HTMLElement
    );
    await screen.findByText('messages.saveError');
    expect(consoleError).toHaveBeenCalledWith('Project save failed', saveFailure);
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
