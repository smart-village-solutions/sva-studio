import {
  findSelectedWasteManagementInterfaceRecord,
  readWasteManagementPdfBrandingAssetUrl,
  readWasteManagementPdfContactBlock,
} from '@sva/core';
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

const resolvePublicWasteSettingsDatabaseUrl = (
  getDatabaseUrl?: () => string | undefined
): (() => string | undefined) =>
  getDatabaseUrl ?? (() => process.env.PUBLIC_WASTE_DATABASE_URL?.trim() || process.env.IAM_DATABASE_URL?.trim());

export const loadPublicWastePdfStaticConfig = async (
  instanceId: string,
  options: {
    readonly getDatabaseUrl?: () => string | undefined;
  } = {}
): Promise<PublicWastePdfStaticConfig> => {
  const getDatabaseUrl = resolvePublicWasteSettingsDatabaseUrl(options.getDatabaseUrl);
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
