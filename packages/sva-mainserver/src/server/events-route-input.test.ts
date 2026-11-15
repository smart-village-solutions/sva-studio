import { eventParticipationSchema as browserSchema } from '@sva/plugin-events';
import { describe, expect, it } from 'vitest';

import { eventParticipationSchema } from './events-route-input.js';

describe('event participation contract', () => {
  it.each([
    {},
    { registrationRequired: true, maximumAttendees: 0 },
    { registrationRequired: false, maximumAttendees: 2_147_483_647 },
    { maximumAttendees: null },
    { maximumAttendees: -1 },
    { maximumAttendees: 2.5 },
    { maximumAttendees: 2_147_483_648 },
    { maximumAttendees: '25' },
    { registrationRequired: 'true' },
  ])('validates %j the same way in the editor and the host', (value) => {
    expect(browserSchema.safeParse(value).success).toBe(
      eventParticipationSchema.safeParse(value).success
    );
  });
});
