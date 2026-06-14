export const instanceModulesInstancesAdminDEResources = {
  title: 'Instanzmodule',
  subtitle: 'Module pro Instanz zuweisen, entziehen und die zugehörige IAM-Basis neu aufbauen.',
  empty: 'Wählen Sie eine Instanz aus, um Modulzuweisungen zu verwalten.',
  instanceSelect: {
    label: 'Instanz auswählen',
    hint: 'Die Modulverwaltung arbeitet immer auf einer konkreten Instanz.',
    placeholder: 'Bitte Instanz wählen',
  },
  assigned: {
    title: 'Zugewiesene Module',
    subtitle: 'Diese Module sind für die gewählte Instanz aktiv.',
    empty: 'Der Instanz sind aktuell keine Module zugewiesen.',
  },
  available: {
    title: 'Verfügbare Module',
    subtitle: 'Diese Module können der gewählten Instanz zusätzlich zugewiesen werden.',
    empty: 'Alle bekannten Module sind dieser Instanz bereits zugewiesen.',
  },
  detail: {
    title: 'IAM-Basis der Module',
    subtitle:
      'Zeigt alle global bekannten Module mit aktiviertem oder deaktiviertem Mandanten-Status.',
    table: {
      module: 'Modul',
      status: 'Status',
      description: 'Beschreibung',
    },
    status: {
      active: 'Aktiv',
      inactive: 'Deaktiviert',
    },
    descriptionFallback: 'Keine Modulbeschreibung hinterlegt.',
  },
  guidance: {
    title: 'Semantik der Freigaben',
    subtitle:
      'Module schalten Fachbereiche frei. Rollen und direkte Berechtigungen steuern, welche Aktionen innerhalb dieser Bereiche erlaubt sind.',
    moduleTitle: 'Module schalten Bereiche frei',
    moduleBody:
      'Eine Modulzuweisung aktiviert einen Fachbereich für die Instanz. Sichtbarkeit und Routing orientieren sich an Modulzuweisung und passendem Leserecht.',
    roleTitle: 'Rollen vergeben Berechtigungen',
    roleBody:
      'Rollen bündeln Berechtigungen wie Lesen, Anlegen oder Ändern. Die angezeigten Modulrechte kommen direkt aus dem kanonischen Modulvertrag.',
  },
  module: {
    permissions: 'Berechtigungen: {{value}}',
    roles: 'Geschützte Systemrollen: {{value}}',
  },
  actions: {
    assign: 'Modul zuweisen',
    revoke: 'Modul entziehen',
    seedIamBaseline: 'IAM-Basis neu aufbauen',
    bootstrapAdminStructure: 'Tenant-Admin-Struktur initialisieren',
  },
  confirmRevoke: {
    title: 'Modul wirklich entziehen?',
    description:
      'Das Modul {{moduleId}} wird der Instanz {{instanceId}} entzogen. Zugehörige Berechtigungen und IAM-Basis werden dabei entfernt.',
    confirm: 'Modul entziehen',
    cancel: 'Abbrechen',
  },
  confirmBootstrap: {
    title: 'Tenant-Admin-Struktur wirklich initialisieren?',
    description:
      'Für die Instanz {{instanceId}} werden `system_admin` und die IAM-Basis der aktuell zugewiesenen Module synchronisiert. Zusätzliche Legacy-Standardrollen werden dabei nicht angelegt.',
    confirm: 'Tenant-Admin-Struktur initialisieren',
    cancel: 'Abbrechen',
  },
} as const;
