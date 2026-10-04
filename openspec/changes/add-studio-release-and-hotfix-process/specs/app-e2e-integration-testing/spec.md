## MODIFIED Requirements

### Requirement: Vollständiges App-E2E läuft außerhalb des PR-Gates

Das System SHALL den vollständigen App-E2E-Lauf aus dem Pull-Request-Gate heraushalten und ihn genau einmal pro Push auf `main` sowie pro ausdrücklich angefordertem, kanonischem Hotfix-Dispatch des aktuellen Controllers ausführen. Es SHALL keine separate kleine, zielgerichtete oder affected-basierte PR-E2E-Suite bereitstellen.

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

#### Scenario: Kanonischer Hotfix-Commit wird ausdrücklich geprüft

- **WHEN** der aktuelle `main`-Controller im Hotfix-Modus für einen validierten Prod-basierten Hotfix-Ref und Head-SHA gestartet wird
- **THEN** checkt er diesen Head-SHA aus und startet genau einen vollständigen App-E2E-Lauf für ihn
- **AND** wird kein automatischer Dev-Rollout daraus abgeleitet

#### Scenario: Nightly oder manueller Diagnoselauf wird ausgeführt

- **WHEN** App-E2E zeitgesteuert oder ohne validierten Hotfix-Modus manuell ausgeführt wird
- **THEN** darf der Lauf den vollständigen Szenario-Scope diagnostizieren
- **AND** ist sein Ergebnis nicht als Release-Evidenz für einen Staging-Promote zulässig

### Requirement: Main-E2E-Evidenz ist exakt an den Commit gebunden

Das System SHALL für jeden kanonischen Main- oder Hotfix-E2E-Lauf eine maschinenlesbare, redigierte Evidenz erzeugen, die den geprüften Quellstand eindeutig identifiziert, ohne den lokalen Playwright-Lauf als Prüfung des Containerartefakts darzustellen.

#### Scenario: Kanonischer E2E-Lauf endet terminal

- **WHEN** der kanonische App-E2E-Lauf für einen Main-Push oder Hotfix-Dispatch endet
- **THEN** enthält seine Evidenz mindestens Workflow, Event, Controller-Revision, Quell-Ref, ausgecheckten Head-SHA, Run-ID, Attempt und terminales Ergebnis
- **AND** enthält sie keine Secrets, vollständigen Environment-Dumps oder personenbezogenen Daten
- **AND** bezeichnet sie den lokalen App-/Service-Stack als Prüfgegenstand

#### Scenario: Deterministischer E2E-Fehler tritt auf

- **WHEN** ein App-E2E-Szenario für den Main- oder Hotfix-Commit deterministisch fehlschlägt
- **THEN** bleibt die Evidenz für dieses Head-SHA rot
- **AND** wird der Fehler nicht durch einen automatischen Erfolgs-Retry in releasefähige Evidenz umgewandelt
- **AND** bleiben Trace, Screenshot und Fehlerartefakte für die Diagnose verfügbar

#### Scenario: Infrastrukturfehler wird erneut ausgeführt

- **WHEN** ein dokumentierter temporärer Infrastrukturfehler eine manuelle Wiederholung rechtfertigt
- **THEN** bleibt die Wiederholung als weiterer Attempt desselben kanonischen Runs nachvollziehbar
- **AND** darf nur ein terminal erfolgreicher Attempt für exakt dasselbe Head-SHA und denselben Ref als Release-Evidenz dienen
