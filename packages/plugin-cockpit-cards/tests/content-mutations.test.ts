import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/cockpit-cards.pages.js', () => ({
  CockpitCardsCreatePage: () => null,
  CockpitCardsEditPage: () => null,
  CockpitCardsListPage: () => null,
}));
const api = vi.hoisted(() => ({ remove: vi.fn(), read: vi.fn(), update: vi.fn() }));
vi.mock('../src/cockpit-cards.api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteCockpitCard: api.remove,
}));
import { pluginCockpitCards as browser } from '../src/index.js';
import { pluginCockpitCards as descriptor } from '../src/plugin.js';
const mutations = browser.contentTypes?.[0]?.mutations;
beforeEach(() => vi.resetAllMocks());
describe('cockpit-cards content mutations', () => {
  it('keeps executable capabilities outside the Node descriptor', () => {
    expect(descriptor.contentTypes?.every((definition) => definition.mutations === undefined)).toBe(
      true
    );
    expect(mutations?.delete?.requiredAction).toBe('cockpit-cards.delete');
  });
  it('deletes through the existing client with the resource principal', async () => {
    await mutations?.delete?.execute('item-1', 'organization');
    expect(api.remove).toHaveBeenCalledExactlyOnceWith('item-1', 'organization');
  });
});
