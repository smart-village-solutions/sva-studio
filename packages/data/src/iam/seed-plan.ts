import type { IamSeedPlan, PermissionKey, PersonaSeed } from './types';

const permissions = [
  ['40111111-1111-1111-1111-111111111111', 'iam.user.read', 'Read account data'],
  ['40111111-1111-1111-1111-111111111112', 'iam.user.write', 'Modify account data'],
  ['40111111-1111-1111-1111-111111111113', 'iam.role.read', 'Read role assignments'],
  ['40111111-1111-1111-1111-111111111114', 'iam.role.write', 'Modify role assignments'],
  ['40111111-1111-1111-1111-111111111115', 'iam.org.read', 'Read organization data'],
  ['40111111-1111-1111-1111-111111111116', 'iam.org.write', 'Modify organization data'],
  ['40111111-1111-1111-1111-111111111117', 'content.read', 'Read content'],
  ['40111111-1111-1111-1111-111111111118', 'content.create', 'Create content'],
  ['40111111-1111-1111-1111-111111111119', 'content.update', 'Update content'],
  ['40111111-1111-1111-1111-111111111120', 'content.publish', 'Publish content'],
  ['40111111-1111-1111-1111-111111111121', 'content.moderate', 'Moderate content'],
  ['40111111-1111-1111-1111-111111111122', 'integration.manage', 'Manage integrations'],
  ['40111111-1111-1111-1111-111111111123', 'feature.toggle', 'Toggle feature flags'],
] as const satisfies readonly [string, PermissionKey, string][];

const personas: readonly PersonaSeed[] = [
  {
    personaKey: 'system_admin',
    roleSlug: 'system_admin',
    roleLevel: 100,
    displayName: 'System Administrator',
    scopeDefault: 'instance',
    mfaPolicy: 'required',
    permissionKeys: permissions.map(([, key]) => key),
    accountId: '50111111-1111-1111-1111-111111111111',
    keycloakSubject: 'seed:system_admin',
    seedEmailPlaceholder: 'seed.system_admin@sva.local',
    seedDisplayNamePlaceholder: 'System Administrator',
  },
  {
    personaKey: 'app_manager',
    roleSlug: 'app_manager',
    roleLevel: 80,
    displayName: 'App Manager',
    scopeDefault: 'instance',
    mfaPolicy: 'recommended',
    permissionKeys: ['iam.user.read', 'iam.user.write', 'iam.org.read', 'iam.org.write', 'content.read', 'feature.toggle'],
    accountId: '50222222-2222-2222-2222-222222222222',
    keycloakSubject: 'seed:app_manager',
    seedEmailPlaceholder: 'seed.app_manager@sva.local',
    seedDisplayNamePlaceholder: 'App Manager',
  },
  {
    personaKey: 'feature_manager',
    roleSlug: 'feature-manager',
    roleLevel: 60,
    displayName: 'Feature Manager',
    scopeDefault: 'instance',
    mfaPolicy: 'recommended',
    permissionKeys: ['content.read', 'content.update', 'feature.toggle'],
    accountId: '50333333-3333-3333-3333-333333333333',
    keycloakSubject: 'seed:feature_manager',
    seedEmailPlaceholder: 'seed.feature-manager@sva.local',
    seedDisplayNamePlaceholder: 'Feature Manager',
  },
  {
    personaKey: 'interface_manager',
    roleSlug: 'interface-manager',
    roleLevel: 50,
    displayName: 'Interface Manager',
    scopeDefault: 'instance',
    mfaPolicy: 'recommended',
    permissionKeys: ['iam.org.read', 'content.read', 'integration.manage'],
    accountId: '50444444-4444-4444-4444-444444444444',
    keycloakSubject: 'seed:interface_manager',
    seedEmailPlaceholder: 'seed.interface-manager@sva.local',
    seedDisplayNamePlaceholder: 'Interface Manager',
  },
  {
    personaKey: 'designer',
    roleSlug: 'designer',
    roleLevel: 40,
    displayName: 'Designer',
    scopeDefault: 'org',
    mfaPolicy: 'optional',
    permissionKeys: ['content.read', 'content.update'],
    accountId: '50555555-5555-5555-5555-555555555555',
    keycloakSubject: 'seed:designer',
    seedEmailPlaceholder: 'seed.designer@sva.local',
    seedDisplayNamePlaceholder: 'Designer',
  },
  {
    personaKey: 'editor',
    roleSlug: 'editor',
    roleLevel: 30,
    displayName: 'Editor',
    scopeDefault: 'org',
    mfaPolicy: 'optional',
    permissionKeys: ['content.read', 'content.create', 'content.update'],
    accountId: '50666666-6666-6666-6666-666666666666',
    keycloakSubject: 'seed:editor',
    seedEmailPlaceholder: 'seed.editor@sva.local',
    seedDisplayNamePlaceholder: 'Editor',
  },
  {
    personaKey: 'moderator',
    roleSlug: 'moderator',
    roleLevel: 35,
    displayName: 'Moderator',
    scopeDefault: 'org',
    mfaPolicy: 'optional',
    permissionKeys: ['content.read', 'content.publish', 'content.moderate'],
    accountId: '50777777-7777-7777-7777-777777777777',
    keycloakSubject: 'seed:moderator',
    seedEmailPlaceholder: 'seed.moderator@sva.local',
    seedDisplayNamePlaceholder: 'Moderator',
  },
];

export const iamSeedPlan: IamSeedPlan = {
  context: {
    instanceId: '11111111-1111-1111-1111-111111111111',
    instanceKey: 'seed-instance-default',
    organizationId: '22222222-2222-2222-2222-222222222222',
    organizationKey: 'seed-org-default',
  },
  personas,
  permissions: permissions.map(([id, key, description]) => ({ id, key, description })),
};

export const getPersonaSeed = (personaKey: PersonaSeed['personaKey']): PersonaSeed => {
  const persona = iamSeedPlan.personas.find((entry) => entry.personaKey === personaKey);

  if (!persona) {
    throw new Error(`Unknown persona key: ${personaKey}`);
  }

  return persona;
};
