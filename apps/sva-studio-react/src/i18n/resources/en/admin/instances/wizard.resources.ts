export const wizardInstancesAdminENResources = {
  steps: {
    basics: {
      title: 'Basics',
      description: 'Define instance id, display name, and parent domain for the registry record.',
    },
    auth: {
      title: 'Keycloak mapping',
      description: 'Store realm, client, and optional issuer/secret mapping for the tenant.',
    },
    tenantAdmin: {
      title: 'Tenant admin',
      description: 'Optionally prepare the initial tenant admin for bootstrap and recovery.',
    },
    review: {
      title: 'Review & create',
      description: 'Check the inputs and create the instance in the registry first.',
    },
  },
  validation: {
    instanceId: 'Please provide an instance id.',
    displayName: 'Please provide a display name.',
    parentDomain: 'Please provide a parent domain.',
    authRealm: 'Please provide an auth realm.',
    authRealmFormat: 'Please provide a valid auth realm without spaces or prose.',
    authClientId: 'Please provide an auth client id.',
    authClientSecret: 'Please provide a tenant client secret.',
    tenantAdminClientId: 'Please provide a tenant admin client id.',
    tenantAdminClientSecret: 'Please provide a tenant admin client secret.',
    wasteProjectUrl:
      'Please provide a Supabase project URL once waste management is enabled for the instance.',
  },
  readiness: {
    secretTitle: 'Tenant client secret',
    secretReady:
      'A secret will be stored with the instance so provisioning can verify it immediately.',
    secretMissing: 'No secret entered yet. Later drift and status checks will remain incomplete.',
    secretGenerated:
      'For a new realm, the tenant client secret is only generated during provisioning and stored afterwards.',
    tenantAdminTitle: 'Initial tenant admin',
    tenantAdminReady:
      'A tenant admin is stored and can be reused for the first bootstrap or reset.',
    tenantAdminMissing:
      'No tenant admin stored. This follow-up step will stay manual after creation.',
    followUpTitle: 'Next operational step',
    followUpSummary:
      'After saving, continue on the detail page with technical checks and Keycloak provisioning.',
  },
  authHint:
    'The tenant client secret is strongly recommended for existing realms so status and drift checks can run completely.',
  authSecretGeneratedHint:
    'For new realms, you do not need to know a secret here. Studio generates it during provisioning and stores it afterwards.',
  tenantAdminOptional:
    'These values are optional as long as the tenant admin does not need to be reset during the first provisioning run.',
  reviewTitle: 'Review input',
  reviewSubtitle:
    'The instance will only be created now. The actual Keycloak reconciliation happens afterwards on the detail page.',
  reviewDefaultIssuer: 'Derived automatically from the realm',
  reviewNotConfigured: 'Not configured',
  actions: {
    back: 'Back',
    next: 'Next',
  },
} as const;
