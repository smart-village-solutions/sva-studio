# app-e2e-integration-testing Specification

## Purpose

TBD - created by archiving change add-app-e2e-integration-testing. Update Purpose after archive.

## Requirements

### Requirement: Reproduzierbarer App-E2E-Integrationslauf

Das System SHALL einen reproduzierbaren End-to-End-Integrationslauf bereitstellen, der die laufende App mit dem lokalen Service-Stack validiert.

#### Scenario: Vollständiger Smoke-Lauf lokal

- **WHEN** ein Entwickler den definierten E2E-Target ausführt
- **THEN** wird die App gestartet und gegen den Docker-Stack getestet
- **AND** der Lauf endet mit einem eindeutigen Pass/Fail-Ergebnis

### Requirement: Mindestabdeckung kritischer Navigationspfade

Das System SHALL mindestens die Root-Shell, eine echte Kernroute, eine Plugin-Route und den Auth-Entry-Point im E2E-Smoketest abdecken.

#### Scenario: Kernrouten verfügbar

- **WHEN** der E2E-Smoketest läuft
- **THEN** liefern `/` und `/interfaces` erfolgreiche Antworten
- **AND** die produktive Plugin-Route `/plugins/news` wird über authentifizierte clientseitige Navigation erfolgreich gerendert
- **AND** `/auth/login` liefert den erwarteten Redirect-Flow

#### Scenario: Clientseitige Navigation hält die Shell aktiv

- **WHEN** der Browser von `/` clientseitig über `/plugins/news` nach `/interfaces` navigiert
- **THEN** bleibt die App-Shell erhalten
- **AND** es erfolgt kein Full Reload der gesamten Anwendung

### Requirement: Service-Readiness als Testvoraussetzung

Das System SHALL vor dem eigentlichen E2E-Lauf die Verfügbarkeit der benötigten Services prüfen.

#### Scenario: Service nicht verfügbar

- **WHEN** Redis, Loki, OTEL oder Promtail nicht erreichbar/healthy ist
- **THEN** bricht der E2E-Lauf frühzeitig mit klarer Fehlermeldung ab
- **AND** der Fehler nennt den betroffenen Service explizit

### Requirement: Live IAM Smoke Coverage

Live IAM smoke tests SHALL verify that Studio can be used as a practical Keycloak-admin UI for supported user and role workflows in both platform and tenant scopes.

#### Scenario: Root smoke validates editable platform IAM

- **WHEN** post-deploy smoke tests against `studio.smart-village.app` run
- **THEN** they verify Platform user listing, filtering, detail loading, role listing, and at least one non-destructive editable workflow
- **AND** they record Sync/Reconcile diagnostics without accepting hidden `invalid_instance_id` failures

#### Scenario: Tenant smoke validates tenant Keycloak administration

- **WHEN** post-deploy smoke tests against tenant hosts run
- **THEN** they verify tenant user listing, mapping visibility, role listing, and role reconcile
- **AND** `partial_failure` results are recorded with object counts and diagnosis instead of being treated as browser crashes

#### Scenario: Forbidden tenant admin rights are diagnosable

- **WHEN** a tenant role operation returns `IDP_FORBIDDEN`
- **THEN** the smoke captures the visible diagnosis and confirms the page remains usable

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
