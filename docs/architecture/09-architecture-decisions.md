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
- `ADR-021-per-user-sva-mainserver-delegation.md`
- `ADR-023-session-lifecycle-forced-reauth-und-silent-sso.md`

### Zuordnung zu arc42-Abschnitten

- Abschnitt 03/05/08 (Kontext/Bausteine/Querschnitt): ADR-009, ADR-011
- Abschnitt 08/10/11 (Querschnitt/Qualität/Risiken): ADR-010
- Abschnitt 06/08/10 (Laufzeit/Querschnitt/Qualität): ADR-012, ADR-013, ADR-014
- Abschnitt 08/10 (Querschnitt/Qualität): ADR-015
- Abschnitt 05/06/07/08 (Bausteine/Laufzeit/Deployment/Querschnitt): ADR-016
- Abschnitt 04/05/06/08/10/11 (Strategie/Bausteine/Laufzeit/Querschnitt/Qualität/Risiken): ADR-017
- Abschnitt 04/05/06/08/10/11 (Strategie/Bausteine/Laufzeit/Querschnitt/Qualität/Risiken): ADR-018
- Abschnitt 04/06/08/09/10/11 (Strategie/Laufzeit/Querschnitt/Entscheidungen/Qualität/Risiken): ADR-023
- Abschnitt 03/04/05/06/08 (Kontext/Strategie/Bausteine/Laufzeit/Querschnitt): ADR-021

### Zuordnung Swarm-Deployment-ADRs

- Abschnitt 07 (Deployment): ADR-019
- Abschnitt 05/07/08 (Bausteine/Deployment/Querschnitt): ADR-011 (Fortschreibung: Subdomain-Ableitung)
- Abschnitt 07/08/10 (Deployment/Querschnitt/Qualität): ADR-020

### IAM-spezifische ADR-Verweise (Masterplan)

- ADR-009: Keycloak als zentraler Identity Provider (Abschnitt 03, 06, 07)
- ADR-010: Verschlüsselungsstrategie IAM Core Data Layer (Abschnitt 08, 10)
- ADR-011: `instanceId` als kanonischer Mandanten-Scope und fachlicher String-Schlüssel (Abschnitt 05, 08, 10)
- ADR-012: Permission-Kompositionsmodell RBAC v1 (Abschnitt 06, 10)
- ADR-013: RBAC+ABAC-Hybridmodell (Abschnitt 05, 06, 08, 10)
- ADR-014: Postgres `NOTIFY` für Cache-Invalidierung (Abschnitt 06, 08, 10)
- ADR-017: Modulare IAM-Server-Bausteine und Restschuldführung an realen Kernmodulen (Abschnitt 04, 05, 06, 08, 10, 11)
- ADR-018: Header-basierte Korrelation und gemeinsamer Error-Response-Contract für Auth-/IAM-Routen (Abschnitt 04, 05, 06, 08, 10, 11)
- ADR-021: Serverseitige, per User delegierte SVA-Mainserver-Integration mit Keycloak-Attributen und instanzgebundener Endpunktkonfiguration (Abschnitt 03, 04, 05, 06, 08)
- ADR-023: Führender Session-Lifecycle, Forced Reauth und kontrolliertes Silent SSO im BFF-Modell (Abschnitt 04, 06, 08, 09, 10, 11)

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
- `../adr/ADR-000-template.md`
- `openspec/AGENTS.md`

Hinweis:

- Der kanonische Ablageort für neue ADRs ist `docs/adr/`.
- ADR-018 ist nach `docs/adr/ADR-018-auth-routing-error-contract-und-korrelation.md` migriert; diese Fassung ist maßgeblich.
- Historische Dateien unter `docs/architecture/decisions/` bleiben als Altbestand einer älteren ADR-Serie mit überschneidenden Nummern erhalten und sollen nicht neu referenziert werden.

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

### Fortschreibung 2026-03: Per-User-SVA-Mainserver-Delegation

- `ADR-021-per-user-sva-mainserver-delegation.md`
  - begründet die dedizierte Integrationsschicht `@sva/sva-mainserver`
  - trennt instanzgebundene Endpunktkonfiguration von per-User-Credentials aus Keycloak
  - legt fest, dass Browser-Code nie direkt mit dem externen SVA-Mainserver spricht

Zuordnung:

- Abschnitt 03/04 (Kontext/Strategie): ADR-021
- Abschnitt 05/06 (Bausteine/Laufzeit): ADR-021
- Abschnitt 08 (Querschnitt): ADR-021

### Fortschreibung 2026-03: Session-Lifecycle und kontrollierte Session-Recovery

- `ADR-023-session-lifecycle-forced-reauth-und-silent-sso.md`
  - definiert `Session.expiresAt` als fachlich führende Gültigkeitsgrenze
  - führt benutzerbezogenen Forced Reauth mit `app_only` und `app_and_idp` ein
  - begrenzt Silent SSO auf einen kontrollierten Recovery-Versuch nach `401`

Zuordnung:

- Abschnitt 04 (Strategie): ADR-023
- Abschnitt 06 (Laufzeit): ADR-023
- Abschnitt 08 (Querschnitt): ADR-023
- Abschnitt 09 (Entscheidungen): ADR-023

### Fortschreibung 2026-03: IAM-Transparenz-UI ohne neue ADR

- Für `add-iam-transparency-ui` war keine neue ADR erforderlich.
  - Routing über `/admin/iam?tab=...` und `/account/privacy` ist eine UI-spezifische Konkretisierung bestehender Account-UI- und Routing-Patterns.
  - Getypte Transparenz-Read-Modelle und serverseitige Normalisierung folgen bereits den Leitplanken aus ADR-012, ADR-013, ADR-017 und ADR-018.
- Die maßgeblichen Architekturentscheidungen bleiben daher:
  - ADR-012 und ADR-013 für Permission- und Governance-Semantik
  - ADR-017 für die modulare Zerlegung der Auth-/IAM-Serverbausteine
  - ADR-018 für Fehlervertrag und korrelierbare Transparenz-Reads

Zuordnung:

- Abschnitt 04/05/06/08: ADR-012, ADR-013, ADR-017, ADR-018
- Abschnitt 09: dokumentiert explizit, dass die Transparenz-UI eine Fortschreibung vorhandener Entscheidungen ist und kein neues Architekturpattern einführt
