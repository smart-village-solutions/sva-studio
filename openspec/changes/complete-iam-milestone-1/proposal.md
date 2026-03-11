# Change: Milestone 1 IAM vervollständigen

## Why

Die IAM-Basis von Milestone 1 ist im Repository bereits weit fortgeschritten: OIDC-Login, Account- und Organisationsverwaltung, Rollen-CRUD, Berechtigungsauflösung, Redis-basierte Session-Persistenz und erste Admin-UI-Flows existieren bereits. Der verbleibende Scope ist jedoch über mehrere Spezifikationen, Reports und Teil-Changes verteilt.

Für die Umsetzungs- und Review-Phase fehlt ein konsolidierter, freigegebener Change, der die offenen Milestone-1-Punkte fachlich und technisch bündelt: Client- und Token-Contract, gruppenbasierte Rechtevergabe, produktionsreife Cache-/Invalidierungslogik, mehrstufige Organisationsstrukturen, Lifecycle-Workflows, Audit-/Compliance-Nachweise und die zugehörige Verwaltungs-UI.

## What Changes

- konsolidiert die noch offenen Milestone-1-Anforderungen in einem gemeinsamen Change
- spezifiziert den verbindlichen OIDC-/Keycloak-Client- und Token-Vertrag für CMS und App
- erweitert das IAM um Gruppen, fein granulare Permissions, temporäre Delegationen und produktionsreife Permission-Snapshots
- präzisiert das Organisationsmodell für mehrstufige Hierarchien, Beitrittsprinzip, Privacy-Optionen und delegierbare Administration
- definiert Onboarding-, Offboarding- und Account-Lifecycle-Workflows für interne und externe Nutzertypen
- vervollständigt Audit-, Export-, Reminder- und Löschkonzept-Anforderungen für Compliance
- schärft die Anforderungen an die Admin-UI für Rollen, Gruppen, Memberships, Onboarding-Status und Delegationen

## Impact

- Affected specs:
  - `iam-core`
  - `iam-access-control`
  - `iam-organizations`
  - `iam-auditing`
  - `account-ui`
- Affected code:
  - `packages/auth/src/auth-server/*`
  - `packages/auth/src/iam-account-management/*`
  - `packages/auth/src/iam-authorization/*`
  - `packages/auth/src/iam-governance/*`
  - `packages/auth/src/audit*`
  - `packages/data/migrations/*`
  - `packages/core/src/iam/*`
  - `apps/sva-studio-react/src/routes/account/*`
  - `apps/sva-studio-react/src/routes/admin/*`
- Affected arc42 sections:
  - `04` Lösungsstrategie
  - `05` Bausteinsicht
  - `06` Laufzeitsicht
  - `08` Querschnittliche Konzepte
  - `09` Architekturentscheidungen
  - `10` Qualitätsanforderungen
  - `11` Risiken und technische Schulden
