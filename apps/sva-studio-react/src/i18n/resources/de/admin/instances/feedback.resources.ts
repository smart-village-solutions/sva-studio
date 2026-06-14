export const feedbackInstancesAdminDEResources = {
  preflightUpdated: 'Vorbedingungen wurden aktualisiert.',
  keycloakStatusUpdated: 'Keycloak-Status wurde aktualisiert.',
  provisioningPreviewUpdated: 'Provisioning-Vorschau wurde aktualisiert.',
  provisioningQueued: 'Provisioning-Auftrag wurde gespeichert und zur Abarbeitung vorgemerkt.',
  instanceActivated: 'Die Instanz wurde aktiviert.',
  tenantIamProbeUpdated: 'Tenant-IAM-Rechteprobe wurde aktualisiert.',
  workerEnvMissing:
    'Der Provisioning-Worker kann Keycloak derzeit nicht technisch prüfen. Im laufenden Prozess fehlt {{envName}}.',
  workerProjectionHint:
    'Die angezeigten Vorbedingungen und der Keycloak-Status sind derzeit nur eine Registry-basierte Vorabschätzung. Ein echter Live-Abgleich erfolgt erst im Provisioning-Worker.',
  workerUnavailable:
    'Für diesen Provisioning-Auftrag hat noch kein Worker übernommen. Bitte den Provisioning-Worker prüfen oder lokal starten und den Lauf danach erneut anstoßen.',
} as const;
