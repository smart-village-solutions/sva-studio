export const projectionAccountENResources = {
  warningTitle: 'Profile status requires manual review.',
  warningBody:
    'The profile or role projection is currently not fully reliable. Please verify the mapping across IAM and Keycloak.',
  statusLine: 'Projection status: {{value}}',
  editabilityLine: 'Editability: {{value}}',
  diagnosticCodesLine: 'Diagnostic codes: {{value}}',
  mappingStatus: {
    mapped: 'Mapped',
    unmapped: 'Unmapped',
    manualReview: 'Manual review',
  },
  editability: {
    editable: 'Editable',
    readOnly: 'Read only',
    blocked: 'Blocked',
  },
} as const;
