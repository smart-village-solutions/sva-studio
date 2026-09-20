export const wizardInstancesAdminENResources = {
  steps: {
    basics: {
      title: 'Instance',
      description: 'Define instance id, display name, and parent domain for the registry record.',
    },
    auth: {
      title: 'User database (Keycloak realm)',
      description: 'Store realm, client, and optional issuer/secret mapping for the tenant.',
    },
    tenantAdmin: {
      title: 'First administrator',
      description: 'Provide the complete initial administrator profile for bootstrap and recovery.',
    },
    review: {
      title: 'Review and create',
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
    tenantAdminUsername: 'Please provide a username for the first administrator.',
    tenantAdminEmail: 'Please provide an email address for the first administrator.',
    tenantAdminEmailFormat: 'Please provide a valid email address.',
    tenantAdminFirstName: 'Please provide the first administrator’s first name.',
    tenantAdminLastName: 'Please provide the first administrator’s last name.',
    wasteProjectUrl:
      'Please provide a Supabase project URL once waste management is enabled for the instance.',
  },
  readiness: {
    serverChecking: 'Checking server-side readiness.',
    serverUnavailable:
      'Server-side readiness could not be confirmed. The instance cannot be created yet.',
    createGroup: 'Resolve before creation',
    provisioningGroup: 'Configured by Studio',
    activationGroup: 'Required before activation',
    noBlockers: 'No open findings in this group.',
    recheck: 'Check again',
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
  realmCatalog: {
    placeholder: 'Select user database',
    search: 'Search user databases',
    empty: 'No user database found.',
    system_realm: 'The system realm cannot be selected.',
    already_assigned: 'Already assigned to another Studio instance.',
  },
  realmSuitability: {
    ready: 'The user database is ready.',
    auto_completable: 'Studio can add the missing owned artifacts.',
    manual_resolution_required: 'Manual resolution is required before creation.',
  },
  capabilities: {
    worker: 'Provisioning worker',
    queue: 'Job queue',
    callback: 'Status callback',
    provisioner: 'Provisioner',
    ingress: 'Ingress and TLS',
    plugin: 'Plugin lifecycle',
  },
  studioInstanceLabel: 'Studio instance',
  studioInstanceSva: 'Smart Village App',
  studioInstanceKassel: 'KasselDIALOG',
  technicalDetails: 'Technical details',
  existingRealmTechnicalDetails:
    'Studio uses login client {{loginClient}} and administration client {{adminClient}}. Issuer and secrets are verified or captured by the responsible secure setup action.',
  authHint:
    'The tenant client secret is strongly recommended for existing realms so status and drift checks can run completely.',
  authSecretGeneratedHint:
    'For new realms, you do not need to know a secret here. Studio generates it during provisioning and stores it afterwards.',
  newRealmBaselineSummary:
    'Studio derives the realm and clients automatically and configures theme, dark mode, German only, events, user profile, instanceId mapper, and the non-secret email settings on the server. Afterwards, only the SMTP password must be set directly in Keycloak.',
  tenantAdminOptional: 'All values are required for the initial administrator profile.',
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
