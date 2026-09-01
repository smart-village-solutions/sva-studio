# Change: SSF-Tenant- und Nutzerverwaltung im Studio einführen

## Why

Nach den generischen Plugin-Plattformgrundlagen soll das SVA Studio als erste
nutzbare SSF-Control-Plane Mandanten und deren initiale Administration
bereitstellen. Root- und Tenant-IAM, Instanzverwaltung und Plugin-Lifecycle
sollen wiederverwendet werden, ohne eine parallele SSF-Mandanten- oder
Benutzerverwaltung aufzubauen.

## What Changes

- Ein installiertes SSF-Plugin wird als `automatic` registriert; eine
  Studio-Instanz entspricht genau einem SSF-Mandanten.
- Der Root-Admin legt Instanz, Tenant-Realm, getrennte Studio-/SSF-Clients und
  den initialen Tenant-Admin an.
- Der tenantlokale `system_admin` verwaltet anschließend Benutzer, Gruppen und
  Rollen über die bestehenden Studio-IAM-Oberflächen.
- Das SSF-Plugin besitzt eine einzige mandantenfähige PostgreSQL-Datenbank pro
  SSF-Installation und legt pro Instanz einen Tenant-Grunddatensatz an.
- Provisionierung, Reconcile, Suspendierung, Reaktivierung und Readiness nutzen
  den generischen Plugin-Tenant-Lifecycle.
- Root-Status und Reparaturaktionen erscheinen in der bestehenden
  Instanzverwaltung; es entsteht keine zweite Tenant-Registry.
- Die mit PR #1246 gemergte SSF-Runtime-Foundation wird wiederverwendet. Der
  produktive interne Endpoint bleibt Bestandteil von
  `add-ssf-runtime-configuration-api`; dieser Change baut weder ein zweites
  SSF-Plugin noch eine zweite Plugin-Datenbank auf.

## Dependencies and Coordination

- Verwendet die gemergten Baselines aus
  `extend-plugin-platform-scopes-and-activation` und PR #1246.
- Hängt von `add-plugin-tenant-lifecycle` ab.
- Verwendet die bestehenden Capabilities `iam-core`, `iam-access-control`,
  `iam-auditing`, `instance-provisioning` und `plugin-operations-platform`.
- `add-ssf-runtime-configuration-api` und dieser Change teilen Plugin- und
  Datenbank-Ownership, bleiben aber getrennte Lieferstränge: Runtime-Read-Pfad
  im Runtime-Change; Provisionierung, Lifecycle und Administration in diesem
  Change.

## Impact

- Affected specs:
  - `ssf-tenant-administration` (neu)
- Affected code:
  - neues SSF-Plugin mit Browser-, Server- und Job-Beiträgen
  - Keycloak- und Instanz-Provisionierung
  - bestehende Instanz-, Nutzer-, Rollen- und Gruppenoberflächen
  - SSF-plugin-eigene PostgreSQL-Datenbank
  - Deployment-Konfiguration für SSF-Keycloak und Plugin-Datenbank
- Affected arc42 sections:
  - `docs/architecture/03-context-and-scope.md`
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
