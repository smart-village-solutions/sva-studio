import { describe, expect, it } from 'vitest';

import {
  PUBLIC_WASTE_PREFERENCE_COOKIE,
  readPublicWastePreferenceCookie,
  writePublicWastePreferenceCookie,
} from './public-waste-preferences.server.js';

describe('public waste preferences', () => {
  it('writes one stable http-only cookie for the resolved location', () => {
    const header = writePublicWastePreferenceCookie({
      locationKey: 'r-1:c-1:s-1:h-1',
      maxAgeSeconds: 3600,
      sameSite: 'lax',
      secure: true,
    });

    expect(header).toContain(`${PUBLIC_WASTE_PREFERENCE_COOKIE}=r-1%3Ac-1%3As-1%3Ah-1`);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
  });

  it('reads the stored location key from the request cookie header', () => {
    const request = {
      headers: {
        get: (name: string) =>
          name === 'cookie' ? `${PUBLIC_WASTE_PREFERENCE_COOKIE}=r-1%3Ac-1%3As-1%3Ah-1` : null,
      },
    } as Request;

    expect(readPublicWastePreferenceCookie(request)).toBe('r-1:c-1:s-1:h-1');
  });
});
