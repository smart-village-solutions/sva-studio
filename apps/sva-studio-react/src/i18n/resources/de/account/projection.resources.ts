export const projectionAccountDEResources = {
  warningTitle: 'Profilstatus erfordert manuelle Prüfung.',
  warningBody:
    'Die Profil- oder Rollenprojektion ist derzeit nicht vollständig belastbar. Bitte die Zuordnung im IAM/Keycloak-Verbund prüfen.',
  statusLine: 'Projektionsstatus: {{value}}',
  editabilityLine: 'Bearbeitbarkeit: {{value}}',
  diagnosticCodesLine: 'Diagnosecodes: {{value}}',
  mappingStatus: {
    mapped: 'Zugeordnet',
    unmapped: 'Nicht zugeordnet',
    manualReview: 'Manuelle Prüfung',
  },
  editability: {
    editable: 'Bearbeitbar',
    readOnly: 'Schreibgeschützt',
    blocked: 'Blockiert',
  },
} as const;
