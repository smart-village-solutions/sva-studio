import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/events.pages.js', () => ({
  EventsCreatePage: () => null,
  EventsEditPage: () => null,
  EventsListPage: () => null,
}));
vi.mock('../src/events.detail-page.js', () => ({ EventsDetailPage: () => null }));
const api = vi.hoisted(() => ({ remove: vi.fn(), read: vi.fn(), update: vi.fn() }));
vi.mock('../src/events.api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteEvent: api.remove,
  getEventDetail: api.read,
  updateEvent: api.update,
}));
import { pluginEvents as browser } from '../src/index.js';
import { pluginEvents as descriptor } from '../src/plugin.js';
const mutations = browser.contentTypes?.[0]?.mutations;
beforeEach(() => vi.resetAllMocks());
describe('events content mutations', () => {
  it('keeps executable capabilities outside the Node descriptor', () => {
    expect(descriptor.contentTypes?.every((definition) => definition.mutations === undefined)).toBe(
      true
    );
    expect(mutations?.delete?.requiredAction).toBe('events.delete');
  });
  it('deletes through the existing client with the resource principal', async () => {
    await mutations?.delete?.execute('item-1', 'organization');
    expect(api.remove).toHaveBeenCalledExactlyOnceWith('item-1', 'organization');
  });
  const current = {
    id: 'item-1',
    title: 'Title',
    description: 'Description',
    externalId: 'external',
    keywords: 'Keywords',
    categoryName: 'Category',
    categories: [{ name: 'Category', payload: { original: true }, children: [] }],
    dates: [{ dateStart: '2026-10-07', timeDescription: 'Noon' }],
    addresses: [{ street: 'Street' }],
    contacts: [{ firstName: 'Name', webUrls: [{ url: 'https://example.org' }] }],
    urls: [{ url: 'https://example.org' }],
    mediaContents: [{ captionText: 'Caption' }],
    organizer: { name: 'Organizer' },
    priceInformations: [{ amount: 10 }],
    accessibilityInformation: { description: 'Accessible' },
    tags: ['tag'],
    pointOfInterestId: 'poi-1',
    repeat: true,
    recurring: 'weekly',
    recurringType: 'week',
    recurringInterval: '2',
    recurringWeekdays: ['1'],
    visible: false,
  };
  it('changes only visible and preserves every other field', async () => {
    api.read.mockResolvedValue({ data: current, deviations: [] });
    await mutations?.status?.execute('item-1', 'published', 'organization');
    expect(api.read).toHaveBeenCalledExactlyOnceWith('item-1', 'organization');
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
  it.each(['dates', 'title', 'tags', 'unknown', 'description'])(
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
  it.each(['visible', 'createdAt', 'updatedAt', 'dataProvider'])(
    'allows deviations without an unrelated write effect: %s',
    async (fieldGroup) => {
      api.read.mockResolvedValue({ data: current, deviations: [{ fieldGroup }] });
      await mutations?.status?.execute('item-1', 'draft', 'user');
      expect(api.update).toHaveBeenCalledExactlyOnceWith(
        'item-1',
        { ...current, visible: false },
        'user'
      );
    }
  );
});
