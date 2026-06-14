export const tenantIamInstancesAdminENResources = {
  title: 'Tenant IAM operations',
  subtitle: 'Separate view of configuration, access probe, and reconciliation for this instance.',
  requestId: 'Request id: {{value}}',
  axes: {
    configuration: 'Configuration',
    access: 'Access probe',
    reconcile: 'Reconcile',
  },
  summaries: {
    configurationReady: 'Tenant IAM structure is fully present.',
    configurationDegraded: 'Tenant IAM structure is incomplete or drifting.',
    overallReady: 'Tenant IAM is operational.',
    overallBlocked: 'Tenant IAM is blocked.',
    overallDegraded: 'Tenant IAM is degraded.',
    overallUnknown: 'Tenant IAM evidence is incomplete.',
  },
} as const;
