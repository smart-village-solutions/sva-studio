export const guidanceInstancesAdminENResources = {
  requested: {
    title: 'Instance saved, but not ready yet',
    body: 'The registry data exists. Next, inspect the Keycloak status and execute provisioning.',
  },
  validated: {
    title: 'Pre-check completed',
    body: 'The instance data has been validated. Review preview and technical drift before you start provisioning.',
  },
  provisioning: {
    title: 'Provisioning in progress',
    body: 'A Keycloak reconciliation is running. Wait for completion and then review activation.',
  },
  active: {
    title: 'Instance active',
    body: 'The instance is operational. Keep using this page for drift checks, secret rotation, and tenant-admin resets.',
  },
  failed: {
    title: 'Provisioning or activation failed',
    body: 'Inspect the protocol, preflight checks, and Keycloak status. Resolve blockers before retrying.',
  },
  suspended: {
    title: 'Instance suspended',
    body: 'The instance is intentionally paused. Re-check realm and secret status before reactivating it.',
  },
  archived: {
    title: 'Instance archived',
    body: 'The instance is archived and should only be changed for documentation or diagnostics.',
  },
  keycloakUnavailable:
    'The detail page remains usable, but Keycloak actions and checks are currently blocked. Verify reachability and credentials.',
} as const;
