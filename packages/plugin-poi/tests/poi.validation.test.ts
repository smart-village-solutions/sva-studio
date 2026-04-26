import { describe, expect, it } from 'vitest';

import { validatePoiForm } from '../src/poi.validation.js';

describe('validatePoiForm', () => {
  it('accepts a minimal POI', () => {
    expect(validatePoiForm({ name: 'Rathaus' })).toEqual([]);
  });

  it('requires a name and https urls', () => {
    expect(validatePoiForm({ name: '', webUrls: [{ url: 'http://example.test' }] })).toEqual(['name', 'webUrls']);
  });
});
