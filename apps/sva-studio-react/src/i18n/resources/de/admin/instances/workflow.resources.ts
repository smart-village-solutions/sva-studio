export const workflowInstancesAdminDEResources = {
  title: 'Was ist noch offen?',
  subtitle: 'Dieser Ablauf zeigt, welche technischen Schritte nach dem Speichern noch nötig sind.',
  badges: {
    done: 'Erledigt',
    current: 'Als Nächstes',
    blocked: 'Blockiert',
    pending: 'Ausstehend',
  },
  registry: {
    title: 'Registry gespeichert',
    description: 'Die Instanz liegt in Studio vor. Aktueller Gesamtstatus: {{status}}.',
  },
  keycloakAccess: {
    title: 'Technischer Keycloak-Zugriff',
    ready: 'Der technische Zugriff auf Keycloak wurde erfolgreich geprüft.',
    pending: 'Die technische Erreichbarkeit und Admin-Berechtigung sollte jetzt geprüft werden.',
    blocked:
      'Keycloak ist aktuell nicht erreichbar oder die technische Prüfung ist fehlgeschlagen.',
  },
  realm: {
    title: 'Realm prüfen',
    newRealm: 'Für diesen Flow wird der Realm im Provisioning neu angelegt.',
    ready: 'Der erwartete Realm ist vorhanden.',
    blocked: 'Der konfigurierte Realm passt nicht zum gewählten Modus oder ist nicht erreichbar.',
    pending: 'Der Realm sollte jetzt gegen die gespeicherte Konfiguration geprüft werden.',
  },
  client: {
    title: 'Client prüfen',
    ready: 'Der erwartete Tenant-Client wurde gefunden.',
    blocked: 'Der Client konnte wegen fehlendem Keycloak-Zugriff noch nicht geprüft werden.',
    pending: 'Der Tenant-Client sollte per Vorschau oder Statuslauf geprüft werden.',
  },
  tenantAdminClient: {
    title: 'Tenant-Admin-Client prüfen',
    notConfigured: 'In der Registry ist noch kein Tenant-Admin-Client hinterlegt.',
    secretMissing:
      'Der Tenant-Admin-Client ist in der Registry vorhanden, aber der Secret-Vertrag ist noch unvollständig.',
    ready: 'Tenant-Admin-Client und Secret-Vertrag entsprechen dem erwarteten Zustand.',
    blocked:
      'Der Tenant-Admin-Client konnte wegen fehlendem Keycloak-Zugriff noch nicht geprüft werden.',
    pending:
      'Der Tenant-Admin-Client sollte jetzt per Provisioning geprüft oder abgeglichen werden.',
  },
  tenantSecret: {
    title: 'Tenant-Secret prüfen',
    missing:
      'Es ist noch kein Tenant-Client-Secret gespeichert. Dieser Schritt blockiert technische Abgleiche.',
    generatedDuringProvisioning:
      'Für neue Realms wird das Tenant-Client-Secret erst beim Provisioning erzeugt und danach gespeichert.',
    ready: 'Das Tenant-Secret ist gespeichert und technisch lesbar.',
    blocked: 'Das Secret konnte noch nicht gegen Keycloak geprüft werden.',
    pending: 'Das Secret ist vorhanden, muss aber noch technisch gegen Keycloak geprüft werden.',
  },
  tenantAdmin: {
    title: 'Tenant-Admin prüfen',
    missing:
      'Es ist noch kein Tenant-Admin hinterlegt. Dieser Schritt bleibt bis zur Pflege blockiert.',
    ready: 'Tenant-Admin und system_admin-Rolle sind vorhanden.',
    blocked: 'Der Tenant-Admin konnte wegen fehlendem Keycloak-Zugriff noch nicht geprüft werden.',
    pending:
      'Der Tenant-Admin ist gespeichert, muss aber noch im Realm geprüft oder neu gesetzt werden.',
  },
  provisioning: {
    title: 'Provisioning ausführen',
    ready: 'Der letzte Keycloak-Provisioning-Lauf war erfolgreich.',
    running: 'Der Keycloak-Provisioning-Lauf läuft gerade.',
    failed: 'Der letzte Keycloak-Provisioning-Lauf ist fehlgeschlagen und muss geprüft werden.',
    pending:
      'Nach Prüfung von Realm, Client und Admin kann jetzt das Provisioning ausgeführt werden.',
  },
  activation: {
    title: 'Instanz aktivieren',
    ready: 'Die Instanz ist aktiv und betriebsbereit.',
    current: 'Provisioning ist erfolgreich. Die Instanz kann jetzt aktiviert werden.',
    pending: 'Die Aktivierung bleibt gesperrt, bis das Provisioning erfolgreich abgeschlossen ist.',
  },
} as const;
