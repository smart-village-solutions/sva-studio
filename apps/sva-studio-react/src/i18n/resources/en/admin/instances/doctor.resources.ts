export const doctorInstancesAdminENResources = {
  serviceIdentity: 'Service: {{value}}',
  classification: 'Finding: {{value}}',
  classifications: {
    ready: 'operational',
    missing: 'object missing',
    forbidden: 'permission missing',
    unknown: 'insufficient evidence',
    unavailable: 'service unavailable',
    misconfigured: 'configuration invalid',
  },
  remediation: {
    missing: 'The Studio Provisioner must repair the missing Keycloak structure explicitly.',
    forbidden:
      'Check the sva-studio-tenant-iam role contract; do not substitute Provisioner credentials.',
    unknown:
      'Repeat the access probe with sva-studio-tenant-iam or inspect the Provisioner structural evidence.',
    unavailable: 'Restore Keycloak availability, then repeat the probe.',
    misconfiguredProvisioner:
      'The Studio Provisioner must reconcile the divergent technical configuration explicitly.',
    misconfiguredTenantIam:
      'Check the tenant-bound sva-studio-tenant-iam configuration and repeat the probe.',
  },
  warning: {
    title: 'Doctor has identified work that needs attention.',
  },
  steps: {
    overview: {
      title: 'Overview',
      subtitle: 'Shows green and non-green checks together before you jump into a repair.',
    },
    recommendation: {
      title: 'Recommended action',
      subtitle: 'The next meaningful action based on the current evidence.',
    },
    repair: {
      title: 'Run repair',
      subtitle: 'Trigger the matching corrective run or follow-up intervention deliberately.',
    },
    validation: {
      title: 'Validate',
      subtitle: 'Re-check the green prerequisites and confirm the new state.',
    },
  },
  checks: {
    configuration: 'Configuration',
    tenantAccess: 'Tenant access',
    tenantReconcile: 'Tenant reconcile',
    preflight: 'Preflight',
    latestRun: 'Latest technical run',
  },
  validation: {
    ready: 'Doctor currently sees no prioritized finding. Re-run validation whenever needed.',
    degraded: 'Doctor recommends validating preflight and live status again after the correction.',
    blocked:
      'Doctor found blocking issues and prioritizes the next action before normal operations continue.',
  },
  historyTitle: 'History',
  historySubtitle:
    'Technical runs remain available for diagnosis, but they intentionally follow overview, recommendation, repair, and validation.',
} as const;
