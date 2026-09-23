export const cockpitInstancesAdminENResources = {
  eyebrow: 'Control Tower',
  title: 'Operational overview',
  subtitle:
    'Current state, dominant findings, and the next meaningful operator action at a glance.',
  setup: {
    phase: 'Setup · Phase 2 of 2',
    title: 'Finish setting up the instance',
    subtitle:
      'The instance data has been saved. Continue through the technical steps to manual activation.',
    ariaLabel: 'Instance setup progress',
    secondaryTitle: 'Operations, Doctor, and settings',
    secondaryDescription:
      'These advanced areas remain available but are secondary while initial setup is in progress.',
    technical: {
      title: 'Technical substeps',
      keycloak: 'Keycloak configuration',
      tenantAdmin: 'Tenant administrator',
      tenantIam: 'Local IAM reconciliation',
    },
    steps: {
      prepare: {
        title: 'Prepare provisioning',
        description: 'Check prerequisites and the current change plan.',
      },
      confirm: {
        title: 'Confirm changes',
        description: 'Explicitly approve the reviewed plan for execution.',
      },
      provision: {
        title: 'Technical provisioning',
        description: 'Set up the realm, clients, secrets, and tenant administrator.',
      },
      verify: {
        title: 'Verify operational readiness',
        description: 'Check tenant IAM, modules, and technical evidence.',
      },
      activate: {
        title: 'Activate',
        description: 'Manually release the fully verified instance.',
      },
    },
  },
  identity: 'Instance',
  currentState: 'Overall state',
  configurationSnapshot: 'Configuration',
  lifecycle: 'Lifecycle',
  primaryAction: 'Control',
  primaryActionTitle: 'Recommended next action',
  secondaryActions: 'Specialized and follow-up actions',
  anomaliesTitle: 'Open findings',
  anomaliesSubtitle: 'Condensed anomalies before you dive into operations or history.',
  anomaliesEmpty: 'No dominant deviations. The instance currently has no prioritized finding.',
  evidenceTitle: 'Dominant evidence',
  evidenceSubtitle: 'Source, freshness, and provenance of the leading first-glance state.',
  checkedAt: 'Trusted evidence: {{value}}',
  noEvidenceTimestamp: 'No trusted timestamp available.',
  tabsAriaLabel: 'Instance detail work areas',
  tabs: {
    overview: 'Overview',
    configuration: 'Configuration',
    modules: 'Modules',
    operations: 'Operations',
    history: 'History',
  },
  overall: {
    ready: 'Operational',
    degraded: 'Degraded',
    blocked: 'Blocked',
    unknown: 'Unclear',
  },
  evidence: {
    tenantIam: 'Tenant IAM operations',
    preflight: 'Keycloak preflight',
    provisioning: 'Latest provisioning run',
    registry: 'Registry baseline',
  },
  sources: {
    accessProbe: 'Source: tenant IAM access probe',
    reconcile: 'Source: role reconcile',
    keycloakStatus: 'Source: Keycloak structural state',
    provisioningRun: 'Source: Keycloak provisioning run',
    registry: 'Source: registry',
    diagnostics: 'Source: runtime diagnostics',
  },
  anomalies: {
    configuration: 'Tenant IAM configuration',
    access: 'Tenant IAM access',
    reconcile: 'Tenant IAM reconcile',
    provisioning: 'Provisioning',
    diagnostics: 'Diagnostics',
  },
} as const;
