export const emailVerificationInstancesAdminDEResources = {
  serverTitle: 'E-Mail-Bestätigung',
  serverDescription:
    'Dieser Standard gilt für Instanzen ohne eigenen Override. Speichern synchronisiert nur erbende Instanzen; eigene Vorlagen bleiben erhalten. Es wird keine E-Mail versendet.',
  resetServerConfirm:
    'Die allgemeine Bestätigungsvorlage auf den neutralen eingebauten Standard zurücksetzen?',
  resetInstance: 'Allgemeine Vorlage verwenden',

  reauthRequired:
    'Bitte erneut anmelden und die Vorlage danach neu öffnen. Ihr Entwurf bleibt bis dahin erhalten.',
  currentTexts: 'Zwischenzeitlich gespeicherte Texte',
  title: 'E-Mail-Bestätigung',
  open: 'E-Mail-Bestätigung anpassen',
  description:
    'Diese deutschen Texte gelten für Registrierung und Adressänderung. Die Vorlage wird im Studio gespeichert und mit dem Keycloak-Realm abgeglichen. Es wird keine E-Mail versendet.',
  realm: 'Ziel-Realm: {{realm}}',
  tokens:
    'Erlaubte Platzhalter: {{tenantName}}, {{verificationLink}}, {{linkExpiresIn}}. Der Bestätigungslink muss genau einmal im Nachrichtentext stehen.',
  previewLink: '[E-Mail-Adresse bestätigen]',
  htmlWarning:
    'Die vorhandene HTML-Fassung weicht von der automatisch erzeugten Darstellung ab. Beim Speichern wird sie aus dem Nachrichtentext neu erzeugt.',
  existingHtml: 'Vorhandene HTML-Fassung ansehen',
  replaceHtml: 'Vorhandene HTML-Fassung bewusst ersetzen',
  loadFailed:
    'Die wirksamen Bestätigungstexte konnten nicht geladen werden. Bitte schließen und erneut öffnen.',
  invalid:
    'Bitte prüfen Sie die Vorlage: genau ein Bestätigungslink, keine unbekannten Platzhalter, kein HTML und keine freien URLs.',
  saved: 'Die Vorlage wurde in Keycloak gespeichert und zurückgelesen.',
  conflict:
    'Die Texte wurden zwischenzeitlich geändert. Ihr Entwurf bleibt erhalten. Die aktuellen Texte werden zum Vergleich angezeigt. Prüfen Sie diese vor dem erneuten Speichern.',
  saveFailed:
    'Speichern wurde nicht bestätigt. Die Änderung kann bereits in Keycloak angekommen sein. Ihr Entwurf bleibt erhalten; bitte schließen, neu öffnen und den aktuellen Stand prüfen.',
  reset: 'SVA-Standard verwenden',
  resetConfirm:
    'Den Instanz-Override entfernen und wieder die aktuelle allgemeine Bestätigungsvorlage verwenden?',
} as const;
