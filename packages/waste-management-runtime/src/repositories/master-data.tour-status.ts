import type { WasteTourStatusBulkUpdateInput } from '@sva/waste-management-contracts';

import type { SqlStatement } from '@sva/data-repositories';

export const buildTourStatusBulkUpdateStatement = (
  input: WasteTourStatusBulkUpdateInput
): SqlStatement => {
  if ('review' in input) {
    return {
      text: `
UPDATE waste_tours
SET reviewed_on = CASE WHEN $2 = 'today' THEN (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date END
WHERE id = ANY($1::uuid[]);
`,
      values: [input.tourIds, input.review],
    };
  }

  return {
    text: `
UPDATE waste_tours
SET status = $2,
    active = ($2 = 'published'),
    updated_at = NOW()
WHERE id = ANY($1::uuid[]);
`,
    values: [input.tourIds, input.status],
  };
};
