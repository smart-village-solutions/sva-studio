# Change: Keycloak-Benutzer in die Studio-Benutzerverwaltung synchronisieren

## Why
Benutzer, die direkt in Keycloak angelegt werden, erscheinen derzeit nicht in der Studio-Benutzerverwaltung. Die User-Liste liest ausschließlich aus `iam.accounts`, während externe Keycloak-User erst bei erstem Login oder Studio-internem Anlegen materialisiert werden.

## What Changes
- ergänzt einen expliziten Admin-Sync, der Benutzer aus Keycloak in die IAM-Datenbank importiert
- zeigt den Sync als Admin-Aktion in der Benutzerverwaltung an
- importiert nur Benutzer, die dem aktuellen Studio-Kontext zugeordnet werden können
- synchronisiert Basisdaten wie Benutzername, E-Mail, Vorname, Nachname, Anzeigename und Status in `iam.accounts`
- lässt bestehende Rollen- und Status-Logik der Studio-Verwaltung intakt

## Impact
- Affected specs: `account-ui`, `iam-core`
- Affected code: `apps/sva-studio-react/src/routes/admin/users/*`, `apps/sva-studio-react/src/hooks/use-users.ts`, `apps/sva-studio-react/src/lib/iam-api.ts`, `packages/auth/src/iam-account-management/*`, `packages/auth/src/keycloak-admin-client/*`, `packages/data/migrations/*`
- Affected arc42 sections: `05-building-block-view`
