# Change: Profil- und Benutzerverwaltungsdaten konsistent synchronisieren

## Why
Änderungen an Name, E-Mail und Benutzername unter `/account` werden derzeit nicht konsistent in der Benutzerverwaltung bzw. in Keycloak sichtbar. Zudem können E-Mail und Benutzername im Self-Service-Profil aktuell nicht vollständig bearbeitet werden, obwohl Nutzer dies erwarten.

## What Changes
- erweitert den Self-Service-Endpunkt `/api/v1/iam/users/me/profile` um die Bearbeitung von E-Mail-Adresse und Benutzername
- synchronisiert Self-Service-Änderungen an Benutzername, E-Mail, Vorname und Nachname mit IAM-Datenbank und Keycloak
- stellt sicher, dass Namensänderungen ohne manuelle Doppelpflege im `displayName` in der Benutzerverwaltung sichtbar werden
- aktualisiert Profil-UI, Validierung und Tests für das neue Verhalten

## Impact
- Affected specs: `account-ui`
- Affected code: `apps/sva-studio-react/src/routes/account/*`, `apps/sva-studio-react/src/lib/iam-api.ts`, `packages/auth/src/iam-account-management/*`
- Affected arc42 sections: `05-building-block-view`
