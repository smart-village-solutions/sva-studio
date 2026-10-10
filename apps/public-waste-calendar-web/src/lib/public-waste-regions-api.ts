import { fetchPublicWasteApi } from './public-waste-api.js';
import { toPublicWasteRegionSlug } from './public-waste-region-slug.js';

export type PublicWasteRegionResponse = {
  readonly items: readonly {
    readonly id: string;
    readonly label: string;
    readonly slug: string;
  }[];
};

export const requestPublicWasteRegions = async (
  apiOrigin = ''
): Promise<PublicWasteRegionResponse> => {
  const response = await fetchPublicWasteApi('/api/public-waste/regions', apiOrigin);
  if (!response.ok) {
    throw new Error(`public_waste_regions_failed:${response.status}`);
  }
  return (await response.json()) as PublicWasteRegionResponse;
};

export const projectPublicWasteRegions = (
  options: readonly { readonly id: string; readonly label: string }[]
): PublicWasteRegionResponse => {
  const projected = options.map((option) => ({
    ...option,
    slug: toPublicWasteRegionSlug(option.label),
  }));
  const slugCounts = new Map<string, number>();
  for (const region of projected) {
    slugCounts.set(region.slug, (slugCounts.get(region.slug) ?? 0) + 1);
  }

  return {
    items: projected.filter(
      (region) => region.slug.length > 0 && slugCounts.get(region.slug) === 1
    ),
  };
};
