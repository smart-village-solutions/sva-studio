## MODIFIED Requirements

### Requirement: Lokale Studio-Runtime-Werkzeuge bleiben Diagnose und Recovery

Das System SHALL für das Runtime-Profil `studio` lokale Diagnose- und Recovery-Werkzeuge bereitstellen, ohne daraus einen konkurrierenden Standardpfad zum GitHub-basierten `Build`- und `Promote`-Rollout zu machen und ohne Wartungsfenster-Verweise als technische Pflicht zu verwenden.

#### Scenario: Root-Scripts bilden den Studio-Releasepfad ab

- **WHEN** `package.json` im Repository geprüft wird
- **THEN** existieren `env:status:studio`, `env:doctor:studio`, `env:precheck:studio` und `env:smoke:studio`
- **AND** lokale mutierende Runtime-Einstiege sind ausschließlich als Incident-Recovery klassifiziert
- **AND** GitHub-Workflows `build.yml` und `promote.yml` bilden den einzigen regulären Rolloutpfad ab

#### Scenario: Schemaänderung benötigt kein Wartungsfenster-Pflichtfeld

- **WHEN** ein genehmigter Incident-Recovery-Pfad lokale Schema- und App-Mutationen benötigt
- **THEN** steuern die vorhandene Freigabe, Backups, Postconditions und Verifikation den Ablauf
- **AND** blockiert ein fehlender Wartungsfenster-Verweis den Recovery-Pfad nicht
