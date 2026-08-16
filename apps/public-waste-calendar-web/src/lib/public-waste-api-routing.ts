export type PublicWasteReadApiRoute = 'locations' | 'selection' | 'calendar' | 'pdf' | 'ical';

const PUBLIC_WASTE_LOCATIONS_PATH = '/api/public-waste/locations';
const publicWasteReadApiPrefixes = [
  ['selection', '/api/public-waste/selection'],
  ['calendar', '/api/public-waste/calendar'],
  ['pdf', '/api/public-waste/pdf'],
  ['ical', '/api/public-waste/ical'],
] as const satisfies readonly (readonly [PublicWasteReadApiRoute, string])[];

export const resolvePublicWasteReadApiRoute = (
  pathname: string
): PublicWasteReadApiRoute | null => {
  if (pathname === PUBLIC_WASTE_LOCATIONS_PATH) {
    return 'locations';
  }

  return publicWasteReadApiPrefixes.find(([, prefix]) => pathname.startsWith(prefix))?.[0] ?? null;
};
