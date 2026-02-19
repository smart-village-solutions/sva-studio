## MODIFIED Requirements

### Requirement: Build- und Target-Konventionen
Das System SHALL standardisierte Nx Targets für `build`, `lint` und `test:unit` bereitstellen; produktionsrelevante Projekte dürfen für diese Targets keine Platzhalter-Kommandos verwenden.

#### Scenario: Standardisierte Qualitäts-Targets vorhanden
- **WHEN** ein neues Package oder eine neue App erstellt oder in den aktiven Entwicklungsfluss aufgenommen wird
- **THEN** sind `build`, `lint` und `test:unit` als Nx Targets definiert
- **AND** die Targets führen reale Tooling-Prüfungen aus

#### Scenario: Platzhalter-Target ist unzulässig
- **WHEN** ein Entwickler `nx run <project>:lint` oder `nx run <project>:test:unit` ausführt
- **THEN** wird ein echter Lint- bzw. Test-Runner ausgeführt
- **AND** das Ergebnis kann bei Regel-/Testverstößen fehlschlagen

#### Scenario: Target-Konvention für Workspace-Befehle
- **WHEN** `nx run-many -t lint` oder `nx run-many -t test:unit` aufgerufen wird
- **THEN** greifen die Befehle konsistent über alle relevanten Projekte
- **AND** die Ergebnisse sind projektübergreifend vergleichbar
