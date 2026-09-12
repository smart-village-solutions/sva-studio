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
  automated: {
    title: 'Tenant provisioning accepted',
    summary:
      'Instance {{instanceId}} is being provisioned by the server. Run ID: {{runId}}. Closing this page does not interrupt the operation.',
    nextSteps: {
      observe: 'Open the detail page to observe the current provisioning step.',
      waitForTerminal:
        'Creation is complete only after both the instance and the run have reached “Active”.',
      retryOnFailure:
        'Diagnostic artifacts are retained after a terminal failure; an authorized retry resumes the run.',
    },
  },
} as const;
