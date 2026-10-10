import {
  buildPublicWasteLocationKey,
  isPublicWasteUuid,
  parsePublicWasteLocationKey,
} from '../lib/public-waste-contract.js';
import type { PublicWasteResolvedSelection } from '../lib/public-waste-contract.js';
import {
  PUBLIC_WASTE_PREFERENCE_COOKIE,
  readPublicWasteCookieValue,
  serializePublicWastePreferenceCookie,
} from '../lib/public-waste-preferences.shared.js';
import { requestPublicWasteRegions } from '../lib/public-waste-regions-api.js';
import { normalizePublicWasteRegionSlug } from '../lib/public-waste-region-slug.js';

export const BOUND_REGION_UNAVAILABLE_ERROR = 'public_waste_bound_region_unavailable';

export type PublicWasteRegionBinding =
  | { readonly status: 'unbound' }
  | { readonly status: 'invalid' }
  | { readonly status: 'bound'; readonly regionId: string }
  | { readonly status: 'slug'; readonly regionSlug: string };

export const readPublicWasteRegionBinding = (
  search: string,
  pathname = '/'
): PublicWasteRegionBinding => {
  const values = new URLSearchParams(search).getAll('regionId');
  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments.length > 1 || (pathSegments.length === 1 && values.length > 0)) {
    return { status: 'invalid' };
  }
  if (pathSegments.length === 1) {
    try {
      const regionSlug = normalizePublicWasteRegionSlug(decodeURIComponent(pathSegments[0] ?? ''));
      return regionSlug ? { status: 'slug', regionSlug } : { status: 'invalid' };
    } catch {
      return { status: 'invalid' };
    }
  }
  if (values.length === 0) {
    return { status: 'unbound' };
  }

  const regionId = values[0]?.trim();
  if (values.length !== 1 || !regionId || !isPublicWasteUuid(regionId)) {
    return { status: 'invalid' };
  }

  return { status: 'bound', regionId: regionId.toLowerCase() };
};

export const resolveBoundRegionId = async (
  binding: PublicWasteRegionBinding,
  apiOrigin = ''
): Promise<string | undefined> => {
  if (binding.status === 'unbound') {
    return undefined;
  }
  if (binding.status === 'bound') {
    return binding.regionId;
  }
  if (binding.status === 'invalid') {
    throw new Error(BOUND_REGION_UNAVAILABLE_ERROR);
  }

  const regions = await requestPublicWasteRegions(apiOrigin);
  const matches = regions.items.filter((region) => region.slug === binding.regionSlug);
  const matchedRegion = matches[0];
  if (matches.length !== 1 || !matchedRegion || !isPublicWasteUuid(matchedRegion.id)) {
    throw new Error(BOUND_REGION_UNAVAILABLE_ERROR);
  }
  return matchedRegion.id.toLowerCase();
};

export const readStoredLocationSelection = (): PublicWasteResolvedSelection | null => {
  const locationKey = readPublicWasteCookieValue(document.cookie, PUBLIC_WASTE_PREFERENCE_COOKIE);
  if (!locationKey) {
    return null;
  }

  return parsePublicWasteLocationKey(locationKey);
};

export const writeStoredLocationSelection = (selection: PublicWasteResolvedSelection): void => {
  document.cookie = serializePublicWastePreferenceCookie({
    locationKey: buildPublicWasteLocationKey(selection),
  });
};
