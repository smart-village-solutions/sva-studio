export const detailInstancesAdminENResources = {
  title: 'Instance details',
  subtitle: 'Maintain registry and Keycloak base settings for the selected instance.',
  empty: 'Select an instance from the list to inspect details, realm status, and runs.',
  actions: {
    openDoctor: 'Open Doctor',
  },
  tabs: {
    betrieb: 'Operations',
    doctor: 'Doctor',
    einstellungen: 'Settings',
  },
  primaryHostname: 'Primary hostname: {{value}}',
  parentDomain: 'Parent domain: {{value}}',
  status: 'Status: {{value}}',
  runs: 'Provisioning runs',
  runStatus: 'Run status: {{value}}',
  noRuns: 'No provisioning runs recorded for this instance yet.',
} as const;
