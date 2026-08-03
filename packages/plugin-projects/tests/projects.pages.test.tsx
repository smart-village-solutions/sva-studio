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
  navigate: vi.fn(),
  params: {} as { id?: string; contentId?: string },
  search: { page: 1, pageSize: 25 },
}));

vi.mock('../src/projects.api.js', () => ({
  createProject: state.create,
  deleteProject: state.delete,
  getProject: state.get,
  listProjects: state.list,
  updateProject: state.update,
}));
vi.mock('@sva/plugin-sdk', () => ({
  listHostMediaAssets: state.listAssets,
  uploadHostMediaFile: state.upload,
  usePluginTranslation: () => (key: string) => key,
}));
vi.mock('@sva/studio-ui-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/studio-ui-react')>();
  return {
    ...actual,
    RichTextHtmlEditor: ({
      id,
      labelId,
      onChange,
      value,
    }: {
      id: string;
      labelId: string;
      onChange: (value: string) => void;
      value: string;
    }) => (
      <textarea
        id={id}
        aria-labelledby={labelId}
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
  fireEvent.change(screen.getByLabelText('fields.language'), { target: { value: 'de-x-kommunal' } });
  fireEvent.change(screen.getByLabelText('fields.title'), { target: { value: 'Neues Projekt' } });
  fireEvent.change(screen.getByLabelText('fields.description'), { target: { value: 'Kurztext' } });
  fireEvent.click(screen.getByRole('tab', { name: 'tabs.content' }));
  fireEvent.change(screen.getByLabelText('fields.fullText'), { target: { value: '<p>Inhalt</p>' } });
};

describe('projects pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.params = {};
    state.listAssets.mockResolvedValue([]);
  });

  it('renders exactly the three domain tabs and creates a normalized project', async () => {
    state.create.mockResolvedValue(project);
    const { ProjectsCreatePage } = await import('../src/projects.pages.js');
    render(<ProjectsCreatePage />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'tabs.basis',
      'tabs.content',
      'tabs.settings',
    ]);
    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: 'actions.addImage' }));
    fireEvent.change(screen.getByLabelText('fields.imageUrl'), {
      target: { value: 'https://example.test/project.jpg' },
    });
    fireEvent.change(screen.getByLabelText('fields.altText'), { target: { value: 'Projektbild' } });
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.settings' }));
    fireEvent.change(screen.getByLabelText('fields.authorId'), { target: { value: 'org-1' } });
    fireEvent.change(screen.getByLabelText('fields.authorName'), { target: { value: 'Stadt' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.create' }).at(-1) as HTMLElement);

    await waitFor(() => expect(state.create).toHaveBeenCalledTimes(1));
    expect(state.create.mock.calls[0]?.[0]).toMatchObject({
      language: 'de-x-kommunal',
      title: 'Neues Projekt',
      description: 'Kurztext',
      fullText: '<p>Inhalt</p>',
      images: [{ url: 'https://example.test/project.jpg', altText: 'Projektbild', position: 0 }],
      author: { type: 'organization', id: 'org-1', displayName: 'Stadt' },
    });
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
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.moveImageUp' }).at(1) as HTMLElement);
    fireEvent.click(screen.getByRole('tab', { name: 'tabs.settings' }));
    expect(screen.getByText('fields.yes')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'actions.update' }).at(-1) as HTMLElement);
    await waitFor(() => expect(state.update).toHaveBeenCalledTimes(1));
    expect(state.update.mock.calls[0]?.[1].images.map((image: { altText: string }) => image.altText)).toEqual([
      'Baustelle',
      'Brücke',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    await waitFor(() => expect(state.delete).toHaveBeenCalledWith('project-1'));
    expect(state.navigate).toHaveBeenCalledWith({ to: '/admin/content' });
  });
});
