import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/projects.pages.js', () => ({
  ProjectsCreatePage: () => null,
  ProjectsEditPage: () => null,
  ProjectsListPage: () => null,
}));
const api = vi.hoisted(() => ({ remove: vi.fn(), read: vi.fn(), update: vi.fn() }));
vi.mock('../src/projects.api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteProject: api.remove,
}));
import { pluginProjects as browser } from '../src/index.js';
import { pluginProjects as descriptor } from '../src/plugin.js';
const mutations = browser.contentTypes?.[0]?.mutations;
beforeEach(() => vi.resetAllMocks());
describe('projects content mutations', () => {
  it('keeps executable capabilities outside the Node descriptor', () => {
    expect(descriptor.contentTypes?.every((definition) => definition.mutations === undefined)).toBe(
      true
    );
    expect(mutations?.delete?.requiredAction).toBe('projects.delete');
  });
  it('deletes through the existing client with the resource principal', async () => {
    await mutations?.delete?.execute('item-1', 'organization');
    expect(api.remove).toHaveBeenCalledExactlyOnceWith('item-1', 'organization');
  });
});
