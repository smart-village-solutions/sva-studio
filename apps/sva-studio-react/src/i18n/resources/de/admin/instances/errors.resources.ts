export const errorsInstancesAdminDEResources = {
  unauthorized: 'Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.',
  recoveryRunning:
    'Die Sitzung wird gerade wiederhergestellt oder ist instabil. Bitte erneut anmelden.',
  forbidden: 'Keine Berechtigung für die Instanzverwaltung.',
  csrfValidationFailed:
    'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.',
  reauthRequired: 'Für diese Aktion ist eine frische Re-Authentisierung erforderlich.',
  conflict: 'Die gewünschte Änderung steht im Konflikt mit dem aktuellen Instanzstatus.',
  databaseUnavailable:
    'Die Registry konnte wegen eines Datenbankproblems nicht verarbeitet werden.',
  databaseOrSchemaDrift:
    'Die Instanzverwaltung ist derzeit wegen einer Datenbank- oder Migrationsabweichung eingeschränkt.',
  registryOrProvisioningDrift:
    'Für diese Instanz liegt ein Registry- oder Provisioning-Drift vor. Bitte Keycloak-Status, Preflight und letzten Run gemeinsam prüfen.',
  keycloakReconcile:
    'Der Keycloak-Abgleich ist fehlgeschlagen oder erfordert manuelle Nacharbeit. Bitte den Reconcile-Befund mit Request-ID prüfen.',
  tenantAuthClientSecretMissing: 'Für diese Instanz ist noch kein Tenant-Client-Secret hinterlegt.',
  tenantAdminClientNotConfigured:
    'Für diese Instanz ist noch kein Tenant-Admin-Client hinterlegt. Pflegen Sie den Client-Vertrag und speichern Sie die Instanz.',
  tenantAdminClientSecretMissing:
    'Für diese Instanz fehlt noch das Tenant-Admin-Client-Secret. Hinterlegen Sie es in der Detailseite und speichern Sie erneut.',
  keycloakUnavailable: 'Keycloak konnte nicht erreicht oder nicht abgeglichen werden.',
  encryptionNotConfigured:
    'Die notwendige Feldverschlüsselung für Tenant-Secrets ist nicht konfiguriert.',
} as const;
