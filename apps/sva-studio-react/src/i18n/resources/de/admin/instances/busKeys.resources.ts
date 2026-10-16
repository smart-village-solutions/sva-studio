export const busKeysInstancesAdminDEResources = {
  title: 'Bus-API-Keys',
  requestId: 'Request-ID:',
  inactive: 'Neue Keys und Reaktivierungen sind nur für aktive Instanzen möglich.',
  notActivatable: 'Nur gesperrte, noch gültige Keys können reaktiviert werden.',
  keyNotFound:
    'Der Key gehört nicht zu dieser Instanz oder ist nicht mehr vorhanden. Bitte Metadaten prüfen.',
  accessDenied:
    'Die aktuelle Sitzung ist für diese Aktion nicht berechtigt. Bitte Zugriff oder Anmeldung prüfen.',
  create: 'Key erstellen',
  rotation:
    'Rotation: Neuen Key erstellen, im Client verteilen und prüfen, danach den alten Key bewusst sperren. Bestehende Keys bleiben beim Erstellen gültig.',
  formDescription:
    'Ort und Instanz-ID stammen aus der Instanzverwaltung. Kontakt und Initialen werden bei jeder Erstellung bestätigt.',
  keyId: 'Key-ID',
  contact: 'Kontakt-E-Mail des Kunden',
  createdBy: 'Erstellerinitialen',
  createdAt: 'Erstellt am (UTC)',
  validThrough: 'Gültig bis einschließlich',
  status: 'Status',
  actions: 'Aktionen',
  utcExplanation:
    'Der Key läuft am Beginn des Folgetags in UTC ab. Exakter Ablauf:',
  noExpiry: 'Ohne Ablaufdatum',
  missing: 'Nicht hinterlegt',
  active: 'Aktiv',
  revoked: 'Gesperrt',
  expired: 'Abgelaufen',
  loading: 'Bus-API-Keys werden geladen …',
  empty: 'Keine Bus-API-Keys für diese Instanz vorhanden.',
  loadError: 'Bus-API-Keys konnten nicht geladen werden. Bitte erneut laden.',
  notConfigured: 'Die Bus-Anbindung ist für diese Studio-Umgebung noch nicht konfiguriert.',
  invalid:
    'Bitte eine gültige Kontakt-E-Mail, Initialen aus Buchstaben und einen noch zukünftigen Ablauf angeben.',
  reauth: 'Bitte erneut anmelden und den Vorgang anschließend bewusst wiederholen.',
  reauthAction: 'Erneut anmelden',
  unavailable:
    'Der Bus-Dienst ist derzeit nicht erreichbar oder hat die Anfrage abgelehnt. Bitte die Metadaten neu laden und den aktuellen Status prüfen.',
  revokeOutcomeUnknown:
    'Die Sperrung konnte nicht bestätigt werden. Die Metadaten werden neu geladen. Bitte den aktuellen Status des Keys prüfen, bevor du die Sperrung erneut versuchst.',
  activateOutcomeUnknown:
    'Die Reaktivierung konnte nicht bestätigt werden. Die Metadaten werden neu geladen. Bitte den aktuellen Status des Keys prüfen, bevor du die Reaktivierung erneut versuchst.',
  outcomeUnknown:
    'Der Ausgang konnte nicht bestätigt werden. Ein Key kann bereits erstellt oder geändert worden sein. Die Metadaten werden neu geladen. Einen nicht nutzbaren neuen Key bewusst sperren und ersetzen; nicht ungeprüft erneut erstellen.',
  auditWarning:
    'Die Bus-Änderung war erfolgreich, aber das Studio-Audit konnte nicht gespeichert werden. Den Vorgang nicht wiederholen; die Request-ID der Antwort dient zur Klärung.',
  reload: 'Metadaten neu laden',
  activate: 'Reaktivieren',
  revoke: 'Sperren',
  revokeConfirmation:
    'Der ausgewählte Key kann danach keine Proxy-Anfragen mehr autorisieren. Wurde ein Ersatz-Key bereits im Client geprüft?',
  confirmRevoke: 'Key jetzt sperren',
  cancel: 'Abbrechen',
  close: 'Schließen',
  closeTitle: 'API-Key kopiert?',
  closeDescription:
    'Dieser API-Key ist nur einmal sichtbar. Kopiere ihn vor dem Schließen, da er danach nicht erneut angezeigt werden kann. Hast du ihn kopiert?',
  closeCopied: 'Ja, ich habe den API-Key kopiert',
  returnToCopy: 'Nein, ich muss den API-Key noch kopieren',
  oneTimeTitle: 'Key einmalig übernehmen',
  oneTimeDescription:
    'Dieser Klartext-Key wird nur jetzt angezeigt. Sicher im vorgesehenen Client hinterlegen. Nach dem Schließen oder Instanzwechsel kann er nicht erneut angezeigt werden.',
  copy: 'Key kopieren',
  copied: 'Key in die Zwischenablage kopiert.',
  copyError: 'Der Key konnte nicht kopiert werden. Bitte den angezeigten Wert manuell übernehmen.',
} as const;
