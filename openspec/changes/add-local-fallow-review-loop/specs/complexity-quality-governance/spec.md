## ADDED Requirements

### Requirement: Begrenzter lokaler Fallow-Bearbeitungslauf

Das Repository SHALL einen lokalen Operator-Pfad bereitstellen, der geeignete Fallow-Befunde ohne manuelle Vorgabe einzelner Dateien zu zusammenhängenden, menschlich prüfbaren Draft-PRs verarbeitet. Der Pfad MUST Modellvorschläge vor GitHub-Veröffentlichung auf erlaubten Scope und vorhandene Qualitätsnachweise begrenzen und MUST ohne automatischen Merge enden.

#### Scenario: Zusammengehörige Befunde werden gemeinsam geprüft

- **GIVEN** mehrere risikoarme Fallow-Befunde betreffen denselben Verantwortungsbereich eines Nx-Projekts
- **WHEN** der lokale Lauf Kandidaten auswählt
- **THEN** behandelt er sie als ein begrenztes Änderungsbündel mit einem gemeinsamen Zweck
- **AND** erzeugt höchstens einen Draft-PR für dieses Bündel statt je Befund einen PR oder ein GitHub-Issue

#### Scenario: Modellantwort verletzt den erlaubten Scope

- **GIVEN** das lokale Modell schlägt einen No-op, einen ungültigen Diff oder eine Änderung außerhalb des Bündels vor
- **WHEN** der Controller die Antwort prüft
- **THEN** veröffentlicht er keinen Branch oder PR für diesen Vorschlag
- **AND** hält den Verwerfungsgrund lokal nachvollziehbar fest

#### Scenario: Geprüftes Bündel wird als Draft-PR veröffentlicht

- **GIVEN** der exakte Diff, Fallow-Nachscan und die betroffenen Nx-/Dateiplatzierungs-Gates sind erfolgreich
- **WHEN** der Controller den PR erstellt
- **THEN** enthält dieser den erforderlichen Changelog-Eintrag und den Prüfkontext
- **AND** bleibt ein Draft ohne automatischen Merge
- **AND** der Lauf beobachtet die GitHub-Gates am finalen HEAD

#### Scenario: Lauf wird nach Unterbrechung fortgesetzt

- **GIVEN** ein früherer Lauf hat bereits einen Worktree, Branch oder Draft-PR für ein Bündel erzeugt
- **WHEN** der Operator-Pfad erneut startet
- **THEN** erkennt er die vorhandene Arbeit und veröffentlicht keinen doppelten PR
