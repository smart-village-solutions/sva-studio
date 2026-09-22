export const invitationInstancesAdminDEResources = {
  title: 'Account-Einladung',
  open: 'Account-Einladung anpassen',
  dialogTitle: 'Account-Einladung anpassen',
  description:
    'Keycloak erzeugt weiterhin den sicheren Passwortlink und versendet die E-Mail. Hier pflegen Sie nur den instanzbezogenen Text.',
  status: 'Realm-Projektion: {{status}}',
  projection: {
    default: 'SVA-Standard',
    in_sync: 'bestätigt',
    drifted: 'abweichend',
    unavailable: 'nicht prüfbar',
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
  reset: 'Auf SVA-Standard zurücksetzen',
  resetConfirm: 'Individualvorlage wirklich entfernen und auf den SVA-Standard zurücksetzen?',
  saved: 'Die Vorlage wurde gespeichert. Der Projektionsstatus wurde neu geladen.',
  saveFailed: 'Die Vorlage konnte nicht gespeichert oder projiziert werden.',
  invalid: 'Die Vorlage ist ungültig.',
} as const;
