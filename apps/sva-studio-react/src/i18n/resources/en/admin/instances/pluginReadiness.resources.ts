export const pluginReadinessInstancesAdminENResources = {
  title: 'Plugin readiness',
  subtitle:
    'Shows the tenant lifecycle and check status for every active plugin with a lifecycle contract.',
  loading: 'Loading plugin status…',
  empty: 'This instance has no active plugins with a lifecycle contract.',
  error: 'The plugin status could not be loaded or updated: {{message}}',
  status: {
    pending: 'Pending',
    ready: 'Ready',
    degraded: 'Degraded',
    blocked: 'Blocked',
  },
  policy: {
    label: 'Activation policy: {{policy}}',
    optional: 'Optional',
    automatic: 'Automatic',
    required: 'Required',
  },
  repair: 'Start repair',
  repairRunning: 'Starting repair…',
  repairAriaLabel: 'Start repair for plugin {{pluginId}}',
} as const;
