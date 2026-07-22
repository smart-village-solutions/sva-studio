## MODIFIED Requirements

### Requirement: Verbindliche Pflege im Entwicklungsworkflow

Das System SHALL die Pflege der Architektur-Dokumentation als Teil des Delivery-Workflows verankern.

#### Scenario: PR mit Architekturänderung

- **WHEN** ein PR Architektur oder Systemgrenzen verändert
- **THEN** enthält der PR eine Aktualisierung der relevanten arc42-Abschnitte
- **AND** die Review-Checkliste prüft diese Aktualisierung

#### Scenario: Studio-Deployvertrag wird geändert

- **WHEN** sich der verbindliche Serverdeploypfad für `studio` ändert
- **THEN** aktualisieren die arc42-Abschnitte `07-deployment-view` und `08-cross-cutting-concepts` den Releaseablauf, die Migrationsregeln und die Deploy-Evidenz
- **AND** das zugehörige Runbook beschreibt dieselbe Reihenfolge wie die implementierten Ops-Kommandos

#### Scenario: Rollout-Hardening ergänzt Netzwerk- und Ingress-Vertrag

- **WHEN** ein Change den Live-Rolloutpfad gegen Netzwerk- oder Ingress-Drift härtet
- **THEN** aktualisieren `07-deployment-view` und `08-cross-cutting-concepts` die Trennung zwischen Live-Stack und Temp-Job-Stacks, den verpflichtenden App-Netzvertrag sowie den Recovery-Pfad
- **AND** beschreibt das Runtime-Runbook dieselben Drift-Signale und dieselbe Operator-Reihenfolge wie die implementierten Prechecks und Deploy-Reports

## ADDED Requirements

### Requirement: Architektur dokumentiert GitHub Actions als kanonischen Staging-Pfad

Die Architektur- und Betriebsdokumentation SHALL GitHub Actions `Promote` als kanonischen mutierenden Staging-Pfad und den lokalen Operatorpfad als Diagnose-/Recovery-Werkzeug beschreiben.

#### Scenario: Staging- und Production-Grenzen sind nachvollziehbar

- **WHEN** ein Teammitglied den Studio-Rollout nachschlägt
- **THEN** beschreiben `07-deployment-view` und das Swarm-Runbook die Reihenfolge Preflight, Migration, optional Bootstrap, Postconditions, App-Deploy und Verifikation für Staging
- **AND** beschreibt `08-cross-cutting-concepts` die Environment-Freigabe, Wartungsfenster-Referenz, Geheimnisredaktion und Artefaktbindung
- **AND** dokumentieren sie Production als weiterhin verfügbaren App-only-Pfad mit gesperrten `run`-Modi und klaren Voraussetzungen für einen separaten Folgechange

#### Scenario: Rollout-Evidenz und Recovery sind dokumentiert

- **WHEN** ein Staging-Promote fehlschlägt oder eine Verifikation verletzt
- **THEN** beschreibt die Betriebsdokumentation die redigierten Evidenzartefakte, den vorherigen App-Digest, das Cleanup-Verhalten und den lokalen Recovery-Pfad
- **AND** grenzt sie automatisches Datenbank-Rollback ausdrücklich aus
