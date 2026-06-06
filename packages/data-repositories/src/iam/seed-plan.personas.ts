import type { PersonaSeed } from './types.js';
import { tenantBootstrapPermissionKeys } from './seed-plan.permissions.js';

export const iamSeedPersonas: readonly PersonaSeed[] = [
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
