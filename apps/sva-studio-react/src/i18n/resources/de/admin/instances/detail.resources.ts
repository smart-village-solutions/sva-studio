export const detailInstancesAdminDEResources = {
  title: 'Instanzdetails',
  subtitle: 'Pflegen Sie Registry- und Keycloak-Grundeinstellungen der ausgewählten Instanz.',
  empty: 'Wählen Sie eine Instanz aus der Liste, um Details, Realm-Status und Läufe anzuzeigen.',
  actions: {
    openDoctor: 'Doctor öffnen',
  },
  tabs: {
    betrieb: 'Betrieb',
    doctor: 'Doctor',
    einstellungen: 'Einstellungen',
  },
  primaryHostname: 'Primärer Hostname: {{value}}',
  parentDomain: 'Parent-Domain: {{value}}',
  status: 'Status: {{value}}',
  runs: 'Provisioning-Läufe',
  runStatus: 'Laufstatus: {{value}}',
  noRuns: 'Für diese Instanz liegen noch keine Läufe vor.',
} as const;
