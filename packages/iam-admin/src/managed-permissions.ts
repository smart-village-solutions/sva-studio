import { iamRolePermissionAssignmentScopes, type IamRolePermissionAssignmentScope } from '@sva/core';
import { studioModuleIamContracts } from '@sva/studio-module-iam';

export type ManagedPermissionMetadata = Readonly<{
  permissionKey: string;
  moduleId: string;
  description?: string;
  isScopeAssignable?: boolean;
  supportedAccessScopes?: readonly IamRolePermissionAssignmentScope[];
}>;

const RECORD_ACCESS_SCOPES = iamRolePermissionAssignmentScopes;
const ROOT_ONLY_PERMISSION_KEYS = ['instance.registry.manage'] as const satisfies readonly string[];
const ROOT_ONLY_PERMISSION_KEY_SET: ReadonlySet<string> = new Set(ROOT_ONLY_PERMISSION_KEYS);
const RECORD_SCOPED_PERMISSION_KEYS = [
  'content.read',
  'content.updateMetadata',
  'content.updatePayload',
  'content.changeStatus',
  'content.archive',
  'content.restore',
  'content.delete',
  'news.read',
  'news.update',
  'news.delete',
  'events.read',
  'events.update',
  'events.delete',
  'poi.read',
  'poi.update',
  'poi.delete',
] as const satisfies readonly string[];
const RECORD_SCOPED_PERMISSION_KEY_SET: ReadonlySet<string> = new Set(RECORD_SCOPED_PERMISSION_KEYS);

const isRecordScopedPermission = (permissionKey: string): boolean =>
  RECORD_SCOPED_PERMISSION_KEY_SET.has(permissionKey);

const managedPermissionDescriptions = {
  'app.read': 'App-Link in der Sidebar anzeigen',
  'cockpit.read': 'Cockpit-Link in der Sidebar anzeigen',
  'waste-management.read': 'Lesezugriff auf das Waste-Management-Modul',
  'waste-management.master-data.manage': 'Stammdaten im Waste-Management verwalten',
  'waste-management.tours.manage': 'Touren im Waste-Management verwalten',
  'waste-management.scheduling.manage': 'Ausweichtermine im Waste-Management verwalten',
  'waste-management.import.execute': 'Waste-Importe ausführen',
  'waste-management.seed.execute': 'Waste-Seeds ausführen',
  'waste-management.reset.execute': 'Waste-Resets ausführen',
  'waste-management.settings.manage': 'Waste-Datenquellen und technische Einstellungen verwalten',
} as const satisfies Record<string, string>;

const managedPermissionMetadata = [
  {
    permissionKey: 'app.read',
    moduleId: 'app',
    description: managedPermissionDescriptions['app.read'],
  },
  {
    permissionKey: 'cockpit.read',
    moduleId: 'cockpit',
    description: managedPermissionDescriptions['cockpit.read'],
  },
  ...studioModuleIamContracts.flatMap((contract) =>
    contract.permissionIds.flatMap((permissionKey) => {
      const description = managedPermissionDescriptions[permissionKey as keyof typeof managedPermissionDescriptions];
      return description || isRecordScopedPermission(permissionKey)
        ? [
            {
              permissionKey,
              moduleId: contract.moduleId,
              ...(description ? { description } : {}),
              ...(isRecordScopedPermission(permissionKey)
                ? {
                    isScopeAssignable: true,
                    supportedAccessScopes: RECORD_ACCESS_SCOPES,
                  }
                : {}),
            },
          ]
        : [];
    })
  ),
  ...RECORD_SCOPED_PERMISSION_KEYS.filter(
    (permissionKey) => !studioModuleIamContracts.some((contract) => contract.permissionIds.includes(permissionKey))
  ).map(
    (permissionKey) =>
      ({
        permissionKey,
        moduleId: permissionKey.split('.')[0] ?? 'host',
        isScopeAssignable: true,
        supportedAccessScopes: RECORD_ACCESS_SCOPES,
      }) satisfies ManagedPermissionMetadata
  ),
] as const satisfies readonly ManagedPermissionMetadata[];

const managedPermissionMetadataByKey = new Map(
  managedPermissionMetadata.map((entry) => [entry.permissionKey, entry] as const)
) as ReadonlyMap<string, ManagedPermissionMetadata>;

export const listManagedPermissionMetadata = (): readonly ManagedPermissionMetadata[] => managedPermissionMetadata;

export const getManagedPermissionMetadata = (permissionKey: string): ManagedPermissionMetadata | undefined =>
  managedPermissionMetadataByKey.get(permissionKey);

export const isRootOnlyPermissionKey = (permissionKey: string): boolean =>
  ROOT_ONLY_PERMISSION_KEY_SET.has(permissionKey);

export const isTenantVisiblePermissionKey = (permissionKey: string): boolean =>
  !isRootOnlyPermissionKey(permissionKey);
