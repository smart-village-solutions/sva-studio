import type { PermissionKey } from './types.js';

export const iamSeedPermissions = [
  ['40111111-1111-1111-1111-111111111111', 'iam.user.read', 'Read account data'],
  ['40111111-1111-1111-1111-111111111112', 'iam.user.write', 'Modify account data'],
  ['40111111-1111-1111-1111-111111111113', 'iam.role.read', 'Read role assignments'],
  ['40111111-1111-1111-1111-111111111114', 'iam.role.write', 'Modify role assignments'],
  ['40111111-1111-1111-1111-111111111115', 'iam.org.read', 'Read organization data'],
  ['40111111-1111-1111-1111-111111111116', 'iam.org.write', 'Modify organization data'],
  ['40111111-1111-1111-1111-111111111117', 'content.read', 'Read content'],
  ['40111111-1111-1111-1111-111111111118', 'content.create', 'Create content'],
  ['40111111-1111-1111-1111-111111111119', 'content.updateMetadata', 'Update content metadata'],
  ['40111111-1111-1111-1111-111111111120', 'content.publish', 'Publish content'],
  ['40111111-1111-1111-1111-111111111121', 'content.manageRevisions', 'Manage content revisions'],
  ['40111111-1111-1111-1111-111111111122', 'integration.manage', 'Manage integrations'],
  ['40111111-1111-1111-1111-111111111123', 'feature.toggle', 'Toggle feature flags'],
  ['40111111-1111-1111-1111-111111111149', 'app.read', 'Show the app link in the sidebar'],
  ['40111111-1111-1111-1111-111111111150', 'cockpit.read', 'Show the cockpit link in the sidebar'],
  ['40111111-1111-1111-1111-111111111124', 'instance.registry.manage', 'Manage instance registry and provisioning'],
  ['40111111-1111-1111-1111-111111111125', 'content.updatePayload', 'Update content payload'],
  ['40111111-1111-1111-1111-111111111126', 'content.changeStatus', 'Change content status'],
  ['40111111-1111-1111-1111-111111111127', 'content.archive', 'Archive content'],
  ['40111111-1111-1111-1111-111111111128', 'content.restore', 'Restore content'],
  ['40111111-1111-1111-1111-111111111129', 'content.readHistory', 'Read content history'],
  ['40111111-1111-1111-1111-111111111130', 'content.delete', 'Delete content'],
  ['40111111-1111-1111-1111-111111111143', 'media.read', 'Read media'],
  ['40111111-1111-1111-1111-111111111144', 'media.create', 'Create media'],
  ['40111111-1111-1111-1111-111111111145', 'media.update', 'Update media'],
  ['40111111-1111-1111-1111-111111111146', 'media.reference.manage', 'Manage media references'],
  ['40111111-1111-1111-1111-111111111147', 'media.delete', 'Delete media'],
  ['40111111-1111-1111-1111-111111111148', 'media.deliver.protected', 'Deliver protected media'],
] as const satisfies readonly [string, PermissionKey, string][];

export const applicationReadPermissionKeys = ['app.read', 'cockpit.read'] as const;
export const mediaReadPermissionKeys = ['media.read'] as const;
export const mediaManagePermissionKeys = [
  'media.read',
  'media.create',
  'media.update',
  'media.reference.manage',
  'media.delete',
] as const;
