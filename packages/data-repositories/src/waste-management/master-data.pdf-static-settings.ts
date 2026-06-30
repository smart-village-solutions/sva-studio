import type { WastePdfStaticSettingsRecord } from '@sva/core';

import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';

type WastePdfStaticSettingsRow = {
  readonly pdf_branding_asset_url: string | null;
  readonly pdf_contact_block: string | null;
  readonly updated_at: string | null;
};

const mapWastePdfStaticSettingsRow = (
  row: WastePdfStaticSettingsRow
): WastePdfStaticSettingsRecord => ({
  pdfBrandingAssetUrl: row.pdf_branding_asset_url ?? undefined,
  pdfContactBlock: row.pdf_contact_block ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

const buildWastePdfStaticSettingsSelectStatement = (): SqlStatement => ({
  text: `
SELECT
  pdf_branding_asset_url,
  pdf_contact_block,
  updated_at::text
FROM waste_settings
WHERE id = TRUE
LIMIT 1;
`,
  values: [],
});

const buildWastePdfStaticSettingsUpsertStatement = (input: WastePdfStaticSettingsRecord): SqlStatement => ({
  text: `
INSERT INTO waste_settings (
  id,
  pdf_branding_asset_url,
  pdf_contact_block
)
VALUES ($1, $2, $3)
ON CONFLICT (id) DO UPDATE
SET pdf_branding_asset_url = EXCLUDED.pdf_branding_asset_url,
    pdf_contact_block = EXCLUDED.pdf_contact_block,
    updated_at = NOW();
`,
  values: [true, input.pdfBrandingAssetUrl ?? null, input.pdfContactBlock ?? null],
});

export const createWastePdfStaticSettingsRepositoryPart = (
  executor: SqlExecutor
): Pick<WasteMasterDataRepository, 'getWastePdfStaticSettings' | 'upsertWastePdfStaticSettings'> => ({
  async getWastePdfStaticSettings() {
    const result = await executor.execute<WastePdfStaticSettingsRow>(buildWastePdfStaticSettingsSelectStatement());
    return result.rows[0] ? mapWastePdfStaticSettingsRow(result.rows[0]) : null;
  },
  async upsertWastePdfStaticSettings(input) {
    await executor.execute(buildWastePdfStaticSettingsUpsertStatement(input));
  },
});

export const wastePdfStaticSettingsStatements = {
  getWastePdfStaticSettings: buildWastePdfStaticSettingsSelectStatement,
  upsertWastePdfStaticSettings: buildWastePdfStaticSettingsUpsertStatement,
} as const;
