import {
  corePermissionCatalog,
  rootPermissionCatalog,
  tenantCoreSystemAdminPermissionKeys,
  type CorePermissionKey,
} from '@sva/core';

import type { PermissionKey } from './types.js';

const permissionIds = {
  'iam.user.read': '40111111-1111-1111-1111-111111111111',
  'iam.user.write': '40111111-1111-1111-1111-111111111112',
  'iam.role.read': '40111111-1111-1111-1111-111111111113',
  'iam.role.write': '40111111-1111-1111-1111-111111111114',
  'iam.org.read': '40111111-1111-1111-1111-111111111115',
  'iam.org.write': '40111111-1111-1111-1111-111111111116',
  'content.read': '40111111-1111-1111-1111-111111111117',
  'content.create': '40111111-1111-1111-1111-111111111118',
  'content.updateMetadata': '40111111-1111-1111-1111-111111111119',
  'content.publish': '40111111-1111-1111-1111-111111111120',
  'content.manageRevisions': '40111111-1111-1111-1111-111111111121',
  'integration.manage': '40111111-1111-1111-1111-111111111122',
  'feature.toggle': '40111111-1111-1111-1111-111111111123',
  'instance.registry.manage': '40111111-1111-1111-1111-111111111124',
  'content.updatePayload': '40111111-1111-1111-1111-111111111125',
  'content.changeStatus': '40111111-1111-1111-1111-111111111126',
  'content.archive': '40111111-1111-1111-1111-111111111127',
  'content.restore': '40111111-1111-1111-1111-111111111128',
  'content.readHistory': '40111111-1111-1111-1111-111111111129',
  'content.delete': '40111111-1111-1111-1111-111111111130',
  'app.read': '40111111-1111-1111-1111-111111111149',
  'cockpit.read': '40111111-1111-1111-1111-111111111150',
  'iam.legalText.read': '40111111-1111-1111-1111-111111111151',
  'iam.legalText.write': '40111111-1111-1111-1111-111111111152',
  'iam.governance.read': '40111111-1111-1111-1111-111111111153',
  'iam.governance.write': '40111111-1111-1111-1111-111111111154',
  'iam.governance.export': '40111111-1111-1111-1111-111111111155',
  'iam.dsr.read': '40111111-1111-1111-1111-111111111156',
  'iam.dsr.write': '40111111-1111-1111-1111-111111111157',
  'iam.dsr.export': '40111111-1111-1111-1111-111111111158',
  'iam.deletionRules.read': '40111111-1111-1111-1111-111111111159',
  'iam.deletionRules.write': '40111111-1111-1111-1111-111111111160',
  'iam.monitoring.read': '40111111-1111-1111-1111-111111111161',
  'iam.monitoring.write': '40111111-1111-1111-1111-111111111162',
  'experimental.read': '40111111-1111-1111-1111-111111111163',
  'iam.accounts.delete': '40111111-1111-1111-1111-111111111168',
} as const satisfies Readonly<Record<CorePermissionKey, string>>;

export const iamSeedPermissions = corePermissionCatalog.map((definition) => [
  permissionIds[definition.key],
  definition.key,
  definition.description,
] as const) satisfies readonly [string, PermissionKey, string][];

export const rootOnlySeedPermissionKeys = rootPermissionCatalog.map(
  (definition) => definition.key
) satisfies readonly PermissionKey[];

export const tenantBootstrapPermissionKeys = tenantCoreSystemAdminPermissionKeys satisfies readonly PermissionKey[];

export const experimentalShellPermissionKeys = ['experimental.read'] as const satisfies readonly PermissionKey[];
export const applicationReadPermissionKeys = ['app.read', 'cockpit.read'] as const satisfies readonly PermissionKey[];
export const mediaReadPermissionKeys = ['media.read'] as const;
export const mediaManagePermissionKeys = [
  'media.read',
  'media.create',
  'media.update',
  'media.reference.manage',
  'media.delete',
] as const;
