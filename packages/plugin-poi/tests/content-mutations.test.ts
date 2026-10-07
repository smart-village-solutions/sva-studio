import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/poi.pages.js', () => ({
  PoiCreatePage: () => null,
  PoiEditPage: () => null,
  PoiListPage: () => null,
}));
vi.mock('../src/poi.detail-page.js', () => ({ PoiDetailPage: () => null }));
const api = vi.hoisted(() => ({ remove: vi.fn(), read: vi.fn(), update: vi.fn() }));
vi.mock('../src/poi.api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deletePoi: api.remove,
  getPoiDetail: api.read,
  updatePoi: api.update,
}));
import { pluginPoi as browser } from '../src/index.js';
import { pluginPoi as descriptor } from '../src/plugin.js';
const mutations = browser.contentTypes?.[0]?.mutations;
beforeEach(() => vi.resetAllMocks());
describe('poi content mutations', () => {
  it('keeps executable capabilities outside the Node descriptor', () => {
    expect(descriptor.contentTypes?.every((definition) => definition.mutations === undefined)).toBe(
      true
    );
    expect(mutations?.delete?.requiredAction).toBe('poi.delete');
  });
  it('deletes through the existing client with the resource principal', async () => {
    await mutations?.delete?.execute('item-1', 'organization');
    expect(api.remove).toHaveBeenCalledExactlyOnceWith('item-1', 'organization');
  });
  const current = {
    id: 'item-1',
    name: 'Name',
    description: 'Description',
    mobileDescription: 'Mobile',
    active: false,
    externalId: 'external',
    keywords: 'Keywords',
    categoryName: 'Category',
    categories: [{ name: 'Category', children: [], payload: { original: true } }],
    payload: { original: true },
    addresses: [{ street: 'Street' }],
    contact: { phone: 'Phone' },
    location: { latitude: 1, longitude: 2 },
    openingHours: [{ weekday: 'Monday' }],
    operatingCompany: { name: 'Company' },
    priceInformations: [{ amount: 10 }],
    webUrls: [{ url: 'https://example.org' }],
    mediaContents: [{ captionText: 'Caption' }],
    certificates: [{ name: 'Certificate' }],
    accessibilityInformation: { description: 'Accessible' },
    tags: ['tag'],
    visible: true,
  };
  it('changes only active and preserves every other field', async () => {
    api.read.mockResolvedValue({ data: current, deviations: [] });
    await mutations?.status?.execute('item-1', 'published', 'organization');
    expect(api.read).toHaveBeenCalledExactlyOnceWith('item-1', 'organization');
    expect(api.update).toHaveBeenCalledExactlyOnceWith(
      'item-1',
      { ...current, active: true },
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
  it.each(['categories', 'name', 'tags', 'unknown', 'mobileDescription'])(
    'rejects degraded %s even after a successful read',
    async (fieldGroup) => {
      api.read.mockResolvedValue({
        data: current,
        deviations: [{ fieldGroup, fieldPath: fieldGroup + '[]', handling: 'omitted' }],
      });
      await expect(mutations?.status?.execute('item-1', 'published', 'user')).rejects.toThrow(
        'content_status_detail_degraded'
      );
      expect(api.update).not.toHaveBeenCalled();
    }
  );
  it.each(['active', 'createdAt', 'updatedAt', 'dataProvider', 'visible'])(
    'allows deviations without an unrelated write effect: %s',
    async (fieldGroup) => {
      api.read.mockResolvedValue({ data: current, deviations: [{ fieldGroup }] });
      await mutations?.status?.execute('item-1', 'draft', 'user');
      expect(api.update).toHaveBeenCalledExactlyOnceWith(
        'item-1',
        { ...current, active: false },
        'user'
      );
    }
  );
});
