import { afterEach, describe, expect, it, vi } from 'vitest';

import { createProject, listProjects } from '../src/projects.api.js';
import type { ProjectFormInput } from '../src/projects.api-types.js';

const input: ProjectFormInput = {
  language: 'de',
  title: 'Neues Rathaus',
  description: 'Kurzbeschreibung',
  fullText: '<p>Langtext</p>',
  images: [],
  status: 'draft',
  author: { type: 'organization', id: 'org-1', displayName: 'Gemeinde' },
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
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    const fetchMock = vi.fn(async () => Response.json({ data: { id: 'project-1', ...input } }));
    vi.stubGlobal('fetch', fetchMock);

    await createProject(input);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify(input));
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
  });
});
