## MODIFIED Requirements

### Requirement: Build- und Target-Konventionen

Das System SHALL standardisierte Nx Targets für Build, Lint und Testarten bereitstellen, mit klarer Trennung zwischen Unit-, Coverage- und Integrationstests sowie Nx-Caching ausschließlich für nachweislich deterministische Targets.

#### Scenario: Standardisierte Targets

- **WHEN** ein neues Package oder eine App erstellt wird
- **THEN** sind mindestens `build`, `lint` und ein Testtarget definiert
- **AND** Target-Namen folgen Workspace-Konventionen
- **AND** Test-Targets haben korrekte `cache`, `inputs` und gegebenenfalls `outputs` in `nx.json`

#### Scenario: Coverage-Target mit bewiesenem Nx Cache

- **WHEN** `test:coverage` für ein Projekt cachefähig aktiviert wird
- **THEN** umfassen die Inputs mindestens Projektquellen, Tests, Abhängigkeiten, Toolchain und zentrale Vitest-/Coverage-Konfiguration
- **AND** umfassen die Outputs alle vom Gate benötigten Coverage-Artefakte
- **AND** Contract-Tests beweisen, dass Cache Restore und Fresh Run dasselbe Gate-Ergebnis liefern

#### Scenario: Coverage-Target ohne sicheren Cache-Vertrag

- **WHEN** vollständige Inputs, Outputs oder Restore-Äquivalenz nicht belegt sind
- **THEN** ist Cache für dieses `test:coverage`-Target explizit deaktiviert
- **AND** das Projekt bleibt dennoch Teil des vollständigen Coverage-Gates

#### Scenario: Zentrale Vitest-Workspace-Konfiguration

- **WHEN** ein neues Package erstellt wird
- **THEN** referenziert es die zentrale Vitest-Konfiguration im Root
- **AND** die package-spezifische `vitest.config.ts` enthält nur erforderliche Overrides
- **AND** Coverage-Reporter sind über alle Packages konsistent

### Requirement: Nx Caching für Test-Targets

Das System SHALL Nx Caching für nachweislich deterministische Test-Targets aktivieren und vollständige Cache-Inputs sowie erforderliche Outputs definieren. Infra-abhängige oder nicht deterministische Targets SHALL ungecacht bleiben.

#### Scenario: Named Inputs für Testing

- **GIVEN** `nx.json` im Root existiert
- **WHEN** Named Inputs für Tests definiert sind
- **THEN** umfassen sie Testdateien, Projektquellen, relevante Abhängigkeiten, Toolchain und zentrale Testkonfiguration
- **AND** Environment-Einflüsse werden entweder explizit gehasht oder machen das Target ungecacht

#### Scenario: Cache-Output-Definition

- **WHEN** ein artefaktproduzierendes Testtarget cachefähig ist
- **THEN** sind alle vom nachfolgenden Gate benötigten Outputs explizit deklariert
- **AND** ein Contract-Test bestätigt identische Artefakte und Gate-Entscheidung nach Restore

#### Scenario: Nicht deterministisches Testtarget

- **WHEN** ein Testtarget von Live-Services, Uhrzeit, unkontrollierten externen Zuständen oder einem nicht reproduzierbaren Browserlauf abhängt
- **THEN** ist Nx-Caching für dieses Target deaktiviert
- **AND** ein Cache-Hit darf dessen Ausführung nicht ersetzen

#### Scenario: Cache-Debugging

- **WHEN** ein Entwickler einen falschen Cache-Hit vermutet
- **THEN** kann er das Target mit `--skipNxCache` frisch ausführen
- **AND** die Entwicklerdokumentation beschreibt Cache-Key, Inputs, Outputs und sichere Bereinigung

## ADDED Requirements

### Requirement: PR-Quality-Gates priorisieren direkt geänderten Code

Das Monorepo SHALL PR-Unit- und vergleichbare projektbezogene Quality Gates in eine priorisierte Phase für direkt geänderte Projekte und einen disjunkten übrigen Scope planen.

#### Scenario: Direkt geändertes Projekt enthält einen Testfehler

- **GIVEN** ein Pull Request ändert ein Nx-Projekt direkt
- **WHEN** dessen priorisiertes Unit-Target fehlschlägt
- **THEN** meldet der PR-Pfad den bestätigten Fehler ohne zuvor alle übrigen affected Projekte auszuführen
- **AND** der erforderliche Gate-Status ist für den exakten Head-SHA rot

#### Scenario: Priorisierte Phase ist grün

- **WHEN** die direkt geänderten Projekte ihre priorisierte Phase bestehen
- **THEN** wird der übrige affected beziehungsweise vollständige Scope ausgeführt
- **AND** direkt ausgeführte Targets werden nicht erneut als eigener Shard geplant

#### Scenario: Scope-Planung ist unsicher

- **WHEN** Base-/Head-SHA, Projektgraph oder Dateizuordnung nicht sicher ausgewertet werden kann
- **THEN** fällt das Gate auf den vollständigen sicheren Scope zurück
- **AND** kein Projekt wird aufgrund einer Heuristik ausgelassen

### Requirement: Deterministische PR-Fehler brechen früh und ohne pauschalen Retry ab

Das Monorepo SHALL PR-Unit-Läufe nach einem bestätigten deterministischen Target-Fehler beenden und automatische Wiederholungen auf klassifizierte temporäre Infrastrukturfehler begrenzen.

#### Scenario: Unit-Assertion schlägt fehl

- **WHEN** ein Unit-Target wegen Assertion, Snapshot oder deterministischem Prozess-Exit fehlschlägt
- **THEN** startet der PR-Job keine weiteren Unit-Targets desselben Plans
- **AND** wiederholt er weder das fehlgeschlagene Target noch den gesamten affected Scope automatisch

#### Scenario: Klassifizierter Infrastrukturfehler tritt auf

- **WHEN** ein dokumentierter temporärer Runner-, Netzwerk- oder Service-Setup-Fehler erkannt wird
- **THEN** darf höchstens der betroffene Setup-Schritt oder das betroffene Target begrenzt wiederholt werden
- **AND** bereits erfolgreiche Targets werden nicht pauschal erneut ausgeführt

#### Scenario: Fehler kann nicht klassifiziert werden

- **WHEN** ein Fehler weder sicher deterministisch noch als erlaubter Infrastrukturzustand klassifiziert werden kann
- **THEN** bleibt der PR-Status rot
- **AND** der Lauf wird nicht durch einen automatischen Retry in einen grünen Status umgewandelt

### Requirement: Required Checks aggregieren parallele Teiljobs fail-closed

Das Monorepo SHALL parallele Fast-Feedback-, Phasen- und Shard-Jobs über stabile finale Required-Check-Kontexte auswerten.

#### Scenario: Interne Jobs werden parallelisiert

- **WHEN** Unit oder ein anderes Required Gate in mehrere interne Jobs aufgeteilt wird
- **THEN** bleibt der bestehende Required-Check-Name stabil
- **AND** ein finaler Aggregator prüft alle für den Scope erwarteten Ergebnisse

#### Scenario: Erwartetes Teilergebnis fehlt

- **WHEN** ein erwarteter Job rot, abgebrochen, veraltet, doppelt oder ohne gültiges Head-SHA-Artefakt ist
- **THEN** schlägt der Aggregator fail-closed fehl
- **AND** ein nicht explizit im Scope-Plan übersprungener Job kann nicht als Erfolg gewertet werden

### Requirement: PR-CI weist schnelle Rückmeldung messbar nach

Das Monorepo SHALL Zeit bis zum ersten bestätigten handlungsfähigen Fehler und terminale Required-Check-Zeit getrennt messen und auswertbar dokumentieren.

#### Scenario: PR-Gate wird ausgeführt

- **WHEN** ein relevanter PR-Workflow läuft
- **THEN** erfasst seine Evidenz Base-/Head-SHA, Scope, Queue-, Setup-, Ausführungs- und Aggregationsdauer
- **AND** erfasst sie Zeitpunkt und Klassifikation des ersten bestätigten Fehlers sowie Cache-Hits und Retries
- **AND** enthält sie keine Secrets, vollständigen Environment-Dumps oder PII

#### Scenario: Optimierung wird abgenommen

- **WHEN** mindestens 20 repräsentative PR-Läufe nach der Aktivierung ausgewertet werden
- **THEN** liegt die mediane Zeit bis zum bestätigten direkt zuordenbaren Fehler bei höchstens 3 Minuten und P90 bei höchstens 5 Minuten
- **AND** steigt die mediane terminale Zeit grüner Required Checks gegenüber der Baseline um höchstens 30 Sekunden
