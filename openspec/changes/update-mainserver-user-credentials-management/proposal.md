# Change: Mainserver-Credentials in der Benutzerverwaltung pflegen

## Why
Die Benutzerverwaltung kann Mainserver-bezogene Keycloak-Attribute aktuell nicht anzeigen oder pflegen. Gleichzeitig nutzt die Laufzeit derzeit andere Attributnamen als die in Keycloak bei den betroffenen Benutzern vorhandenen Felder, was zu einer inkonsistenten Konfiguration führen würde.

## What Changes
- erweitert die Benutzer-Bearbeitungsseite um Mainserver-Credentials pro Benutzer
- ergänzt den Admin-User-Detail- und Update-Flow um die Keycloak-Attribute `mainserverUserApplicationId` und `mainserverUserApplicationSecret`
- behandelt `mainserverUserApplicationSecret` als write-only Feld mit Statusanzeige statt Klartext-Rückgabe
- richtet den serverseitigen Mainserver-Credential-Reader auf die neuen Attributnamen aus und unterstützt die bisherigen Namen `sva_mainserver_api_key` und `sva_mainserver_api_secret` als Fallback für Bestandsdaten
- aktualisiert die betroffene Architektur- und Betriebsdokumentation

## Impact
- Affected specs:
  - `account-ui`
  - `iam-core`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/users/*`
  - `apps/sva-studio-react/src/lib/iam-api.ts`
  - `packages/core/src/iam/account-management-contract.ts`
  - `packages/auth/src/iam-account-management/*`
  - `packages/auth/src/mainserver-credentials.server.ts`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/adr/ADR-021-per-user-sva-mainserver-delegation.md`
