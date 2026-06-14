export const configurationInstancesAdminENResources = {
  title: 'Configuration status',
  labels: {
    lifecycle: 'Lifecycle',
    requirements: 'Satisfied requirements',
    requirementsValue: '{{satisfied}} / {{total}} requirements satisfied',
    blockingIssues: 'Blocking issues',
    warnings: 'Warnings',
  },
  overall: {
    complete: 'Complete',
    degraded: 'Warnings',
    incomplete: 'Incomplete',
    unknown: 'Unchecked',
  },
  summary: {
    complete: {
      title: 'Configuration complete',
      body: 'All canonical Keycloak requirements for this instance are currently satisfied.',
    },
    degraded: {
      title: 'Configuration operational with warnings',
      body: 'All required checks pass, but operational warnings or deviations remain.',
    },
    incomplete: {
      title: 'Configuration incomplete',
      body: '{{count}} canonical requirements are still missing or incorrect.',
    },
    unknown: {
      title: 'Configuration status not verified',
      body: 'The canonical requirements have not been checked against Keycloak completely yet.',
      keycloakUnavailable:
        'The canonical requirements could not be checked against Keycloak reliably at the moment.',
    },
    expectedArtifacts: {
      title: 'Configuration prepared',
      pending:
        'For a new realm, missing Keycloak artifacts are expected before the first technical run. Review the contract and then execute the next step.',
      running:
        'The new realm is currently being built technically. Missing Keycloak artifacts are not treated as current blockers until core realm bootstrap completes.',
    },
  },
} as const;
