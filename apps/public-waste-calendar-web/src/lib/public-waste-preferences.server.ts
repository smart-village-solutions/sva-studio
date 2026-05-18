export const PUBLIC_WASTE_PREFERENCE_COOKIE = 'sva_public_waste_location';

const readCookieValue = (cookieHeader: string, name: string): string | null => {
  const cookieName = `${name}=`;
  for (const rawPart of cookieHeader.split(';')) {
    const part = rawPart.trim();
    if (!part.startsWith(cookieName)) {
      continue;
    }

    return decodeURIComponent(part.slice(cookieName.length));
  }

  return null;
};

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
    'HttpOnly',
    `SameSite=${input.sameSite === 'none' ? 'None' : 'Lax'}`,
    ...(input.secure ? ['Secure'] : []),
  ].join('; ');

export const readPublicWastePreferenceCookie = (request: Request): string | null => {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  return readCookieValue(cookieHeader, PUBLIC_WASTE_PREFERENCE_COOKIE);
};
