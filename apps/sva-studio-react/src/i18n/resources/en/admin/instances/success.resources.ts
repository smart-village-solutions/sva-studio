export const successInstancesAdminENResources = {
  title: 'Instance saved',
  summary:
    'The instance {{instanceId}} has been created in the registry. Current status: {{status}}.',
  actions: {
    openDetail: 'Open detail page',
    backToOverview: 'Back to overview',
  },
  nextSteps: {
    openSetup:
      'Open the dedicated setup flow to finish provisioning, activation, and the tenant admin structure.',
    runProvisioning: 'Run the Keycloak reconciliation for realm {{realm}} there.',
    activate: 'Activate the instance only after provisioning succeeded for {{hostname}}.',
  },
} as const;
