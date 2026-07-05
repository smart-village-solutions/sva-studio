import type { PermissionKey } from './types.js';

export const iamSeedPermissions = [
  ['40111111-1111-1111-1111-111111111111', 'iam.user.read', 'Read account data'],
  ['40111111-1111-1111-1111-111111111112', 'iam.user.write', 'Modify account data'],
  ['40111111-1111-1111-1111-111111111113', 'iam.role.read', 'Read role assignments'],
  ['40111111-1111-1111-1111-111111111114', 'iam.role.write', 'Modify role assignments'],
  ['40111111-1111-1111-1111-111111111115', 'iam.org.read', 'Read organization data'],
  ['40111111-1111-1111-1111-111111111116', 'iam.org.write', 'Modify organization data'],
  ['40111111-1111-1111-1111-111111111151', 'iam.legalText.read', 'Read legal text administration data'],
  ['40111111-1111-1111-1111-111111111152', 'iam.legalText.write', 'Modify legal text administration data'],
  ['40111111-1111-1111-1111-111111111153', 'iam.governance.read', 'Read governance workflows and audit trails'],
  ['40111111-1111-1111-1111-111111111154', 'iam.governance.write', 'Execute governance workflows and decisions'],
  ['40111111-1111-1111-1111-111111111155', 'iam.governance.export', 'Export governance and legal consent evidence'],
  ['40111111-1111-1111-1111-111111111156', 'iam.dsr.read', 'Read tenant data-subject-rights cases'],
  ['40111111-1111-1111-1111-111111111157', 'iam.dsr.write', 'Process tenant data-subject-rights cases'],
  ['40111111-1111-1111-1111-111111111158', 'iam.dsr.export', 'Export tenant data-subject-rights payloads'],
  ['40111111-1111-1111-1111-111111111159', 'iam.deletionRules.read', 'Read tenant deletion rules'],
  ['40111111-1111-1111-1111-111111111160', 'iam.deletionRules.write', 'Modify tenant deletion rules'],
  ['40111111-1111-1111-1111-111111111161', 'iam.monitoring.read', 'Read IAM monitoring and plugin operation status'],
  ['40111111-1111-1111-1111-111111111162', 'iam.monitoring.write', 'Run IAM monitoring and plugin operations'],
  ['40111111-1111-1111-1111-111111111163', 'experimental.read', 'Enable experimental shell features and placeholders'],
  ['40111111-1111-1111-1111-111111111164', 'iam.accounts.delete', 'Delete tenant accounts physically'],
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

export const rootOnlySeedPermissionKeys = ['instance.registry.manage'] as const satisfies readonly PermissionKey[];

const rootOnlySeedPermissionKeySet: ReadonlySet<PermissionKey> = new Set(rootOnlySeedPermissionKeys);

export const tenantBootstrapPermissionKeys = iamSeedPermissions
  .map(([, key]) => key)
  .filter((key): key is PermissionKey => !rootOnlySeedPermissionKeySet.has(key));

export const experimentalShellPermissionKeys = ['experimental.read'] as const;
export const applicationReadPermissionKeys = ['app.read', 'cockpit.read'] as const;
export const mediaReadPermissionKeys = ['media.read'] as const;
export const mediaManagePermissionKeys = [
  'media.read',
  'media.create',
  'media.update',
  'media.reference.manage',
  'media.delete',
] as const;
