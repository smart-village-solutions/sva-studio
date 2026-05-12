## ADDED Requirements

### Requirement: PR-Unit-Pfad darf App-Unit-Slices selektiv ausführen
Das System SHALL im PR-Pfad bei isolierten App-Änderungen nur die betroffenen App-Unit-Slices statt der kompletten App-Unit-Suite ausführen dürfen.

#### Scenario: App-only-PR nutzt Slice-Ausführung
- **GIVEN** ein Pull Request ändert ausschließlich eindeutig zuordenbare Dateien unter `apps/sva-studio-react`
- **WHEN** der PR-Unit-Pfad bestimmt wird
- **THEN** werden nur die betroffenen App-Unit-Slices ausgeführt
- **AND** andere betroffene Workspace-Projekte laufen weiterhin über den normalen affected-Mechanismus

#### Scenario: Gemischter PR nutzt den sicheren Fallback
- **GIVEN** ein Pull Request enthält App- und Nicht-App-Änderungen oder mehrdeutige App-Dateien
- **WHEN** der PR-Unit-Pfad bestimmt wird
- **THEN** fällt die App-Unit-Ausführung auf das aggregierte `sva-studio-react:test:unit`-Target zurück
- **AND** der PR-Pfad vermeidet riskante Unterabdeckung

#### Scenario: Laufzeit-Summary macht Drift sichtbar
- **WHEN** der lokale PR-Runner oder ein gleichwertiger Gate-Runner ausgeführt wird
- **THEN** schreibt er für Gates und ausgeführte App-Slices eine kurze Dauer-Zusammenfassung
- **AND** Laufzeitdrift wird ohne gesonderte manuelle Messung sichtbar
