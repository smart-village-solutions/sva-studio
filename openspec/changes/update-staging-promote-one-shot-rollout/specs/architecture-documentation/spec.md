## MODIFIED Requirements

### Requirement: Verbindliche Pflege im Entwicklungsworkflow

Das System SHALL die Pflege der Architektur-Dokumentation als Teil des Delivery-Workflows verankern.

#### Scenario: Studio-Deployvertrag wird geändert

- **WHEN** sich der verbindliche Serverdeploypfad für `studio` ändert
- **THEN** aktualisieren die arc42-Abschnitte `07-deployment-view`, `08-cross-cutting-concepts` und bei neuen Betriebsrisiken `11-risks-and-technical-debt` den Releaseablauf, die Migrationsregeln, die Autorisierung und die Deploy-Evidenz
- **AND** beschreibt das zugehörige Swarm-Runbook dieselbe Reihenfolge wie der implementierte `Promote`-Workflow

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
