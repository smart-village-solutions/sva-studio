export const loginMfaInstancesAdminDEResources = {
  title: 'Anmelderichtlinie',
  description:
    'Legen Sie fest, ob Ihre Organisation bei der normalen Anmeldung einen Authenticator-Code verlangt. Sensible Aktionen benötigen weiterhin eine frische MFA-Bestätigung.',
  label: 'MFA bei normaler Anmeldung',
  optional: 'Optional',
  required: 'Erforderlich',
  unverified: 'Nicht verifiziert',
  enrollment:
    'Benutzer richten ihren Authenticator in Keycloak ein und verwalten ihn dort. Im optionalen Modus werden bereits eingerichtete Codes weiterhin abgefragt.',
  pending: 'Verifizierung ausstehend',
  applied: 'Angewendet und verifiziert',
  failed:
    'Anwendung fehlgeschlagen. Zum Wiederholen erneut speichern oder die Administration kontaktieren.',
  appliedMode: 'Zuletzt verifizierte Richtlinie: {{mode}}',
  save: 'Richtlinie speichern',
  loading: 'Anmelderichtlinie wird geladen…',
  error:
    'Die Richtlinie konnte nicht geladen oder gespeichert werden. Neu laden und erneut versuchen.',
} as const;
