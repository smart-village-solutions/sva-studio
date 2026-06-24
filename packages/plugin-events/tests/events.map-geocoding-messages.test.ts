import { describe, expect, it } from 'vitest';

import { resolveEventsMapGeocodingMessageKey } from '../src/events.map-geocoding-messages.js';

describe('resolveEventsMapGeocodingMessageKey', () => {
  it('maps mainserver timeouts to the dedicated timeout message', () => {
    expect(resolveEventsMapGeocodingMessageKey(new Error('mainserver_timeout'))).toBe(
      'messages.locationGeocodeTimeout',
    );
  });
});
