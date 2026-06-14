export const feedbackInstancesAdminENResources = {
  preflightUpdated: 'Preflight data was refreshed.',
  keycloakStatusUpdated: 'Keycloak status was refreshed.',
  provisioningPreviewUpdated: 'Provisioning preview was refreshed.',
  provisioningQueued: 'The provisioning job was queued for execution.',
  instanceActivated: 'The instance was activated.',
  tenantIamProbeUpdated: 'The tenant IAM access probe was refreshed.',
  workerEnvMissing:
    'The provisioning worker cannot technically inspect Keycloak right now. The running process is missing {{envName}}.',
  workerProjectionHint:
    'The displayed preflight and Keycloak status are currently only a registry-based projection. A real live reconciliation only happens inside the provisioning worker.',
  workerUnavailable:
    'No worker has picked up this provisioning run yet. Check or start the provisioning worker and then retry the run.',
} as const;
