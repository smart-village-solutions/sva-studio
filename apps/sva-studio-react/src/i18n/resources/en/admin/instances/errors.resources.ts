export const errorsInstancesAdminENResources = {
  unauthorized: 'Your session is no longer valid. Please sign in again.',
  recoveryRunning: 'The session is currently recovering or unstable. Please sign in again.',
  forbidden: 'You do not have permission to manage instances.',
  csrfValidationFailed: 'Security validation failed. Please reload the page and try again.',
  reauthRequired: 'A fresh re-authentication is required for this action.',
  conflict: 'The requested change conflicts with the current instance state.',
  databaseUnavailable: 'The registry could not be processed because of a database problem.',
  databaseOrSchemaDrift:
    'Instance management is currently degraded because of a database or migration mismatch.',
  registryOrProvisioningDrift:
    'Registry or provisioning drift was detected for this instance. Please review Keycloak status, preflight, and the latest run together.',
  keycloakReconcile:
    'The Keycloak reconcile failed or needs manual follow-up. Please inspect the reconcile finding with the request ID.',
  tenantAuthClientSecretMissing: 'No tenant client secret has been stored for this instance yet.',
  tenantAdminClientNotConfigured:
    'No tenant admin client has been stored for this instance yet. Enter the client contract and save the instance.',
  tenantAdminClientSecretMissing:
    'The tenant admin client secret is still missing for this instance. Enter it on the detail page and save again.',
  keycloakUnavailable: 'Keycloak could not be reached or reconciled.',
  encryptionNotConfigured: 'Field encryption required for tenant secrets is not configured.',
} as const;
