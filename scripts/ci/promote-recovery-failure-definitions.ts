export const promoteRecoveryFailureDefinitions = {
  PROMOTE_RECOVERY_REASON_REQUIRED: {
    summary: 'Der Recovery-Modus wurde ohne dokumentierten Grund angefordert.',
    retryable: false,
    nextAction: 'Den Recovery-Grund dokumentieren und das geschützte Environment erneut freigeben.',
  },
  PROMOTE_RECOVERY_CONTEXT_INVALID: {
    summary: 'Der Recovery-Kontext ist unvollständig oder nicht vertrauenswürdig.',
    retryable: false,
    nextAction:
      'Vorherigen Live-Digest, versionierte Config-Revision und dokumentierte Retry-Ursache prüfen.',
  },
} as const;
