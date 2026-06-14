export const diagnosticsAccountENResources = {
  sessionRecovery: 'The session could not be restored reliably. Please sign in again.',
  actorResolutionOrMembership:
    'Your account is technically reachable, but the business mapping or instance membership is incomplete.',
  databaseOrSchemaDrift:
    'Account data is currently degraded because of a database or migration mismatch.',
  registryOrProvisioningDrift:
    'Account data is currently degraded because of registry or provisioning drift.',
  keycloakDependency:
    'The account view cannot be loaded completely because Keycloak or a downstream role sync is not stable.',
  requestId: 'Request ID: {{requestId}}',
} as const;
