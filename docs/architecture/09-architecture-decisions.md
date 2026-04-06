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
- `ADR-022-iam-groups-geo-hierarchie-permission-caching.md`
- `ADR-023-session-lifecycle-forced-reauth-und-silent-sso.md`
- `ADR-024-iam-groups-als-eigenstaendige-entitaet.md`
- `ADR-025-multi-scope-prioritaetsregel-fuer-iam.md`
- `ADR-026-redis-als-primary-permission-cache.md`
- `ADR-027-rechtstext-fail-closed-und-blockierte-session.md`
- `ADR-028-iam-konfigurations-export-als-folgearbeit.md`
- `ADR-029-goose-als-oss-standard-fuer-sql-migrationen.md`
- `ADR-030-registry-basierte-instance-freigabe-und-provisioning.md`
- `ADR-032-plattform-scope-vs-tenant-instanz.md`

### Zuordnung zu arc42-Abschnitten

- Abschnitt 03/05/08 (Kontext/Bausteine/Querschnitt): ADR-009, ADR-011
- Abschnitt 08/10/11 (Querschnitt/Qualität/Risiken): ADR-010
- Abschnitt 06/08/10 (Laufzeit/Querschnitt/Qualität): ADR-012, ADR-013, ADR-014
- Abschnitt 08/10 (Querschnitt/Qualität): ADR-015
- Abschnitt 05/06/07/08 (Bausteine/Laufzeit/Deployment/Querschnitt): ADR-016
- Abschnitt 04/05/06/08/10/11 (Strategie/Bausteine/Laufzeit/Querschnitt/Qualität/Risiken): ADR-017
- Abschnitt 04/05/06/08/10/11 (Strategie/Bausteine/Laufzeit/Querschnitt/Qualität/Risiken): ADR-018
- Abschnitt 04/06/08/09/10/11 (Strategie/Laufzeit/Querschnitt/Entscheidungen/Qualität/Risiken): ADR-023
- Abschnitt 04/05/06/08/10/11 (Strategie/Bausteine/Laufzeit/Querschnitt/Qualität/Risiken): ADR-022, ADR-024, ADR-025, ADR-026, ADR-027, ADR-028
- Abschnitt 04/07/08/09/10/11 (Strategie/Deployment/Querschnitt/Entscheidungen/Qualität/Risiken): ADR-029
- Abschnitt 04/05/06/07/08/09/10/11 (Strategie/Bausteine/Laufzeit/Deployment/Querschnitt/Entscheidungen/Qualität/Risiken): ADR-030
- Abschnitt 04/05/06/08/09/11 (Strategie/Bausteine/Laufzeit/Querschnitt/Entscheidungen/Risiken): ADR-032
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
- ADR-022: Gruppen, Geo-Hierarchie und Permission-Caching als gemeinsames IAM-Zielbild (Abschnitt 04, 05, 06, 08, 10, 11)
- ADR-023: Führender Session-Lifecycle, Forced Reauth und kontrolliertes Silent SSO im BFF-Modell (Abschnitt 04, 06, 08, 09, 10, 11)
- ADR-024: Gruppen als eigenständige, instanzgebundene IAM-Entität (Abschnitt 04, 05, 06, 08, 10)
- ADR-025: Konservative Prioritätsregel für Multi-Scope-IAM-Entscheidungen (Abschnitt 04, 06, 08, 10, 11)
- ADR-026: Redis als primärer Shared Permission Cache (Abschnitt 04, 06, 07, 08, 10, 11)
- ADR-027: Rechtstext-Fail-Closed und blockierter Session-Zustand (Abschnitt 05, 06, 08, 09, 10, 11)
- ADR-028: IAM-Konfigurations-Export bleibt dokumentierte Folgearbeit (Abschnitt 09, 11)
- ADR-029: `goose` als OSS-Standard für SQL-Migrationen (Abschnitt 04, 07, 08, 09, 10, 11)
- ADR-030: Registry-basierte Instance-Freigabe und gemeinsamer Provisioning-Vertrag (Abschnitt 04, 05, 06, 07, 08, 09, 10, 11)
- ADR-032: Plattform-Scope vs. tenantgebundene Instanz als kanonische Runtime- und Audit-Trennung (Abschnitt 04, 05, 06, 08, 09, 11)

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

### Fortschreibung 2026-03: IAM-Angebotsbausteine 3 bis 5

- `ADR-022-iam-groups-geo-hierarchie-permission-caching.md`
  - beschreibt das übergreifende Zielbild für Gruppen, Geo-Hierarchie und Permission-Caching.
- `ADR-024-iam-groups-als-eigenstaendige-entitaet.md`
  - fixiert Gruppen als eigenständige IAM-Entität mit Rollen-Container-Schnitt.
- `ADR-025-multi-scope-prioritaetsregel-fuer-iam.md`
  - normiert die Konfliktauflösung über Rollen, Gruppen, Org und Geo.
- `ADR-026-redis-als-primary-permission-cache.md`
  - legt Redis als führenden Shared-Read-Path für Permission-Snapshots fest.
- `ADR-027-rechtstext-fail-closed-und-blockierte-session.md`
  - verankert server-seitiges Pflichttext-Enforcement und blockierte Sessions.
- `ADR-028-iam-konfigurations-export-als-folgearbeit.md`
  - dokumentiert den ausstehenden IAM-Konfigurations-Export als bewusste Folgearbeit.

Zuordnung:

- Abschnitt 04/05/06/08/10/11: ADR-022, ADR-024, ADR-025, ADR-026, ADR-027
- Abschnitt 09/11: ADR-028

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

### Fortschreibung 2026-04: OSS-Standardisierung für SQL-Migrationen

- `ADR-029-goose-als-oss-standard-fuer-sql-migrationen.md`
  - legt `goose` als verbindlichen OSS-Standard für versionierte SQL-Migrationen fest
  - hält SQL als führende Schema-Vertragsebene für Postgres-, IAM- und RLS-nahe Änderungen fest
  - ersetzt mittelfristig den rein dateibasierten Migrationslauf ohne standardisierte Historie

Zuordnung:

- Abschnitt 04 (Strategie): ADR-029
- Abschnitt 07 (Deployment): ADR-029
- Abschnitt 08 (Querschnitt): ADR-029
- Abschnitt 09 (Entscheidungen): ADR-029
- Abschnitt 10/11 (Qualität/Risiken): ADR-029

### Fortschreibung 2026-03: Direkte Nutzerrechte ohne neue ADR

- Für direkte Nutzerrechte war keine neue ADR erforderlich.
  - Die Konfliktregel bleibt vollständig innerhalb der bestehenden Leitplanken aus ADR-025.
  - Die Erweiterung führt kein neues IdP- oder Sync-Pattern ein, sondern ergänzt die bestehende Studio-IAM-Persistenz um eine zusätzliche Herkunft `direct_user`.
- Die maßgeblichen Architekturentscheidungen bleiben daher:
  - ADR-025 für `deny vor allow` und konservative Konfliktauflösung
  - ADR-017 für die modulare Erweiterung der Auth-/IAM-Serverbausteine
  - ADR-016 bleibt unverändert, weil direkte Nutzerrechte bewusst nicht in Keycloak gespiegelt werden

Zuordnung:

- Abschnitt 04/05/06/08/10/11: ADR-017, ADR-025
- Abschnitt 09: dokumentiert explizit, dass direkte Nutzerrechte eine Fortschreibung vorhandener Entscheidungen sind und kein neues Architekturpattern einführen

### Fortschreibung 2026-04: Zentrale Instanz-Registry und Provisioning

- `ADR-030-registry-basierte-instance-freigabe-und-provisioning.md`
  - definiert Postgres als führende Registry für Instanzfreigabe, Hostnamen, Status und Audit
  - konkretisiert den gemeinsamen Provisioning-Vertrag für HTTP, Studio-Control-Plane und Ops-CLI
  - hält den Root-Host als einzige globale Instanzverwaltung fest und belässt ADR-020 als gültige Auth-Grenze

Zuordnung:

- Abschnitt 04/05/06/07/08/09/10/11: ADR-030
