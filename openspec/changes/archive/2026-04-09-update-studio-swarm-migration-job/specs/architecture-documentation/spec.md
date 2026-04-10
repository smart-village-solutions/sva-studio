## MODIFIED Requirements
### Requirement: Verbindliche Pflege im Entwicklungsworkflow

Das System SHALL die Pflege der Architektur-Dokumentation als Teil des Delivery-Workflows verankern.

#### Scenario: PR mit Architekturänderung

- **WHEN** ein PR Architektur oder Systemgrenzen verändert
- **THEN** enthält der PR eine Aktualisierung der relevanten arc42-Abschnitte
- **AND** die Review-Checkliste prüft diese Aktualisierung

#### Scenario: Acceptance-Deployvertrag wird geändert

- **WHEN** sich der verbindliche Serverdeploypfad für `acceptance-hb` ändert
- **THEN** aktualisieren die arc42-Abschnitte `07-deployment-view` und `08-cross-cutting-concepts` den Releaseablauf, die Migrationsregeln und die Deploy-Evidenz
- **AND** das zugehörige Runbook beschreibt dieselbe Reihenfolge wie die implementierten Ops-Kommandos

#### Scenario: Acceptance-Deploy nutzt dedizierten Migrationsjob

- **WHEN** ein Change den Acceptance-Schemarollout von Remote-`exec` auf einen dedizierten Swarm-Migrationsjob umstellt
- **THEN** dokumentiert die Architekturdokumentation den Ablauf `precheck -> migrate-job -> schema-assertions -> app-rollout -> verify -> smoke`
- **AND** beschreibt sie die neue Deploy-Evidenz für Job-Stack, Service, Exit-Code und Post-Migration-Guard

#### Scenario: Acceptance-Deploy nutzt dedizierten Bootstrap-Job und exec-freie Verify-Gates

- **WHEN** ein Change den Post-Migration-Bootstrap und die technischen Verify-Gates von `quantum-cli exec` entkoppelt
- **THEN** dokumentiert die Architekturdokumentation den Ablauf `precheck -> migrate-job -> bootstrap-job -> schema-assertions -> app-rollout -> verify -> smoke`
- **AND** beschreibt sie die Deploy-Evidenz für Bootstrap-Job, Exit-Code und die auf HTTP-/Swarm-Signalen basierende interne Verifikation
