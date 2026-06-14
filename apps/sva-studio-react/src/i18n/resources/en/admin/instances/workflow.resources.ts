export const workflowInstancesAdminENResources = {
  title: 'What is still open?',
  subtitle: 'This checklist shows which technical steps are still required after saving.',
  badges: {
    done: 'Done',
    current: 'Next',
    blocked: 'Blocked',
    pending: 'Pending',
  },
  registry: {
    title: 'Registry stored',
    description: 'The instance exists in Studio. Current overall status: {{status}}.',
  },
  keycloakAccess: {
    title: 'Technical Keycloak access',
    ready: 'Technical access to Keycloak has been verified successfully.',
    pending: 'Technical reachability and admin permission should be checked now.',
    blocked: 'Keycloak is currently unreachable or the technical check failed.',
  },
  realm: {
    title: 'Check realm',
    newRealm: 'This flow expects the realm to be created during provisioning.',
    ready: 'The expected realm exists.',
    blocked: 'The configured realm does not match the selected mode or cannot be reached.',
    pending: 'The realm should now be checked against the stored configuration.',
  },
  client: {
    title: 'Check client',
    ready: 'The expected tenant client was found.',
    blocked: 'The client could not be checked yet because Keycloak access is blocked.',
    pending: 'The tenant client should be checked through preview or a status run.',
  },
  tenantAdminClient: {
    title: 'Check tenant admin client',
    notConfigured: 'No tenant admin client is stored in the registry yet.',
    secretMissing:
      'The tenant admin client exists in the registry, but its secret contract is still incomplete.',
    ready: 'The tenant admin client and its secret contract match the expected state.',
    blocked: 'The tenant admin client could not be checked yet because Keycloak access is blocked.',
    pending: 'The tenant admin client should now be verified or reconciled through provisioning.',
  },
  tenantSecret: {
    title: 'Check tenant secret',
    missing: 'No tenant client secret is stored yet. This blocks technical reconciliation.',
    generatedDuringProvisioning:
      'For new realms, the tenant client secret is only generated during provisioning and stored afterwards.',
    ready: 'The tenant secret is stored and technically readable.',
    blocked: 'The secret could not be checked against Keycloak yet.',
    pending: 'The secret exists but still needs a technical check against Keycloak.',
  },
  tenantAdmin: {
    title: 'Check tenant admin',
    missing: 'No tenant admin is stored yet. This step stays blocked until you add one.',
    ready: 'Tenant admin and system_admin role are present.',
    blocked: 'The tenant admin could not be checked yet because Keycloak access is blocked.',
    pending: 'The tenant admin is stored but still needs to be verified or reset in the realm.',
  },
  provisioning: {
    title: 'Execute provisioning',
    ready: 'The last Keycloak provisioning run succeeded.',
    running: 'The Keycloak provisioning run is currently in progress.',
    failed: 'The last Keycloak provisioning run failed and needs attention.',
    pending: 'After checking realm, client, and admin, provisioning can run next.',
  },
  activation: {
    title: 'Activate instance',
    ready: 'The instance is active and ready for use.',
    current: 'Provisioning succeeded. The instance can now be activated.',
    pending: 'Activation stays blocked until provisioning has completed successfully.',
  },
} as const;
