export const contentDEErrors = {
  forbidden: 'Unzureichende Berechtigungen für diese Inhaltsaktion.',
  csrfValidationFailed:
    'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.',
  rateLimited: 'Zu viele Anfragen in kurzer Zeit. Bitte kurz warten und erneut versuchen.',
  notFound: 'Der angeforderte Inhalt wurde nicht gefunden.',
  databaseUnavailable:
    'Die Inhaltsdaten konnten wegen eines Datenbankproblems nicht verarbeitet werden.',
  invalidRequest: 'Der Inhalt enthält ungültige oder unvollständige Daten.',
  staleMainserverContext:
    'Der Organisations- oder Principal-Kontext hat sich geändert. Laden Sie den aktuellen Kontext neu und prüfen Sie Ihre Eingaben, bevor Sie erneut speichern.',
  requestIdLabel: 'Fehlerreferenz:',
  copyRequestId: 'Referenz kopieren',
  requestIdCopied: 'Kopiert',
  requestIdCopyFailed: 'Kopieren fehlgeschlagen',
} as const;
