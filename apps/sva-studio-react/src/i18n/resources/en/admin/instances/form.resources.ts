export const formInstancesAdminENResources = {
  title: 'Create instance',
  subtitle:
    'Creation uses the same provisioning contract as the ops path and stores the base Keycloak realm settings.',
  instanceId: 'Instance id',
  displayName: 'Display name',
  parentDomain: 'Parent domain',
  authRealm: 'Auth realm',
  authClientId: 'Auth client id',
  authIssuerUrl: 'Auth issuer URL',
  authClientSecret: 'Tenant client secret',
  authClientSecretConfigured: 'Secret already configured',
  authClientSecretMissing: 'No secret configured yet',
  authClientSecretHint: 'Leave empty to keep the existing secret unchanged.',
  authClientSecretGeneratedHint:
    'For new realms, the secret is generated automatically during provisioning and stored in Studio afterwards.',
  authClientSecretGeneratedDuringProvisioning: 'Generated automatically during provisioning',
  tenantAdminClientTitle: 'Tenant admin client',
  tenantAdminClientSubtitle:
    'Client contract and secret for tenant-specific administrative operations.',
  tenantAdminClientId: 'Tenant admin client id',
  tenantAdminClientSecret: 'Tenant admin client secret',
  tenantAdminClientSecretConfigured: 'Secret already configured',
  tenantAdminClientSecretMissing: 'Secret still missing',
  tenantAdminClientSecretGeneratedHint:
    'For new realms, the tenant admin client secret is generated automatically during provisioning and stored in Studio afterwards.',
  tenantAdminClientSecretHint:
    'Leave empty to keep the existing tenant admin client secret unchanged.',
  tenantAdminTitle: 'Initial tenant admin',
  tenantAdminSubtitle: 'These values are used for tenant realm bootstrap.',
  tenantAdminUsername: 'Admin username',
  tenantAdminEmail: 'Admin email',
  tenantAdminFirstName: 'Admin first name',
  tenantAdminLastName: 'Admin last name',
  wasteManagementEnabled: 'Configure waste management',
  wasteManagementSubtitle:
    'Instance-specific waste data source and technical credentials for the waste plugin.',
  wasteManagementProjectUrl: 'Supabase project URL',
  wasteManagementSchemaName: 'Schema name',
  wasteManagementProvider: 'Provider',
  wasteManagementDatabaseUrl: 'Database URL',
  wasteManagementDatabaseUrlConfigured: 'Already configured',
  wasteManagementDatabaseUrlHint: 'Leave empty to keep the existing waste database URL unchanged.',
  wasteManagementDatabaseUrlCreateHint:
    'Optional during creation. Can be added later in the instance configuration.',
  wasteManagementServiceRoleKey: 'Service role key',
  wasteManagementServiceRoleKeyConfigured: 'Already configured',
  wasteManagementServiceRoleKeyHint:
    'Leave empty to keep the existing waste service role key unchanged.',
  wasteManagementServiceRoleKeyCreateHint:
    'Optional during creation. Can be added later in the instance configuration.',
} as const;
