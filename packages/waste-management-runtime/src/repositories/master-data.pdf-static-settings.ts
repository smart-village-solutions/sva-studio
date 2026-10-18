import type {
  WastePdfStaticSettingsRecord,
  WastePdfStaticSettingsWriteInput,
} from '@sva/waste-management-contracts';
import {
  readWasteManagementEmailReminderConfig,
  readWasteManagementEmailReminderSigningSecret,
} from '@sva/waste-management-contracts';

import type { SqlExecutor, SqlStatement } from '@sva/data-repositories';
import type { WasteMasterDataRepository } from './master-data.contract.js';

type WastePdfStaticSettingsRow = {
  readonly pdf_branding_asset_url: string | null;
  readonly pdf_contact_block: string | null;
  readonly disruption_location_enabled: boolean | null;
  readonly disruption_all_locations_enabled: boolean | null;
  readonly updated_at: string | null;
};

type WasteEmailReminderSettingsRow = {
  readonly email_reminder_config: unknown;
  readonly email_reminder_signing_secret: string | null;
};

const mapWastePdfStaticSettingsRow = (
  row: WastePdfStaticSettingsRow
): WastePdfStaticSettingsRecord => ({
  pdfBrandingAssetUrl: row.pdf_branding_asset_url ?? undefined,
  pdfContactBlock: row.pdf_contact_block ?? undefined,
  disruptionLocationEnabled: row.disruption_location_enabled ?? false,
  disruptionAllLocationsEnabled: row.disruption_all_locations_enabled ?? false,
  updatedAt: row.updated_at ?? undefined,
});

const hasWastePdfStaticSettingsValue = (record: WastePdfStaticSettingsRecord): boolean =>
  Boolean(
    record.pdfBrandingAssetUrl ||
    record.pdfContactBlock ||
    record.disruptionLocationEnabled ||
    record.disruptionAllLocationsEnabled
  );

const buildWastePdfStaticSettingsSelectStatement = (): SqlStatement => ({
  text: `
SELECT
  pdf_branding_asset_url,
  pdf_contact_block,
  disruption_location_enabled,
  disruption_all_locations_enabled,
  updated_at::text
FROM waste_settings
WHERE id = TRUE
LIMIT 1;
`,
  values: [],
});

const buildWastePdfStaticSettingsUpsertStatement = (
  input: WastePdfStaticSettingsWriteInput
): SqlStatement => ({
  text: `
INSERT INTO waste_settings (
  id,
  pdf_branding_asset_url,
  pdf_contact_block,
  disruption_location_enabled,
  disruption_all_locations_enabled,
  email_reminder_config,
  email_reminder_signing_secret
)
VALUES ($1, $2, $3, $4, $5, $8::jsonb, $9)
ON CONFLICT (id) DO UPDATE
SET pdf_branding_asset_url = EXCLUDED.pdf_branding_asset_url,
    pdf_contact_block = EXCLUDED.pdf_contact_block,
    disruption_location_enabled = CASE WHEN $6 THEN EXCLUDED.disruption_location_enabled
      ELSE waste_settings.disruption_location_enabled END,
    disruption_all_locations_enabled = CASE WHEN $7 THEN EXCLUDED.disruption_all_locations_enabled
      ELSE waste_settings.disruption_all_locations_enabled END,
    email_reminder_config = CASE WHEN $10 THEN EXCLUDED.email_reminder_config
      ELSE waste_settings.email_reminder_config END,
    email_reminder_signing_secret = CASE WHEN $11 THEN EXCLUDED.email_reminder_signing_secret
      ELSE waste_settings.email_reminder_signing_secret END,
    updated_at = NOW();
`,
  values: [
    true,
    input.pdfBrandingAssetUrl ?? null,
    input.pdfContactBlock ?? null,
    input.disruptionLocationEnabled ?? false,
    input.disruptionAllLocationsEnabled ?? false,
    input.disruptionLocationEnabled !== undefined,
    input.disruptionAllLocationsEnabled !== undefined,
    input.emailReminderConfig == null ? null : JSON.stringify(input.emailReminderConfig),
    input.emailReminderSigningSecret ?? null,
    input.emailReminderConfig !== undefined,
    input.emailReminderSigningSecret !== undefined,
  ],
});

const buildWasteEmailReminderSettingsSelectStatement = (): SqlStatement => ({
  text: `SELECT email_reminder_config, email_reminder_signing_secret
FROM waste_settings WHERE id = TRUE LIMIT 1;`,
  values: [],
});

export const createWastePdfStaticSettingsRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  'getWastePdfStaticSettings' | 'upsertWastePdfStaticSettings' | 'getWasteEmailReminderSettings'
> => ({
  async getWastePdfStaticSettings() {
    const result = await executor.execute<WastePdfStaticSettingsRow>(
      buildWastePdfStaticSettingsSelectStatement()
    );
    const mapped = result.rows[0] ? mapWastePdfStaticSettingsRow(result.rows[0]) : null;
    return mapped && hasWastePdfStaticSettingsValue(mapped) ? mapped : null;
  },
  async upsertWastePdfStaticSettings(input) {
    await executor.execute(buildWastePdfStaticSettingsUpsertStatement(input));
  },
  async getWasteEmailReminderSettings() {
    const result = await executor.execute<WasteEmailReminderSettingsRow>(
      buildWasteEmailReminderSettingsSelectStatement()
    );
    const row = result.rows[0];
    if (!row) return null;
    const config = readWasteManagementEmailReminderConfig({
      emailReminderConfig: row.email_reminder_config,
    });
    if (!config) return null;
    const signingSecret = readWasteManagementEmailReminderSigningSecret({
      emailReminderConfig: row.email_reminder_config,
      emailReminderSigningSecret: row.email_reminder_signing_secret,
    });
    if (config.enabled && !signingSecret) return null;
    return {
      config,
      signingSecret,
    };
  },
});

export const wastePdfStaticSettingsStatements = {
  getWastePdfStaticSettings: buildWastePdfStaticSettingsSelectStatement,
  upsertWastePdfStaticSettings: buildWastePdfStaticSettingsUpsertStatement,
  getWasteEmailReminderSettings: buildWasteEmailReminderSettingsSelectStatement,
} as const;
