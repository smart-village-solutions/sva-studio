import { Pool } from 'pg';
import {
  findSelectedWasteManagementInterfaceRecord,
  readWasteManagementPdfBrandingAssetUrl,
  readWasteManagementPdfContactBlock,
  type WastePdfStaticSettingsRecord,
} from '@sva/core';
import { createWasteMasterDataRepository } from '@sva/data-repositories';
import {
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
} from '@sva/data-repositories/server';

export type PublicWastePdfStaticConfig = Readonly<{
  brandingAssetUrl?: string;
  contactBlock?: string;
}>;

const readOptionalTrimmedEnv = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const resolvePublicWasteDataDatabaseUrl = (
  getDatabaseUrl?: () => string | undefined
): (() => string | undefined) =>
  getDatabaseUrl ?? (() => process.env.PUBLIC_WASTE_DATABASE_URL?.trim());

const resolveLegacySettingsDatabaseUrl = (
  getDatabaseUrl?: () => string | undefined
): (() => string | undefined) =>
  () => process.env.IAM_DATABASE_URL?.trim() || getDatabaseUrl?.();

const resolvePublicWasteSchemaName = (getSchemaName?: () => string | undefined): (() => string) =>
  () => getSchemaName?.()?.trim() || process.env.PUBLIC_WASTE_SCHEMA_NAME?.trim() || 'public';

const loadWastePdfStaticSettings = async (options: {
  readonly getDatabaseUrl?: () => string | undefined;
  readonly getSchemaName?: () => string | undefined;
}): Promise<WastePdfStaticSettingsRecord | null> => {
  const databaseUrl = resolvePublicWasteDataDatabaseUrl(options.getDatabaseUrl)();
  if (!databaseUrl) {
    return null;
  }

  const schemaName = resolvePublicWasteSchemaName(options.getSchemaName)();
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName.replace(/"/g, '""')}", public;`);
      const repository = createWasteMasterDataRepository({
        async execute(statement) {
          const result = await client.query(statement.text, statement.values ? [...statement.values] : undefined);
          return {
            rowCount: result.rowCount ?? 0,
            rows: result.rows,
          };
        },
      });
      return await repository.getWastePdfStaticSettings();
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

export const loadPublicWastePdfStaticConfig = async (
  instanceId: string,
  options: {
    readonly getDatabaseUrl?: () => string | undefined;
    readonly getSchemaName?: () => string | undefined;
  } = {}
): Promise<PublicWastePdfStaticConfig> => {
  const wastePdfStaticSettings = await loadWastePdfStaticSettings(options).catch(() => null);
  if (wastePdfStaticSettings) {
    return {
      brandingAssetUrl: wastePdfStaticSettings.pdfBrandingAssetUrl,
      contactBlock: wastePdfStaticSettings.pdfContactBlock,
    };
  }

  const getDatabaseUrl = resolveLegacySettingsDatabaseUrl(options.getDatabaseUrl);
  const interfaceRecords = await listExternalInterfaceRecords(instanceId, { getDatabaseUrl }).catch(() => []);
  const selectedInterface =
    findSelectedWasteManagementInterfaceRecord(interfaceRecords) ??
    (await loadDefaultExternalInterfaceRecord(instanceId, 'supabase', { getDatabaseUrl }).catch(() => null));

  if (!selectedInterface) {
    return {
      brandingAssetUrl: readOptionalTrimmedEnv(process.env.PUBLIC_WASTE_PDF_BRANDING_ASSET_URL),
      contactBlock: readOptionalTrimmedEnv(process.env.PUBLIC_WASTE_PDF_CONTACT_BLOCK),
    };
  }

  return {
    brandingAssetUrl:
      readWasteManagementPdfBrandingAssetUrl(selectedInterface.publicConfig) ??
      readOptionalTrimmedEnv(process.env.PUBLIC_WASTE_PDF_BRANDING_ASSET_URL),
    contactBlock:
      readWasteManagementPdfContactBlock(selectedInterface.publicConfig) ??
      readOptionalTrimmedEnv(process.env.PUBLIC_WASTE_PDF_CONTACT_BLOCK),
  };
};
