export const diagnosticsAccountDEResources = {
  sessionRecovery:
    'Die Sitzung konnte nicht stabil wiederhergestellt werden. Bitte erneut anmelden.',
  actorResolutionOrMembership:
    'Ihr Konto ist technisch erreichbar, aber die fachliche Zuordnung oder Instanz-Mitgliedschaft ist unvollständig.',
  databaseOrSchemaDrift:
    'Die Kontodaten sind derzeit wegen einer Datenbank- oder Migrationsabweichung nur eingeschränkt verfügbar.',
  registryOrProvisioningDrift:
    'Die Kontodaten sind derzeit wegen eines Registry- oder Provisioning-Drifts nur eingeschränkt verfügbar.',
  keycloakDependency:
    'Die Kontoansicht kann derzeit nicht vollständig geladen werden, weil Keycloak oder ein nachgelagerter Rollenabgleich nicht stabil verfügbar ist.',
  requestId: 'Request-ID: {{requestId}}',
} as const;
