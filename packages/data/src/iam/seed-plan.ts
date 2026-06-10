import type { IamSeedPlan, PermissionKey, PersonaSeed } from './types.js';

const permissions = [
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
  ['40111111-1111-1111-1111-111111111131', 'news.read', 'Read news plugin content'],
  ['40111111-1111-1111-1111-111111111132', 'news.create', 'Create news plugin content'],
  ['40111111-1111-1111-1111-111111111133', 'news.update', 'Update news plugin content'],
  ['40111111-1111-1111-1111-111111111134', 'news.delete', 'Delete news plugin content'],
  ['40111111-1111-1111-1111-111111111135', 'events.read', 'Read events plugin content'],
  ['40111111-1111-1111-1111-111111111136', 'events.create', 'Create events plugin content'],
  ['40111111-1111-1111-1111-111111111137', 'events.update', 'Update events plugin content'],
  ['40111111-1111-1111-1111-111111111138', 'events.delete', 'Delete events plugin content'],
  ['40111111-1111-1111-1111-111111111139', 'poi.read', 'Read POI plugin content'],
  ['40111111-1111-1111-1111-111111111140', 'poi.create', 'Create POI plugin content'],
  ['40111111-1111-1111-1111-111111111141', 'poi.update', 'Update POI plugin content'],
  ['40111111-1111-1111-1111-111111111142', 'poi.delete', 'Delete POI plugin content'],
  ['40111111-1111-1111-1111-111111111164', 'categories.read', 'Read categories plugin content'],
  ['40111111-1111-1111-1111-111111111165', 'categories.create', 'Create categories plugin content'],
  ['40111111-1111-1111-1111-111111111166', 'categories.update', 'Update categories plugin content'],
  ['40111111-1111-1111-1111-111111111167', 'categories.delete', 'Delete categories plugin content'],
] as const satisfies readonly [string, PermissionKey, string][];
export const rootOnlySeedPermissionKeys = ['instance.registry.manage'] as const satisfies readonly PermissionKey[];
const rootOnlySeedPermissionKeySet: ReadonlySet<PermissionKey> = new Set(rootOnlySeedPermissionKeys);
export const tenantBootstrapPermissionKeys = permissions
  .map(([, key]) => key)
  .filter((key): key is PermissionKey => !rootOnlySeedPermissionKeySet.has(key));
const personas: readonly PersonaSeed[] = [
  {
    personaKey: 'system_admin',
    roleSlug: 'system_admin',
    roleLevel: 100,
    displayName: 'System Administrator',
    scopeDefault: 'instance',
    mfaPolicy: 'required',
    permissionKeys: tenantBootstrapPermissionKeys,
    accountId: '50111111-1111-1111-1111-111111111111',
    keycloakSubject: 'seed:system_admin',
    seedEmailPlaceholder: 'seed.system_admin@sva.local',
    seedDisplayNamePlaceholder: 'System Administrator',
  },
];

const iamSeedFiles = [
  '0001_iam_personas.sql',
  '0002_bb_guben_permissions.sql',
  '0003_iam_deletion_rules_defaults.sql',
] as const;

export const iamSeedPlan: IamSeedPlan & { readonly seedFiles: typeof iamSeedFiles } = {
  context: {
    instanceId: 'de-musterhausen',
    organizationId: '22222222-2222-2222-2222-222222222222',
    organizationKey: 'seed-org-default',
  },
  seedFiles: iamSeedFiles,
  organizations: [
    {
      id: '22222222-2222-2222-2222-222222222222',
      organizationKey: 'seed-org-default',
      displayName: 'Seed County Default',
      organizationType: 'county',
      hierarchyPath: [],
      depth: 0,
      contentAuthorPolicy: 'org_only',
      isActive: true,
      metadata: { seed: true, version: 'v2', level: 'county' },
    },
    {
      id: '22333333-3333-3333-3333-333333333333',
      organizationKey: 'seed-org-municipality',
      displayName: 'Seed Municipality',
      organizationType: 'municipality',
      parentOrganizationId: '22222222-2222-2222-2222-222222222222',
      hierarchyPath: ['22222222-2222-2222-2222-222222222222'],
      depth: 1,
      contentAuthorPolicy: 'org_or_personal',
      isActive: true,
      metadata: { seed: true, version: 'v2', level: 'municipality' },
    },
    {
      id: '22444444-4444-4444-4444-444444444444',
      organizationKey: 'seed-org-district',
      displayName: 'Seed District',
      organizationType: 'district',
      parentOrganizationId: '22333333-3333-3333-3333-333333333333',
      hierarchyPath: ['22222222-2222-2222-2222-222222222222', '22333333-3333-3333-3333-333333333333'],
      depth: 2,
      contentAuthorPolicy: 'org_only',
      isActive: true,
      metadata: { seed: true, version: 'v2', level: 'district' },
    },
  ],
  personas,
  permissions: permissions.map(([id, key, description]) => ({
    id,
    key,
    action: key,
    resourceType: key.split('.')[0] ?? key,
    effect: 'allow',
    scope: {},
    description,
  })),
};
export const getPersonaSeed = (personaKey: PersonaSeed['personaKey']): PersonaSeed => {
  const persona = iamSeedPlan.personas.find((entry) => entry.personaKey === personaKey);
  if (!persona) throw new Error(`Unknown persona key: ${personaKey}`);
  return persona;
};
