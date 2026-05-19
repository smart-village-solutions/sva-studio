import {
  PUBLIC_WASTE_PREFERENCE_COOKIE,
  readPublicWasteCookieValue,
} from './public-waste-preferences.shared.js';

export { PUBLIC_WASTE_PREFERENCE_COOKIE } from './public-waste-preferences.shared.js';

export const writePublicWastePreferenceCookie = (input: {
  readonly locationKey: string;
  readonly maxAgeSeconds: number;
  readonly sameSite: 'lax' | 'none';
  readonly secure: boolean;
}): string =>
  [
    `${PUBLIC_WASTE_PREFERENCE_COOKIE}=${encodeURIComponent(input.locationKey)}`,
    'Path=/',
    `Max-Age=${input.maxAgeSeconds}`,
    `SameSite=${input.sameSite === 'none' ? 'None' : 'Lax'}`,
    ...(input.secure ? ['Secure'] : []),
  ].join('; ');

export const readPublicWastePreferenceCookie = (request: Request): string | null => {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  return readPublicWasteCookieValue(cookieHeader, PUBLIC_WASTE_PREFERENCE_COOKIE);
};
