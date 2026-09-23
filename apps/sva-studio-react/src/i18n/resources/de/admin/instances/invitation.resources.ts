export const invitationInstancesAdminDEResources = {
  title: 'Account-Einladung',
  open: 'Account-Einladung anpassen',
  dialogTitle: 'Account-Einladung anpassen',
  description:
    'Keycloak erzeugt weiterhin den sicheren Passwortlink und versendet die E-Mail. Hier pflegen Sie nur den instanzbezogenen Text.',
  serverDescription:
    'Diese Vorlage gilt für alle Instanzen ohne eigenen Text. Keycloak erzeugt weiterhin den sicheren Passwortlink und versendet die E-Mail.',
  source: 'Verwendete Vorlage: {{source}}',
  sources: {
    instance: 'Instanzvorlage',
    server: 'Servervorlage',
    sva_default: 'SVA-Standard',
  },
  tokens:
    'Erlaubte Platzhalter: {{tenantName}}, {{passwordSetupLink}}, {{tenantHomepageLink}}, {{linkExpiresIn}}. Der Passwortlink muss genau einmal im Nachrichtentext stehen.',
  subject: 'Betreff',
  body: 'Nachrichtentext',
  passwordLinkLabel: 'Beschriftung des Passwortlinks',
  homepageLinkLabel: 'Beschriftung des Startseitenlinks',
  preview: 'Vorschau mit Beispieldaten',
  previewExpiry: '30 Minuten',
  save: 'Vorlage speichern',
  resetInstance: 'Servervorlage verwenden',
  resetInstanceConfirm: 'Die Instanzvorlage entfernen und künftig die Servervorlage verwenden?',
  resetServer: 'SVA-Standard verwenden',
  resetServerConfirm: 'Die Servervorlage entfernen und künftig den SVA-Standard verwenden?',
  saved: 'Die Vorlage wurde gespeichert.',
  saveConflict:
    'Die Vorlage wurde zwischenzeitlich geändert. Der aktuelle Stand wurde geladen; bitte prüfen Sie ihn und speichern Sie erneut.',
  saveFailed: 'Die Vorlage konnte nicht gespeichert werden.',
  invalid: 'Die Vorlage ist ungültig.',
  pageTitle: 'Templates',
  pageDescription: 'Textvorlagen dieser Studio-Installation verwalten.',
  loading: 'Vorlage wird geladen.',
  loadFailed: 'Die Vorlage konnte nicht geladen werden.',
  sampleTenantName: 'Beispiel-Tenant',
  sampleHomepageUrl: 'https://beispiel.invalid/',
} as const;
