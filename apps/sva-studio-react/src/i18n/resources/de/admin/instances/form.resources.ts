export const formInstancesAdminDEResources = {
  title: 'Neue Instanz anlegen',
  subtitle:
    'Die Anlage startet denselben Provisioning-Vertrag wie der Ops-Pfad und hinterlegt Realm-Grundeinstellungen für Keycloak.',
  instanceId: 'Instanz-ID',
  displayName: 'Anzeigename',
  parentDomain: 'Parent-Domain',
  authRealm: 'Auth-Realm',
  authClientId: 'Auth-Client-ID',
  authIssuerUrl: 'Auth-Issuer-URL',
  authClientSecret: 'Tenant-Client-Secret',
  authClientSecretConfigured: 'Secret bereits konfiguriert',
  authClientSecretMissing: 'Noch kein Secret hinterlegt',
  authClientSecretHint: 'Leer lassen, um das bestehende Secret unverändert zu lassen.',
  authClientSecretGeneratedHint:
    'Bei neuen Realms wird das Secret beim Provisioning automatisch erzeugt und danach in Studio gespeichert.',
  authClientSecretGeneratedDuringProvisioning: 'Wird beim Provisioning automatisch erzeugt',
  tenantAdminClientTitle: 'Tenant-Admin-Client',
  tenantAdminClientSubtitle:
    'Client-Vertrag und Secret für tenant-spezifische Verwaltungsoperationen.',
  tenantAdminClientId: 'Tenant-Admin-Client-ID',
  tenantAdminClientSecret: 'Tenant-Admin-Client-Secret',
  tenantAdminClientSecretConfigured: 'Secret bereits konfiguriert',
  tenantAdminClientSecretMissing: 'Secret fehlt noch',
  tenantAdminClientSecretGeneratedHint:
    'Bei neuen Realms wird das Tenant-Admin-Client-Secret beim Provisioning automatisch erzeugt und danach in Studio gespeichert.',
  tenantAdminClientSecretHint:
    'Leer lassen, um das bestehende Tenant-Admin-Client-Secret unverändert zu lassen.',
  tenantAdminTitle: 'Initialer Tenant-Admin',
  tenantAdminSubtitle: 'Diese Daten werden für den Bootstrap des Realm-Admins genutzt.',
  tenantAdminUsername: 'Admin-Benutzername',
  tenantAdminEmail: 'Admin-E-Mail',
  tenantAdminFirstName: 'Admin-Vorname',
  tenantAdminLastName: 'Admin-Nachname',
  wasteManagementEnabled: 'Abfallmanagement konfigurieren',
  wasteManagementSubtitle:
    'Instanzbezogene Waste-Datenquelle und technische Zugangsdaten für das Waste-Plugin.',
  wasteManagementProjectUrl: 'Supabase-Projekt-URL',
  wasteManagementSchemaName: 'Schema-Name',
  wasteManagementProvider: 'Provider',
  wasteManagementDatabaseUrl: 'Datenbank-URL',
  wasteManagementDatabaseUrlConfigured: 'Bereits konfiguriert',
  wasteManagementDatabaseUrlHint:
    'Leer lassen, um die bestehende Waste-Datenbank-URL unverändert zu lassen.',
  wasteManagementDatabaseUrlCreateHint:
    'Optional beim Anlegen. Kann später in der Instanzkonfiguration ergänzt werden.',
  wasteManagementServiceRoleKey: 'Service-Role-Key',
  wasteManagementServiceRoleKeyConfigured: 'Bereits konfiguriert',
  wasteManagementServiceRoleKeyHint:
    'Leer lassen, um den bestehenden Waste-Service-Role-Key unverändert zu lassen.',
  wasteManagementServiceRoleKeyCreateHint:
    'Optional beim Anlegen. Kann später in der Instanzkonfiguration ergänzt werden.',
} as const;
