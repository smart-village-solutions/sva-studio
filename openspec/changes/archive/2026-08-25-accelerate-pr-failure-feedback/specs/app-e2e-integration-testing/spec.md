## ADDED Requirements

### Requirement: Vollständiges App-E2E läuft außerhalb des PR-Gates

Das System SHALL den vollständigen App-E2E-Lauf aus dem Pull-Request-Gate entfernen und ihn genau einmal pro Push auf `main` ausführen. Es SHALL keine separate kleine, zielgerichtete oder affected-basierte PR-E2E-Suite bereitstellen.

#### Scenario: Pull Request wird geprüft

- **WHEN** ein Pull Request erstellt oder aktualisiert wird
- **THEN** startet der GitHub-PR-Pfad keinen App-E2E-Lauf
- **AND** führt `pnpm test:pr` kein App-E2E-Target aus
- **AND** bleiben Unit-, Type-, Lint-, Coverage-, Integrations-, Build-, Security- und Complexity-Gates davon unberührt

#### Scenario: Commit wird nach Main gepusht

- **WHEN** ein Commit durch Push auf `main` landet
- **THEN** startet genau ein kanonischer vollständiger App-E2E-Lauf für dieses Head-SHA
- **AND** führt der Lauf den vollständigen bestehenden Szenario-Scope ohne PR-spezifische Auswahlheuristik aus
- **AND** bleibt E2E ungecacht

#### Scenario: Nightly oder manueller Diagnoselauf wird ausgeführt

- **WHEN** App-E2E zeitgesteuert oder manuell ausgeführt wird
- **THEN** darf der Lauf den vollständigen Szenario-Scope diagnostizieren
- **AND** ist sein Ergebnis nicht als Release-Evidenz für einen regulären Staging-Promote zulässig

### Requirement: Main-E2E-Evidenz ist exakt an den Commit gebunden

Das System SHALL für jeden kanonischen Main-E2E-Lauf eine maschinenlesbare, redigierte Evidenz erzeugen, die den geprüften Quellstand eindeutig identifiziert, ohne den lokalen Playwright-Lauf als Prüfung des Containerartefakts darzustellen.

#### Scenario: Main-E2E-Lauf endet terminal

- **WHEN** der kanonische App-E2E-Lauf für einen Main-Push endet
- **THEN** enthält seine Evidenz mindestens Workflow, `push`-Event, `main`-Ref, Head-SHA, Run-ID, Attempt und terminales Ergebnis
- **AND** enthält sie keine Secrets, vollständigen Environment-Dumps oder personenbezogenen Daten
- **AND** bezeichnet sie den lokalen App-/Service-Stack als Prüfgegenstand

#### Scenario: Deterministischer E2E-Fehler tritt auf

- **WHEN** ein App-E2E-Szenario für den Main-Commit deterministisch fehlschlägt
- **THEN** bleibt die Evidenz für dieses Head-SHA rot
- **AND** wird der Fehler nicht durch einen automatischen Erfolgs-Retry in releasefähige Evidenz umgewandelt
- **AND** bleiben Trace, Screenshot und Fehlerartefakte für die Diagnose verfügbar

#### Scenario: Infrastrukturfehler wird erneut ausgeführt

- **WHEN** ein dokumentierter temporärer Infrastrukturfehler eine manuelle Wiederholung rechtfertigt
- **THEN** bleibt die Wiederholung als weiterer Attempt desselben kanonischen Runs nachvollziehbar
- **AND** darf nur ein terminal erfolgreicher Attempt für exakt dasselbe Head-SHA als Release-Evidenz dienen
