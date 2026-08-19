export const promoteH4FailureDefinitions = {
  PROMOTE_LIVE_CONFIG_SEED_REJECTED: {
    summary: 'Der einmalige Staging-Config-Label-Uebergang wurde abgelehnt.',
    retryable: false,
    nextAction: 'Seed-Eingaben, Pre-Seed-Evidenz und aktuellen Live-Vertrag pruefen.',
  },
  PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED: {
    summary: 'Die Seed-Evidenz konnte nicht verlaesslich abgefragt werden.',
    retryable: true,
    nextAction: 'GitHub-Actions- und Live-Read-Zugriff pruefen und erneut ausfuehren.',
  },
} as const;
