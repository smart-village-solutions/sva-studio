export const PUBLIC_WASTE_PREFERENCE_COOKIE = 'sva_public_waste_location';
export const PUBLIC_WASTE_PREFERENCE_MAX_AGE_SECONDS = 31_536_000;
export const PUBLIC_WASTE_PREFERENCE_SAME_SITE = 'Lax';

export const readPublicWasteCookieValue = (cookieHeader: string, name: string): string | null => {
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

export const serializePublicWastePreferenceCookie = (input: {
  readonly locationKey: string;
  readonly maxAgeSeconds?: number;
}): string =>
  [
    `${PUBLIC_WASTE_PREFERENCE_COOKIE}=${encodeURIComponent(input.locationKey)}`,
    'Path=/',
    `Max-Age=${input.maxAgeSeconds ?? PUBLIC_WASTE_PREFERENCE_MAX_AGE_SECONDS}`,
    `SameSite=${PUBLIC_WASTE_PREFERENCE_SAME_SITE}`,
  ].join('; ');

export const serializeClearedPublicWastePreferenceCookie = (): string =>
  [`${PUBLIC_WASTE_PREFERENCE_COOKIE}=`, 'Path=/', 'Max-Age=0', `SameSite=${PUBLIC_WASTE_PREFERENCE_SAME_SITE}`].join(
    '; '
  );
