import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/news.pages.js', () => ({
  NewsCreatePage: () => null,
  NewsEditPage: () => null,
  NewsListPage: () => null,
}));
vi.mock('../src/news.detail-page.js', () => ({ NewsDetailPage: () => null }));
const api = vi.hoisted(() => ({ remove: vi.fn(), read: vi.fn(), update: vi.fn() }));
vi.mock('../src/news.api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteNews: api.remove,
  getNews: api.read,
  setNewsVisibility: api.update,
}));
import { pluginNews as browser } from '../src/index.js';
import { pluginNews as descriptor } from '../src/plugin.js';
const mutations = browser.contentTypes?.[0]?.mutations;
beforeEach(() => vi.resetAllMocks());
describe('news content mutations', () => {
  it('keeps executable capabilities outside the Node descriptor', () => {
    expect(descriptor.contentTypes?.every((definition) => definition.mutations === undefined)).toBe(
      true
    );
    expect(mutations?.delete?.requiredAction).toBe('news.delete');
  });
  it('deletes through the existing client with the resource principal', async () => {
    await mutations?.delete?.execute('item-1', 'organization');
    expect(api.remove).toHaveBeenCalledExactlyOnceWith('item-1', 'organization');
  });
  it.each(['draft', 'published'] as const)(
    'uses the dedicated visibility API for %s',
    async (status) => {
      await mutations?.status?.execute('item-1', status, 'organization');
      expect(api.read).toHaveBeenCalledExactlyOnceWith('item-1');
      expect(api.update).toHaveBeenCalledExactlyOnceWith(
        'item-1',
        status === 'published',
        'organization'
      );
    }
  );
});
