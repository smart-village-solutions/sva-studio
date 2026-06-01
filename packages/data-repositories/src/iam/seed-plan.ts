import type { IamSeedPlan, PersonaSeed } from './types.js';
import { iamSeedPermissions } from './seed-plan.permissions.js';
import { iamSeedPersonas } from './seed-plan.personas.js';

export const iamSeedPlan: IamSeedPlan = {
  context: {
    instanceId: 'de-musterhausen',
    organizationId: '22222222-2222-2222-2222-222222222222',
    organizationKey: 'seed-org-default',
  },
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
      hierarchyPath: [
        '22222222-2222-2222-2222-222222222222',
        '22333333-3333-3333-3333-333333333333',
      ],
      depth: 2,
      contentAuthorPolicy: 'org_only',
      isActive: true,
      metadata: { seed: true, version: 'v2', level: 'district' },
    },
  ],
  personas: iamSeedPersonas,
  permissions: iamSeedPermissions.map(([id, key, description]) => ({
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

  if (!persona) {
    throw new Error(`Unknown persona key: ${personaKey}`);
  }

  return persona;
};
