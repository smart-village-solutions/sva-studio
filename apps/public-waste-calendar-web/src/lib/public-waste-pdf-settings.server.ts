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

export const loadPublicWastePdfStaticConfig = async (
  instanceId: string
): Promise<PublicWastePdfStaticConfig> => {
  const interfaceRecords = await listExternalInterfaceRecords(instanceId).catch(() => []);
  const selectedInterface =
    findSelectedWasteManagementInterfaceRecord(interfaceRecords) ??
    (await loadDefaultExternalInterfaceRecord(instanceId, 'supabase').catch(() => null));

  if (!selectedInterface) {
    return {};
  }

  return {
    brandingAssetUrl: readWasteManagementPdfBrandingAssetUrl(selectedInterface.publicConfig),
    contactBlock: readWasteManagementPdfContactBlock(selectedInterface.publicConfig),
  };
};
