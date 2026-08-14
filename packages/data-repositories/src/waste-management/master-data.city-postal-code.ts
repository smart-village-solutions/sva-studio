import type { SqlStatement } from '../iam/repositories/types.js';

export const buildCityPostalCodeIfMissingStatement = (
  id: string,
  postalCode: string
): SqlStatement => ({
  text: `
UPDATE waste_cities
SET postal_code = $2,
    updated_at = NOW()
WHERE id = $1::uuid
  AND (postal_code IS NULL OR BTRIM(postal_code) = '');
`,
  values: [id, postalCode],
});
