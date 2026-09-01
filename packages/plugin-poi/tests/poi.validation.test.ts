import { describe, expect, it } from 'vitest';

import { validatePoiForm } from '../src/poi.validation.js';

describe('validatePoiForm', () => {
  it('accepts a minimal POI', () => {
    expect(validatePoiForm({ name: 'Rathaus' })).toEqual([]);
  });

  it('accepts the concrete Pixelpoint HTTPS image and explicit HTTP media URLs', () => {
    expect(
      validatePoiForm({
        name: 'Rathaus',
        mediaContents: [
          {
            sourceUrl: {
              url: 'https://api.tmb.pixelpoint.biz/api/asset/92919/thumbnail/595/372.jpg',
            },
          },
          { sourceUrl: { url: 'http://example.test/media.jpg' } },
        ],
      })
    ).toEqual([]);
  });

  it('ignores empty optional URL placeholders', () => {
    expect(validatePoiForm({ name: 'Rathaus', webUrls: [{ url: '' }, { url: '   ' }] })).toEqual(
      []
    );
  });

  it('requires a name and https urls', () => {
    expect(validatePoiForm({ name: '', webUrls: [{ url: 'http://example.test' }] })).toEqual([
      'name',
      'webUrls',
    ]);
  });

  it('validates structured geo, price, operator, and contact web url fields', () => {
    expect(
      validatePoiForm({
        name: 'Stadtpark',
        addresses: [{ geoLocation: { latitude: 91, longitude: 13 } }],
        location: { geoLocation: { latitude: 52.5, longitude: 181 } },
        contact: {
          email: 'park@example.test',
          webUrls: [{ url: 'http://example.test/contact' }],
        },
        operatingCompany: {
          name: 'Stadtwerke',
          address: { geoLocation: { latitude: 52.5, longitude: 181 } },
          contact: { webUrls: [{ url: 'http://example.test/operator' }] },
        },
        priceInformations: [{ name: 'Erwachsene', amount: Number.NaN }],
        mediaContents: [{ sourceUrl: { url: 'http://example.test/media.jpg' } }],
      })
    ).toEqual([
      'addresses',
      'location',
      'contact.webUrls',
      'operatingCompany.address',
      'operatingCompany.contact.webUrls',
      'priceInformations',
    ]);
  });

  it('rejects invalid category names', () => {
    expect(
      validatePoiForm({ name: 'Rathaus', categories: [{ name: '' }, { name: 'x'.repeat(129) }] })
    ).toEqual(['categories']);
  });
});
