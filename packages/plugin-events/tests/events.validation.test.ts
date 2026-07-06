import { describe, expect, it } from 'vitest';

import { validateEventForm } from '../src/events.validation.js';

describe('validateEventForm', () => {
  it('accepts a minimal event', () => {
    expect(validateEventForm({ title: 'Stadtfest' })).toEqual([]);
  });

  it('ignores empty optional URL placeholders', () => {
    expect(validateEventForm({ title: 'Stadtfest', urls: [{ url: '' }, { url: '   ' }] })).toEqual([]);
  });

  it('requires a title and https urls', () => {
    expect(validateEventForm({ title: '', urls: [{ url: 'http://example.test' }] })).toEqual(['title', 'urls']);
  });

  it('rejects non-date-only event date values', () => {
    expect(
      validateEventForm({
        title: 'Stadtfest',
        dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }, { dateEnd: '2026-13-40' }],
      })
    ).toEqual(['dates']);
  });

  it('rejects invalid nested contact urls and non-finite prices', () => {
    expect(
      validateEventForm({
        title: 'Stadtfest',
        contacts: [{ webUrls: [{ url: 'http://example.test/contact' }] }],
        priceInformations: [{ amount: Number.NaN }],
      })
    ).toEqual(['urls', 'priceInformations']);
  });

  it('rejects invalid category names', () => {
    expect(
      validateEventForm({
        title: 'Stadtfest',
        categories: [{ name: '' }, { name: 'x'.repeat(129) }],
      })
    ).toEqual(['categories']);
  });

  it('rejects invalid geo coordinates for event venues and organizer addresses', () => {
    expect(
      validateEventForm({
        title: 'Stadtfest',
        addresses: [{ geoLocation: { latitude: 91, longitude: 7.2 } }],
        organizer: {
          address: { geoLocation: { latitude: 51.4, longitude: 181 } },
        },
      })
    ).toEqual(['geoLocation']);
  });
});
