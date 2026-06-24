import { describe, expect, it } from 'vitest';

import { resolvePoiMapGeocodingMessageKey } from '../src/poi.map-geocoding-messages.js';

describe('resolvePoiMapGeocodingMessageKey', () => {
  it('maps mainserver timeouts to the dedicated timeout message', () => {
    expect(resolvePoiMapGeocodingMessageKey(new Error('mainserver_timeout'))).toBe(
      'messages.locationGeocodeTimeout',
    );
  });
});
