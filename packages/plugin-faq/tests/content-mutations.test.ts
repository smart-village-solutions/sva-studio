import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/faq.pages.js', () => ({
  FaqCreatePage: () => null,
  FaqEditPage: () => null,
  FaqListPage: () => null,
}));
const api = vi.hoisted(() => ({ remove: vi.fn(), read: vi.fn(), update: vi.fn() }));
vi.mock('../src/faq.api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteFaq: api.remove,
}));
import { pluginFaq as browser } from '../src/index.js';
import { pluginFaq as descriptor } from '../src/plugin.js';
const mutations = browser.contentTypes?.[0]?.mutations;
beforeEach(() => vi.resetAllMocks());
describe('faq content mutations', () => {
  it('keeps executable capabilities outside the Node descriptor', () => {
    expect(descriptor.contentTypes?.every((definition) => definition.mutations === undefined)).toBe(
      true
    );
    expect(mutations?.delete?.requiredAction).toBe('faq.delete');
  });
  it('deletes through the existing client with the resource principal', async () => {
    await mutations?.delete?.execute('item-1', 'organization');
    expect(api.remove).toHaveBeenCalledExactlyOnceWith('item-1', 'organization');
  });
});
