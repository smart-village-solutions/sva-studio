import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/poi.pages.js', () => ({
  PoiCreatePage: () => null,
  PoiEditPage: () => null,
  PoiListPage: () => null,
}));
vi.mock('../src/poi.detail-page.js', () => ({ PoiDetailPage: () => null }));
const api = vi.hoisted(() => ({ remove: vi.fn(), read: vi.fn(), update: vi.fn(), visibility: vi.fn() }));
vi.mock('../src/poi.api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deletePoi: api.remove,
  getPoiDetail: api.read,
  updatePoi: api.update,
  setPoiVisibility: api.visibility,
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
  it.each([['published', true], ['draft', false]] as const)(
    'changes %s through the visibility client without reading or rewriting content',
    async (status, visible) => {
      await mutations?.status?.execute('item-1', status, 'organization');
      expect(api.visibility).toHaveBeenCalledExactlyOnceWith('item-1', visible, 'organization');
      expect(api.read).not.toHaveBeenCalled();
      expect(api.update).not.toHaveBeenCalled();
    }
  );
  it('propagates visibility failures to the host dialog', async () => {
    api.visibility.mockRejectedValue(new Error('visibility_failed'));
    await expect(mutations?.status?.execute('item-1', 'published', 'user')).rejects.toThrow('visibility_failed');
  });
});
