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

const resolvePublicWasteSettingsDatabaseUrl = (
  getDatabaseUrl?: () => string | undefined
): (() => string | undefined) => getDatabaseUrl ?? (() => process.env.IAM_DATABASE_URL?.trim() || process.env.PUBLIC_WASTE_DATABASE_URL?.trim());

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
    return {};
  }

  return {
    brandingAssetUrl: readWasteManagementPdfBrandingAssetUrl(selectedInterface.publicConfig),
    contactBlock: readWasteManagementPdfContactBlock(selectedInterface.publicConfig),
  };
};
