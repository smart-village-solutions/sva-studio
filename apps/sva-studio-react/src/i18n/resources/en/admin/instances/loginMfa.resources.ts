export const loginMfaInstancesAdminENResources = {
  title: 'Authentication policy',
  description:
    'Choose whether your organisation requires an authenticator code at ordinary login. Sensitive actions still require fresh MFA.',
  label: 'Ordinary login MFA',
  optional: 'Optional',
  required: 'Required',
  unverified: 'Not verified',
  enrollment:
    'Users enroll and manage their authenticator in Keycloak. Optional mode still asks enrolled users for their code.',
  pending: 'Pending verification',
  applied: 'Applied and verified',
  failed: 'Application failed. Save again to retry, or contact your administrator.',
  appliedMode: 'Last verified policy: {{mode}}',
  save: 'Save policy',
  loading: 'Loading authentication policy…',
  error: 'The policy could not be loaded or saved. Reload and try again.',
} as const;
