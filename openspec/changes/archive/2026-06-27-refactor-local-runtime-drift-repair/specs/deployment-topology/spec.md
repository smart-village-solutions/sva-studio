## MODIFIED Requirements
### Requirement: Bootstrap- und Seed-Pfade unterscheiden neue und bestehende Umgebungen

Das System SHALL im lokalen und staging-nahen Betrieb normativ zwischen neuer Umgebung, read-only Standardstart und explizitem Repair-Pfad unterscheiden, damit Seed-, Bootstrap- und Reconcile-Pfade keine bestehende Umgebungsidentitaet stillschweigend ueberschreiben.

#### Scenario: Standardstart bleibt read-only

- **WHEN** ein Teammitglied `pnpm env:up:local-keycloak` oder `pnpm env:update:local-keycloak` gegen eine bestehende lokale Umgebung ausfuehrt
- **THEN** schreibt der Standardpfad keine geschuetzten Identitaetsfelder und keine tenant-spezifischen Secrets still zurueck
- **AND** meldet er Drift nur sichtbar ueber `doctor` oder den read-only Drift-Check

#### Scenario: Expliziter Repair-Pfad heilt lokale Drift ohne Rebootstrap

- **WHEN** eine bestehende lokale `local-keycloak`-Umgebung Drift bei Migration, Registry-Identitaet oder tenant-spezifischen Secrets aufweist
- **THEN** steht mit `pnpm env:repair:local-keycloak` ein expliziter, idempotenter Repair-Pfad zur Verfuegung
- **AND** fuehrt dieser Pfad hoechstens Migration, Registry-Reconcile und Secret-Sync aus
- **AND** loest er weder `down` noch `reset` noch einen kompletten Rebootstrap implizit aus

#### Scenario: Gefaehrliche Runtime-Mutationen benoetigen ein Approval-Token

- **WHEN** ein Teammitglied einen gefaehrlichen Runtime-Pfad wie autoritativen lokalen Repair, autoritativen lokalen Reconcile, Remote-Migrate, Remote-Deploy, Remote-Down oder Remote-Reset ausfuehrt
- **THEN** blockiert das Repo den Befehl ohne passenden `--approve-dangerous=<token>`
- **AND** nennt die Fehlermeldung den exakt erwarteten Freigabetoken fuer die Wiederholung

### Requirement: Betriebsfähige Tenant-Umgebungen erfordern konsistente Secret-Zuordnungen

Das System SHALL im lokalen und staging-nahen Betrieb tenant-spezifische Auth-Secrets und tenant-spezifische Tenant-Admin-Secrets als Teil der Umgebungs-Readiness behandeln.

#### Scenario: Doctor klassifiziert Secret-Drift maschinenlesbar

- **WHEN** `pnpm env:doctor:local-keycloak --json` gegen eine Umgebung mit fehlenden oder unlesbaren tenant-spezifischen Secrets laeuft
- **THEN** enthaelt der Report stabile `reasonCode`-, `repairable`- und `recommendedAction`-Felder fuer die betroffene Driftklasse
- **AND** verwendet der Report fuer Tenant-Secrets Codes wie `tenant_auth_client_secret_missing`, `tenant_auth_client_secret_unreadable`, `tenant_admin_client_secret_missing` oder `tenant_admin_client_secret_unreadable`

#### Scenario: Repair synchronisiert tenant-spezifische Secrets gegen Keycloak

- **WHEN** `pnpm env:repair:local-keycloak` auf tenant-spezifische Secret-Drift trifft
- **THEN** gleicht der Repair-Pfad die Secrets ueber vorhandene Keycloak-/Registry-Mechanik gegen den Live-Zustand ab
- **AND** heilt er fehlende oder mit dem aktuellen Verschluesselungsmaterial nicht lesbare Registry-Secrets ohne globale Fallback-Secrets

### Requirement: Dokumentierte Vertragsgrenze zwischen lokalem Development und `studio`

Das System SHALL den lokalen Entwicklungsbetrieb in einen deterministischen `local-dev`-Pfad und staging-nahe Sonderfaelle trennen.

#### Scenario: `local-dev` nutzt Doctor, Repair und Snapshot-Check

- **WHEN** ein Teammitglied den offiziellen lokalen Betriebsvertrag fuer `local-keycloak` verwendet
- **THEN** lautet die Eskalationsfolge `up -> doctor -> repair -> reset`
- **AND** bleibt `reset` auf echte Hard-Fail-Faelle begrenzt
- **AND** steht fuer Snapshot-Drift ein eigener Verifikationsbefehl `pnpm env:verify:db-schema-snapshot` bereit
