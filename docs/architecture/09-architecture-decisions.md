# 09 Architekturentscheidungen

## Zweck

Dieser Abschnitt verlinkt und kontextualisiert Architekturentscheidungen (ADRs)
mit Bezug auf die arc42-Abschnitte.

## Mindestinhalte

- Liste relevanter ADRs mit Status
- Kurzbegründung und Auswirkungen pro Entscheidung
- Verknüpfung zu betroffenen arc42-Abschnitten

## Aktueller Stand

### Relevante ADRs (vorhanden)

- `ADR-009-keycloak-als-zentraler-identity-provider.md`
- `ADR-010-verschluesselung-iam-core-data-layer.md`
- `ADR-011-instanceid-kanonischer-mandanten-scope.md`
- `ADR-012-permission-kompositionsmodell-rbac-v1.md`
- `ADR-013-rbac-abac-hybridmodell.md`
- `ADR-014-postgres-notify-cache-invalidierung.md`
- `ADR-015-csrf-schutz-strategie.md`
- `ADR-016-idp-abstraktionsschicht.md`

### Zuordnung zu arc42-Abschnitten

- Abschnitt 03/05/08 (Kontext/Bausteine/Querschnitt): ADR-009, ADR-011
- Abschnitt 08/10/11 (Querschnitt/Qualität/Risiken): ADR-010
- Abschnitt 06/08/10 (Laufzeit/Querschnitt/Qualität): ADR-012, ADR-013, ADR-014
- Abschnitt 08/10 (Querschnitt/Qualität): ADR-015
- Abschnitt 05/06/07/08 (Bausteine/Laufzeit/Deployment/Querschnitt): ADR-016

### IAM-spezifische ADR-Verweise (Masterplan)

- ADR-009: Keycloak als zentraler Identity Provider (Abschnitt 03, 06, 07)
- ADR-010: Verschlüsselungsstrategie IAM Core Data Layer (Abschnitt 08, 10)
- ADR-011: `instanceId` als kanonischer Mandanten-Scope (Abschnitt 05, 08, 10)
- ADR-012: Permission-Kompositionsmodell RBAC v1 (Abschnitt 06, 10)
- ADR-013: RBAC+ABAC-Hybridmodell (Abschnitt 05, 06, 08, 10)
- ADR-014: Postgres `NOTIFY` für Cache-Invalidierung (Abschnitt 06, 08, 10)

### Pflege-Regel

Bei Architekturentscheidungen in OpenSpec-Changes:

1. betroffene arc42-Abschnitte referenzieren
2. ADR erstellen/aktualisieren
3. Entscheidung in diesem Abschnitt nachziehen

Referenzen:

- `../adr/README.md`
- `openspec/AGENTS.md`

### Neue ADRs im Kontext Account-UI

- `ADR-015-csrf-schutz-strategie.md`
  - Begründet die Header-basierte CSRF-Absicherung für mutierende IAM-v1-Endpunkte.
- `ADR-016-idp-abstraktionsschicht.md`
  - Begründet die IdP-Abstraktion über `IdentityProviderPort` mit Keycloak-Adapter.

Zuordnung:

- Abschnitt 08 (Querschnitt): ADR-015, ADR-016
- Abschnitt 06 (Laufzeit): ADR-016 (Keycloak-First + Compensation)
- Abschnitt 07 (Deployment): ADR-016 (Service-Account/Secrets)
