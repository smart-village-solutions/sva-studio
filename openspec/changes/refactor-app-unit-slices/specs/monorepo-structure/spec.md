## ADDED Requirements

### Requirement: App-Unit-Targets dürfen in stabile Slices aufgeteilt werden
Das Monorepo SHALL für große App-Test-Suiten mehrere stabile Nx-Unit-Targets neben einem aggregierten Voll-Target bereitstellen können.

#### Scenario: Aggregiertes Voll-Target bleibt erhalten
- **WHEN** `sva-studio-react` seine Unit-Suite in Slices aufteilt
- **THEN** existiert weiterhin ein aggregiertes `test:unit`-Target für volle Läufe
- **AND** `main`- und andere Voll-Gates behalten damit ihre bisherige Semantik

#### Scenario: App-Slices sind einzeln ausführbar
- **WHEN** ein Entwickler gezielt einen App-Teilbereich validieren will
- **THEN** kann er `test:unit:ui`, `test:unit:routes`, `test:unit:hooks` oder `test:unit:server` direkt ausführen
- **AND** jeder Slice nutzt dieselben gemeinsamen Vitest-Basisdefaults

#### Scenario: Unklare App-Datei nutzt den sicheren Fallback
- **WHEN** eine geänderte App-Datei keinem Slice eindeutig zugeordnet werden kann
- **THEN** wird kein partieller Slice-Lauf erzwungen
- **AND** der PR-Pfad fällt auf das aggregierte App-Unit-Target zurück
