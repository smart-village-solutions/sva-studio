export const keycloakPanelInstancesAdminENResources = {
  title: 'Keycloak status and bootstrap',
  subtitle: 'Reconcile realm, client, mapper, and tenant admin for the selected instance.',
  temporaryPassword: 'Temporary admin password',
  passwordHint: 'The password is used only for this bootstrap and is not stored in Studio.',
  rotateClientSecret: 'Push the tenant client secret to Keycloak again during reconcile',
  empty: 'No Keycloak status data is available for this instance yet.',
} as const;
