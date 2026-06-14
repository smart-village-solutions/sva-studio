export const setupInstancesAdminENResources = {
  title: 'Complete setup',
  subtitle:
    'The instance {{instanceId}} has been created. Finish activation and the tenant admin structure before switching into normal operations.',
  temporaryPasswordTitle: 'Temporary tenant admin password',
  temporaryPasswordHint:
    'Only needed when the workflow should assign a password while resetting the tenant admin.',
  status: {
    title: 'Setup status',
    subtitle:
      'The setup flow is complete once the instance is active and the tenant admin structure has been initialized.',
    activationTitle: 'Instance activated',
    activationPending: 'Activate the instance after provisioning succeeded.',
    activationDone: 'The instance is active.',
    adminStructureTitle: 'Tenant admin structure initialized',
    adminStructurePending: 'Synchronize `system_admin` and the required starter modules.',
    adminStructureDone: 'The protected tenant admin structure has been initialized.',
  },
  completion: {
    ready: 'Setup complete. You can now switch into normal operations.',
    pending: 'Setup is not complete yet. Finish the two required steps first.',
  },
  actions: {
    completeSetup: 'Complete setup',
    openOperations: 'Open operations view',
    backToOverview: 'Back to overview',
  },
} as const;
