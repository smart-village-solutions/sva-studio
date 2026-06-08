# Change: Keycloak-gestuetzten Credential-Self-Service im Studio einfuehren

## Why

Das Studio besitzt bereits einen Self-Service-Profilpfad und reservierte Menueeintraege fuer Passwort- und E-Mail-Aenderungen. Diese Funktionen fehlen aber noch konkret. Da SVA Studio Keycloak als zentralen Identity Provider ueber ein serverseitiges BFF nutzt, muessen Credential-Aenderungen sicher und standardkonform ueber Keycloak-Self-Service-Flows statt ueber lokale Studio-Formulare erfolgen.

## What Changes

- fuehrt einen serverseitig kontrollierten Auth-Einstiegspfad fuer Keycloak Application Initiated Actions ein
- aktiviert die Header-Menueeintraege fuer Passwort- und E-Mail-Aenderung
- trennt Self-Service-Stammdatenpflege im Studio explizit von Credential-Mutationen im IdP
- definiert einen stabilen Rueckkehr- und Statusvertrag zwischen Keycloak-AIA und Studio-UI

## Impact

- Affected specs: `account-ui`, `routing`, `iam-core`
- Affected code:
  - `apps/sva-studio-react/src/components/Header.tsx`
  - `apps/sva-studio-react/src/routes/account/-account-profile-page.tsx`
  - `apps/sva-studio-react/src/i18n/resources.ts`
  - `packages/auth-runtime/src/auth-route-handlers.ts`
  - `packages/auth-runtime/src/auth-server/login.ts`
  - zugehoerige Login-State-/Callback-Dateien in `packages/auth-runtime/src/**`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
