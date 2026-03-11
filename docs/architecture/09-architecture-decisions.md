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
- `ADR-017-modulare-iam-server-bausteine.md`
- `ADR-018-auth-routing-error-contract-und-korrelation.md`
- `ADR-019-swarm-traefik-referenz-betriebsprofil.md`
- `ADR-020-kanonischer-auth-host-multi-host-grenze.md`

### Zuordnung zu arc42-Abschnitten

- Abschnitt 03/05/08 (Kontext/Bausteine/Querschnitt): ADR-009, ADR-011
- Abschnitt 08/10/11 (Querschnitt/Qualität/Risiken): ADR-010
- Abschnitt 06/08/10 (Laufzeit/Querschnitt/Qualität): ADR-012, ADR-013, ADR-014
- Abschnitt 08/10 (Querschnitt/Qualität): ADR-015
- Abschnitt 05/06/07/08 (Bausteine/Laufzeit/Deployment/Querschnitt): ADR-016
- Abschnitt 04/05/06/08/10/11 (Strategie/Bausteine/Laufzeit/Querschnitt/Qualität/Risiken): ADR-017
- Abschnitt 04/05/06/08/10/11 (Strategie/Bausteine/Laufzeit/Querschnitt/Qualität/Risiken): ADR-018

### Zuordnung Swarm-Deployment-ADRs

- Abschnitt 07 (Deployment): ADR-019
- Abschnitt 05/07/08 (Bausteine/Deployment/Querschnitt): ADR-011 (Fortschreibung: Subdomain-Ableitung)
- Abschnitt 07/08/10 (Deployment/Querschnitt/Qualität): ADR-020

### IAM-spezifische ADR-Verweise (Masterplan)

- ADR-009: Keycloak als zentraler Identity Provider (Abschnitt 03, 06, 07)
- ADR-010: Verschlüsselungsstrategie IAM Core Data Layer (Abschnitt 08, 10)
- ADR-011: `instanceId` als kanonischer Mandanten-Scope (Abschnitt 05, 08, 10)
- ADR-012: Permission-Kompositionsmodell RBAC v1 (Abschnitt 06, 10)
- ADR-013: RBAC+ABAC-Hybridmodell (Abschnitt 05, 06, 08, 10)
- ADR-014: Postgres `NOTIFY` für Cache-Invalidierung (Abschnitt 06, 08, 10)
- ADR-017: Modulare IAM-Server-Bausteine und Restschuldführung an realen Kernmodulen (Abschnitt 04, 05, 06, 08, 10, 11)
- ADR-018: Header-basierte Korrelation und gemeinsamer Error-Response-Contract für Auth-/IAM-Routen (Abschnitt 04, 05, 06, 08, 10, 11)

### Pflege-Regel

Bei Architekturentscheidungen in OpenSpec-Changes:

1. betroffene arc42-Abschnitte referenzieren
2. ADR erstellen/aktualisieren
3. Entscheidung in diesem Abschnitt nachziehen

Zusätzlich gilt:

- Neue oder geänderte IAM-Patterns (z. B. Rollen-Sync, RBAC/ABAC-Komposition, Data-Subject-Rights-Flows) sind nicht vollständig dokumentiert, bevor sie hier in Abschnitt 09 referenziert sind.
- Wenn IAM-Logik ohne neue ADR angepasst wird, muss im PR begründet werden, warum eine bestehende ADR weiterhin ausreichend ist.

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

### Fortschreibung 2026-03: Rollen-Katalog-Sync

- `add-keycloak-role-catalog-sync` nutzt ADR-016 als tragende Entscheidung für die IdP-Abstraktion und konkretisiert sie für Realm-Rollen-CRUD.
- Ergänzende Festlegungen im Change:
  - Keycloak-First mit Compensation für synchrone Write-Operationen
  - stabiler `role_key` mit getrenntem `display_name`
  - `report-only` für orphaned, studio-markierte Keycloak-Rollen
  - geplanter Reconcile-Lauf als Sicherheitsnetz für Drift und externe Eingriffe

### Fortschreibung 2026-03: Modulare IAM-Server-Bausteine

- `ADR-017-modulare-iam-server-bausteine.md`
  - begründet die Fassade-plus-Kernmodul-Struktur für `packages/auth` und `packages/data`
  - verschiebt Complexity-Restschuld an die tatsächlichen Kernmodule statt an historische Fassadenpfade

### Fortschreibung 2026-03: Swarm-Deployment und Multi-Host-Betrieb

- `ADR-019-swarm-traefik-referenz-betriebsprofil.md`
  - Definiert den Swarm-Stack mit Traefik-Ingress, Registry-Images, Swarm-Secrets und Rolling Updates als Referenz-Betriebsprofil.
- `ADR-011` (Fortschreibung)
  - Ergänzt den bestehenden `instanceId`-Scope um die Subdomain-Ableitung (`<instanceId>.<SVA_PARENT_DOMAIN>`), die Env-Allowlist als autoritative Freigabequelle und den IDN/Punycode-Ausschluss.
- `ADR-020-kanonischer-auth-host-multi-host-grenze.md`
  - Definiert die Root-Domain als kanonischen Auth-Host für OIDC-Flows mit fail-closed-Grenze für Instanz-Hosts.

Zuordnung:

- Abschnitt 07 (Deployment): ADR-019, ADR-020
- Abschnitt 05/08 (Bausteine/Querschnitt): ADR-011 Fortschreibung
- Abschnitt 10/11 (Qualität/Risiken): ADR-020 (fail-closed, Host-Enumeration)
