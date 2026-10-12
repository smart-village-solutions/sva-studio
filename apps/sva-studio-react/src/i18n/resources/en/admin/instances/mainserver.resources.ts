export const mainserverInstancesAdminENResources = {
  title: 'Mainserver interface',
  description: 'Central configuration for this active instance. The status describes the saved entry, not Mainserver reachability.',
  graphqlBaseUrl: 'GraphQL URL',
  oauthTokenUrl: 'OAuth token URL',
  enabled: 'Interface enabled',
  save: 'Save interface',
  saved: 'Interface saved and read back.',
  error: 'The Mainserver interface could not be loaded or saved. Please check its current state.',
  status: {
    loading: 'Loading',
    missing: 'Missing',
    disabled: 'Disabled',
    configured: 'Configured',
    error: 'Read error',
  },
} as const;
