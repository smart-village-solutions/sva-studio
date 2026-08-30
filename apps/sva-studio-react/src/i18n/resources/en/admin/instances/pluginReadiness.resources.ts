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
  aggregate: {
    unavailable: 'The operational status of required plugins could not yet be confirmed.',
    ready: 'All required plugins are ready: {{plugins}}.',
    degraded: 'At least one required plugin is degraded: {{plugins}}.',
    blocked: 'At least one required plugin is not ready yet: {{plugins}}.',
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
  activeJob: 'Open active job',
  activeJobAriaLabel: 'Open active job for plugin {{pluginId}}',
} as const;
