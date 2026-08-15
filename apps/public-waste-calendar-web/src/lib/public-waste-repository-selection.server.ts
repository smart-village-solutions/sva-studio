import type { PublicWasteResolvedSelection } from './public-waste-contract.js';
import { PUBLIC_WASTE_CATCH_ALL_STREET_ID } from './public-waste-contract.js';

export const isCatchAllStreetSelection = (
  streetId: string | undefined
): streetId is typeof PUBLIC_WASTE_CATCH_ALL_STREET_ID =>
  streetId === PUBLIC_WASTE_CATCH_ALL_STREET_ID;

export const createStreetSelectionFilter = (
  streetId: PublicWasteResolvedSelection['streetId']
) => ({
  text: `
            AND (
              ($2::text = '${PUBLIC_WASTE_CATCH_ALL_STREET_ID}' AND cl.street_id IS NULL)
              OR ($2::text <> '${PUBLIC_WASTE_CATCH_ALL_STREET_ID}' AND (cl.street_id IS NULL OR cl.street_id = $3::uuid))
            )
  `,
  values: [streetId, isCatchAllStreetSelection(streetId) ? null : streetId] as const,
});
