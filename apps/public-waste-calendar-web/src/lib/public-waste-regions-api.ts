import { toPublicWasteRegionSlug } from './public-waste-region-slug.js';

export type PublicWasteRegionResponse = {
  readonly items: readonly {
    readonly id: string;
    readonly label: string;
    readonly slug: string;
  }[];
};

export const requestPublicWasteRegions = async (): Promise<PublicWasteRegionResponse> => {
  const response = await fetch('/api/public-waste/regions');
  if (!response.ok) {
    throw new Error(`public_waste_regions_failed:${response.status}`);
  }
  return (await response.json()) as PublicWasteRegionResponse;
};

export const projectPublicWasteRegions = (
  options: readonly { readonly id: string; readonly label: string }[]
): PublicWasteRegionResponse => ({
  items: options.map((option) => ({
    ...option,
    slug: toPublicWasteRegionSlug(option.label),
  })),
});
