import { studioModuleIamContracts } from '@sva/studio-module-iam';

export type ManagedPermissionMetadata = Readonly<{
  permissionKey: string;
  moduleId: string;
  description: string;
}>;

const managedPermissionDescriptions = {
  'waste-management.read': 'Lesezugriff auf das Waste-Management-Modul',
  'waste-management.master-data.manage': 'Stammdaten im Waste-Management verwalten',
  'waste-management.tours.manage': 'Touren im Waste-Management verwalten',
  'waste-management.scheduling.manage': 'Ausweichtermine im Waste-Management verwalten',
  'waste-management.import.execute': 'Waste-Importe ausführen',
  'waste-management.seed.execute': 'Waste-Seeds ausführen',
  'waste-management.reset.execute': 'Waste-Resets ausführen',
  'waste-management.settings.manage': 'Waste-Datenquellen und technische Einstellungen verwalten',
} as const satisfies Record<string, string>;

const managedPermissionMetadata = studioModuleIamContracts.flatMap((contract) =>
  contract.permissionIds.flatMap((permissionKey) => {
    const description = managedPermissionDescriptions[permissionKey as keyof typeof managedPermissionDescriptions];
    return description ? [{ permissionKey, moduleId: contract.moduleId, description }] : [];
  })
) as readonly ManagedPermissionMetadata[];

const managedPermissionMetadataByKey = new Map(
  managedPermissionMetadata.map((entry) => [entry.permissionKey, entry] as const)
) as ReadonlyMap<string, ManagedPermissionMetadata>;

export const listManagedPermissionMetadata = (): readonly ManagedPermissionMetadata[] => managedPermissionMetadata;

export const getManagedPermissionMetadata = (permissionKey: string): ManagedPermissionMetadata | undefined =>
  managedPermissionMetadataByKey.get(permissionKey);
