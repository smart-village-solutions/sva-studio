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

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const wastePdfStaticSettingsPoolCache = new Map<string, Pool>();

const readOptionalTrimmedEnv = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const hasWastePdfStaticSettingsValue = (
  record: WastePdfStaticSettingsRecord | null | undefined
): boolean => Boolean(record?.pdfBrandingAssetUrl || record?.pdfContactBlock);

const hasCompleteWastePdfStaticSettings = (
  record: WastePdfStaticSettingsRecord | null | undefined
): boolean => Boolean(record?.pdfBrandingAssetUrl && record?.pdfContactBlock);

const quoteIdentifier = (value: string): string => {
  if (!schemaIdentifierPattern.test(value)) {
    throw new Error(`invalid_waste_schema:${value}`);
  }
  return `"${value}"`;
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

const getWastePdfStaticSettingsPool = (databaseUrl: string): Pool => {
  const cached = wastePdfStaticSettingsPoolCache.get(databaseUrl);
  if (cached) {
    return cached;
  }
  const created = new Pool({
    connectionString: databaseUrl,
    max: 4,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });
  wastePdfStaticSettingsPoolCache.set(databaseUrl, created);
  return created;
};

const loadWastePdfStaticSettings = async (options: {
  readonly getDatabaseUrl?: () => string | undefined;
  readonly getSchemaName?: () => string | undefined;
}): Promise<WastePdfStaticSettingsRecord | null> => {
  const databaseUrl = resolvePublicWasteDataDatabaseUrl(options.getDatabaseUrl)();
  if (!databaseUrl) {
    return null;
  }

  const schemaName = resolvePublicWasteSchemaName(options.getSchemaName)();
  const pool = getWastePdfStaticSettingsPool(databaseUrl);

  try {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${quoteIdentifier(schemaName)}, public;`);
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
    // Pool stays cached for subsequent PDF requests.
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
  const completeWastePdfStaticSettings =
    wastePdfStaticSettings && hasCompleteWastePdfStaticSettings(wastePdfStaticSettings)
      ? wastePdfStaticSettings
      : null;
  if (completeWastePdfStaticSettings) {
    return {
      brandingAssetUrl: completeWastePdfStaticSettings.pdfBrandingAssetUrl,
      contactBlock: completeWastePdfStaticSettings.pdfContactBlock,
    };
  }

  const getDatabaseUrl = resolveLegacySettingsDatabaseUrl(options.getDatabaseUrl);
  const interfaceRecords = await Promise.resolve(
    listExternalInterfaceRecords(instanceId, { getDatabaseUrl })
  ).catch(() => []);
  const selectedInterface =
    findSelectedWasteManagementInterfaceRecord(interfaceRecords) ??
    (await Promise.resolve(
      loadDefaultExternalInterfaceRecord(instanceId, 'supabase', { getDatabaseUrl })
    ).catch(() => null));

  const fallbackConfig = !selectedInterface
    ? {
        brandingAssetUrl: readOptionalTrimmedEnv(process.env.PUBLIC_WASTE_PDF_BRANDING_ASSET_URL),
        contactBlock: readOptionalTrimmedEnv(process.env.PUBLIC_WASTE_PDF_CONTACT_BLOCK),
      }
    : {
        brandingAssetUrl:
          readWasteManagementPdfBrandingAssetUrl(selectedInterface.publicConfig) ??
          readOptionalTrimmedEnv(process.env.PUBLIC_WASTE_PDF_BRANDING_ASSET_URL),
        contactBlock:
          readWasteManagementPdfContactBlock(selectedInterface.publicConfig) ??
          readOptionalTrimmedEnv(process.env.PUBLIC_WASTE_PDF_CONTACT_BLOCK),
      };
  const partialWastePdfStaticSettings =
    wastePdfStaticSettings && hasWastePdfStaticSettingsValue(wastePdfStaticSettings)
    ? wastePdfStaticSettings
    : null;
  if (!partialWastePdfStaticSettings) {
    return fallbackConfig;
  }

  return {
    brandingAssetUrl: partialWastePdfStaticSettings.pdfBrandingAssetUrl ?? fallbackConfig.brandingAssetUrl,
    contactBlock: partialWastePdfStaticSettings.pdfContactBlock ?? fallbackConfig.contactBlock,
  };
};
