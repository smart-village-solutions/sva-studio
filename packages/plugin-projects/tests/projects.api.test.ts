import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  ProjectsApiError,
  updateProject,
} from '../src/projects.api.js';
import type { ProjectFormInput } from '../src/projects.api-types.js';

const input: ProjectFormInput = {
  language: 'de',
  title: 'Neues Rathaus',
  description: 'Kurzbeschreibung',
  fullText: '<p>Langtext</p>',
  images: [],
  status: 'draft',
};

describe('projects api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists only the featured-project response contract', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: [], pagination: { page: 2, pageSize: 50, hasNextPage: false } })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(listProjects({ page: 2, pageSize: 50 })).resolves.toEqual({
      data: [],
      pagination: { page: 2, pageSize: 50, hasNextPage: false },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/mainserver/projects?page=2&pageSize=50',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('adds an idempotency key to create requests', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-4111-8111-111111111111'
    );
    const fetchMock = vi.fn(async () => Response.json({ data: { id: 'project-1', ...input } }));
    vi.stubGlobal('fetch', fetchMock);

    await createProject(input, 'organization');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify(input));
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(new Headers(init.headers).get('X-SVA-Acting-Principal-Type')).toBe('organization');
    expect(new Headers(init.headers).get('X-SVA-Mainserver-Contract-Version')).toBe('2');
  });

  it('reads, updates and deletes projects through the shared CRUD contract', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: { id: 'project-1', ...input } }))
      .mockResolvedValueOnce(Response.json({ data: { id: 'project-1', ...input } }))
      .mockResolvedValueOnce(Response.json({ data: null }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getProject('project-1')).resolves.toMatchObject({ id: 'project-1' });
    await expect(updateProject('project-1', input, 'user')).resolves.toMatchObject({
      id: 'project-1',
    });
    await expect(deleteProject('project-1', 'user')).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.map(([, init]) => (init as RequestInit).method)).toEqual([
      undefined,
      'PATCH',
      'DELETE',
    ]);
  });

  it('maps failed responses to the plugin error contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: 'forbidden', message: 'Nicht erlaubt' }, { status: 403 })
      )
    );

    await expect(getProject('project-1')).rejects.toMatchObject<ProjectsApiError>({
      name: 'ProjectsApiError',
      code: 'forbidden',
      message: 'Nicht erlaubt',
    });
  });
});
