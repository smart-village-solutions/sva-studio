## ADDED Requirements

### Requirement: PR-E2E meldet bestätigte Fehler früh

Das System SHALL App-E2E-Läufe in Pull Requests nach dem ersten gemäß Retry-Policy bestätigten Testfehler beenden, während Main- und Nightly-Läufe weiterhin die vollständige Fehlermatrix erfassen.

#### Scenario: PR-E2E-Test scheitert auch im Retry

- **GIVEN** ein App-E2E-Test darf gemäß Policy einmal wiederholt werden
- **WHEN** derselbe Test im Retry erneut fehlschlägt
- **THEN** beendet der betroffene PR-E2E-Shard weitere Szenarien mit `maxFailures: 1`
- **AND** der erforderliche E2E-Status wird für den exakten Head-SHA rot
- **AND** Trace, Screenshot und Fehlerartefakte des bestätigten Fehlers bleiben verfügbar

#### Scenario: Nightly- oder Main-E2E enthält Fehler

- **WHEN** derselbe Lauf auf `main` oder im Nightly-Kontext ausgeführt wird
- **THEN** ist kein PR-spezifisches `maxFailures` aktiv
- **AND** alle geplanten Szenarien werden zur vollständigen Diagnose ausgeführt

### Requirement: Parallele App-E2E-Shards sind vollständig und isoliert

Das System SHALL eine parallele App-E2E-Ausführung ausschließlich über disjunkte GitHub-Jobs mit jeweils eigenem App-/SSR-Server ermöglichen und über einen fail-closed Aggregator absichern.

#### Scenario: E2E-Suite wird aufgeteilt

- **WHEN** ein PR-E2E-Plan mehrere Shards erzeugt
- **THEN** besitzt jeder Shard einen eigenen Runner und einen eigenen App-/SSR-Prozess
- **AND** kein Test ist mehreren Shards zugeordnet
- **AND** unbekannte Tests landen in einem konservativen Rest-Shard

#### Scenario: Direkt betroffenes E2E-Szenario existiert

- **WHEN** eine stabile Ownership-Zuordnung ein Szenario direkt mit den PR-Änderungen verbindet
- **THEN** startet dieses Szenario in einem priorisierten Shard
- **AND** alle übrigen relevanten Szenarien bleiben Teil des finalen PR-E2E-Scopes

#### Scenario: Shard fehlt oder ist nicht auswertbar

- **WHEN** ein erwarteter Shard abbricht oder kein gültiges Ergebnis für den Head-SHA liefert
- **THEN** schlägt der E2E-Aggregator fail-closed fehl
- **AND** der bestehende erforderliche App-E2E-Check bleibt rot oder ausstehend statt fälschlich grün zu werden
