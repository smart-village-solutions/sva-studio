import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/generic-items.pages.js', () => ({
  GenericItemsCreatePage: () => null,
  GenericItemsEditPage: () => null,
  GenericItemsListPage: () => null,
}));
const api = vi.hoisted(() => ({ remove: vi.fn(), read: vi.fn(), update: vi.fn() }));
vi.mock('../src/generic-items.api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteGenericItem: api.remove,
  getGenericItem: api.read,
  updateGenericItem: api.update,
}));
import { pluginGenericItems as browser } from '../src/index.js';
import { pluginGenericItems as descriptor } from '../src/plugin.js';
const mutations = browser.contentTypes?.[0]?.mutations;
beforeEach(() => vi.resetAllMocks());
describe('generic-items content mutations', () => {
  it('keeps executable capabilities outside the Node descriptor', () => {
    expect(descriptor.contentTypes?.every((definition) => definition.mutations === undefined)).toBe(
      true
    );
    expect(mutations?.delete?.requiredAction).toBe('generic-items.delete');
  });
  it('deletes through the existing client with the resource principal', async () => {
    await mutations?.delete?.execute('item-1', 'organization');
    expect(api.remove).toHaveBeenCalledExactlyOnceWith('item-1', 'organization');
  });
  const current = {
    id: 'item-1',
    title: 'Title',
    description: 'Description',
    genericType: 'custom',
    author: 'Author',
    keywords: 'Keywords',
    externalId: 'External',
    publicationDate: '2026-10-07',
    publishedAt: '2026-10-07T12:00:00Z',
    categoryName: 'Category',
    contacts: [{ phone: 'Phone' }],
    webUrls: [{ url: 'https://example.org' }],
    addresses: [{ street: 'Street' }],
    contentBlocks: [{ title: 'Block' }],
    openingHours: [{ weekday: 'Monday' }],
    mediaContents: [{ captionText: 'Caption' }],
    locations: [{ latitude: 1, longitude: 2 }],
    dates: [{ dateStart: '2026-10-07' }],
    accessibilityInformations: [{ description: 'Accessible' }],
    priceInformations: [{ amount: 10 }],
    payload: { original: true },
    categories: [{ name: 'Category' }],
    tags: ['tag'],
    visible: false,
  };
  it('changes only visible and preserves every other field', async () => {
    api.read.mockResolvedValue(current);
    await mutations?.status?.execute('item-1', 'published', 'organization');
    expect(api.read).toHaveBeenCalledExactlyOnceWith('item-1');
    expect(api.update).toHaveBeenCalledExactlyOnceWith(
      'item-1',
      { ...current, visible: true },
      'organization'
    );
  });
  it('does not write after a failed read', async () => {
    api.read.mockRejectedValue(new Error('read_failed'));
    await expect(mutations?.status?.execute('item-1', 'published', 'user')).rejects.toThrow(
      'read_failed'
    );
    expect(api.update).not.toHaveBeenCalled();
  });
});
