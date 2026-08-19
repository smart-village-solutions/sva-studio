export const promoteH4FailureDefinitions = {
  PROMOTE_LIVE_CONFIG_SEED_REJECTED: {
    summary: 'Der einmalige Staging-Config-Label-Übergang wurde abgelehnt.',
    retryable: false,
    nextAction: 'Seed-Eingaben, Pre-Seed-Evidenz und aktuellen Live-Vertrag prüfen.',
  },
  PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED: {
    summary: 'Die Seed-Evidenz konnte nicht verlässlich abgefragt werden.',
    retryable: true,
    nextAction: 'GitHub-Actions- und Live-Read-Zugriff prüfen und erneut ausführen.',
  },
} as const;
