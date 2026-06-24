import { describe, expect, it } from 'vitest';

import { resolveEventsMapGeocodingMessageKey } from '../src/events.map-geocoding-messages.js';

describe('resolveEventsMapGeocodingMessageKey', () => {
  it('maps mainserver timeouts to the dedicated timeout message', () => {
    expect(resolveEventsMapGeocodingMessageKey(new Error('mainserver_timeout'))).toBe(
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
    expect(resolveEventsMapGeocodingMessageKey(error)).toBe(expected);
  });
});
