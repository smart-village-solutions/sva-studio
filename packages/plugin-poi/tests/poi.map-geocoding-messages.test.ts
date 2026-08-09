import { describe, expect, it } from 'vitest';

import { resolvePoiMapGeocodingMessageKey } from '../src/poi.map-geocoding-messages.js';

describe('resolvePoiMapGeocodingMessageKey', () => {
  it('maps mainserver timeouts to the dedicated timeout message', () => {
    expect(resolvePoiMapGeocodingMessageKey(new Error('mainserver_timeout'))).toBe(
      'messages.locationGeocodeTimeout',
    );
  });

  it.each([
    [{ code: 'disabled' }, 'messages.locationGeocodeDisabled'],
    [{ code: 'invalid_config' }, 'messages.locationGeocodeDisabled'],
    [{ code: 'no_result' }, 'messages.locationGeocodeEmpty'],
    [{ code: 'rate_limited' }, 'messages.locationGeocodeRateLimited'],
    [{ code: 'timeout' }, 'messages.locationGeocodeTimeout'],
    [{ code: 'forbidden' }, 'messages.locationGeocodeForbidden'],
    [{ code: 'unauthorized' }, 'messages.locationGeocodeUnauthorized'],
    [{ code: 403 }, 'messages.locationGeocodeError'],
    ['unexpected', 'messages.locationGeocodeError'],
  ] as const)('maps %j to %s', (error, expected) => {
    expect(resolvePoiMapGeocodingMessageKey(error)).toBe(expected);
  });
});
