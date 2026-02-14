# test-coverage-governance Specification

## Purpose
TBD - created by archiving change add-test-coverage-governance. Update Purpose after archive.
## Requirements
### Requirement: Einheitliche Coverage-Messung
Das System SHALL für alle relevanten Projekte Unit-Test-Coverage standardisiert messen und als maschinenlesbare Reports erzeugen.

#### Scenario: Coverage-Report pro Projekt
- **WHEN** `test:coverage` für ein Projekt ausgeführt wird
- **THEN** werden mindestens `coverage-summary` und `lcov` erzeugt
- **AND** die Reports sind CI-verarbeitbar

### Requirement: Coverage-Gates pro Paket und Global
Das System SHALL Coverage-Gates sowohl auf Paketebene als auch auf globaler Ebene erzwingen.

#### Scenario: Paket-Gate verletzt
- **WHEN** ein betroffenes Paket unter den definierten Floor fällt
- **THEN** schlägt der CI-Check fehl
- **AND** der Fehler benennt Paket, Metrik und Ist/Soll-Wert

#### Scenario: Globales Gate verletzt
- **WHEN** die globale Coverage unter den definierten Floor fällt
- **THEN** schlägt der CI-Check fehl
- **AND** die globale Abweichung wird im Report ausgewiesen

### Requirement: Stufenweiser Rollout mit Baseline
Das System SHALL Coverage-Floors stufenweise einführen und an einer dokumentierten Baseline ausrichten.

#### Scenario: Baseline als Ausgangspunkt
- **WHEN** Coverage-Governance initial aktiviert wird
- **THEN** existiert eine Baseline pro Paket und Metrik
- **AND** Gate-Entscheidungen beziehen sich auf Baseline und aktuelle Floors

#### Scenario: Ratcheting
- **WHEN** ein Paket stabil über dem aktuellen Floor liegt
- **THEN** dürfen Floors für dieses Paket schrittweise angehoben werden
- **AND** Floors werden niemals automatisch abgesenkt

### Requirement: Trennung von Unit- und Integrationstests
Das System SHALL infra-abhängige Integrationstests getrennt von Unit-Coverage-Gates ausführen.

#### Scenario: PR-Workflow
- **WHEN** ein Pull Request validiert wird
- **THEN** blockieren Unit-Coverage-Gates den PR
- **AND** Integrationstests können in PR optional separat laufen

#### Scenario: Nightly/Main Workflow
- **WHEN** Nightly oder Main-Pipeline ausgeführt wird
- **THEN** werden Integrationstests verpflichtend ausgeführt
- **AND** deren Ergebnis wird separat ausgewiesen

### Requirement: PR-Transparenz
Das System SHALL Coverage-Ergebnisse in Pull Requests als strukturierte Summary und Artefakte bereitstellen.

#### Scenario: PR Summary
- **WHEN** ein Coverage-Check in CI durchläuft
- **THEN** enthält die PR Summary Coverage pro betroffenem Paket und global
- **AND** enthält Delta zur Baseline

#### Scenario: Artefakt-Verfügbarkeit
- **WHEN** ein Coverage-Check abgeschlossen ist
- **THEN** sind Coverage-Artefakte für Reviewer downloadbar

### Requirement: Performante Coverage-Ausführung via Nx Cache
Das System SHALL Nx Caching für Coverage-Targets nutzen, um redundante Test-Runs zu vermeiden und CI-Performance zu optimieren.

#### Scenario: Coverage-Cache bei unveränderten Inputs
- **GIVEN** ein Projekt hat bereits Coverage generiert
- **WHEN** Quellcode und Testcode unverändert sind
- **THEN** wird Coverage aus Nx Cache wiederverwendet
- **AND** Test-Run wird übersprungen (Cache Hit)
- **AND** Coverage-Reports werden aus Cache restored

#### Scenario: Cache-Invalidierung bei Änderungen
- **WHEN** Quellcode, Testcode oder vitest.config.ts sich ändern
- **THEN** wird Nx Cache invalidiert
- **AND** Coverage wird neu generiert
- **AND** neue Coverage wird in Cache gespeichert

#### Scenario: Nx Cache in CI
- **GIVEN** GitHub Actions Workflow läuft
- **WHEN** affected Coverage-Targets ausgeführt werden
- **THEN** nutzt Nx GitHub Actions Cache
- **AND** zweiter PR-Push mit wenig Änderungen spart 30-50% CI-Zeit

---

### Requirement: Zentrale Vitest-Konfiguration
Das System SHALL eine zentrale vitest.workspace.ts im Root bereitstellen, die konsistente Coverage-Konfiguration über alle Packages sicherstellt.

#### Scenario: Workspace-Config als Single Source of Truth
- **GIVEN** `vitest.workspace.ts` im Root existiert
- **WHEN** ein neues Package Coverage generiert
- **THEN** verwendet es automatisch zentrale Reporter-Konfiguration
- **AND** Coverage-Output-Format ist konsistent (text-summary, json-summary, lcov)
- **AND** Package benötigt minimale lokale vitest.config.ts

#### Scenario: Package-spezifische Overrides
- **GIVEN** ein Package benötigt spezielle Test-Umgebung (z.B. jsdom statt node)
- **WHEN** Package lokale vitest.config.ts mit Override definiert
- **THEN** merged Vitest zentrale Config mit lokalen Overrides
- **AND** zentrale Coverage-Reporter bleiben aktiv

---

### Requirement: Verbesserte Gate-Output-Lesbarkeit
Das System SHALL Coverage-Gate-Ergebnisse mit farbigem Terminal-Output und strukturierter Formatierung bereitstellen.

#### Scenario: Farbiger Terminal-Output
- **WHEN** Coverage-Gate-Script lokal oder in CI ausgeführt wird
- **THEN** werden Erfolge grün markiert (✅)
- **AND** Fehler rot markiert (❌)
- **AND** Warnungen gelb markiert (⚠️)
- **AND** wichtige Metriken hervorgehoben (🎯)

#### Scenario: Strukturierte Fehler-Ausgabe
- **WHEN** Coverage-Gate fehlschlägt
- **THEN** werden Fehler gruppiert (per-project, global)
- **AND** jeder Fehler zeigt Ist/Soll-Wert
- **AND** Fehler sind sortiert (kritisch zuerst)

---

### Requirement: TypeScript-basiertes Gate-Tooling
Das System SHALL Coverage-Gate-Script in TypeScript implementieren, um Type Safety für Policy/Baseline-Strukturen zu garantieren.

#### Scenario: Type-sichere Policy-Validierung
- **GIVEN** coverage-gate.ts ist in TypeScript
- **WHEN** Policy-Datei invalide Struktur hat (z.B. falscher Metric-Name)
- **THEN** wird Fehler bei Compile-Zeit erkannt
- **AND** IDE zeigt Autocomplete für Policy-Felder
- **AND** Refactorings (z.B. Rename) betreffen alle Policy-Usages

#### Scenario: Runtime-Execution via tsx
- **WHEN** `pnpm coverage-gate` im Root ausgeführt wird
- **THEN** wird TypeScript via `tsx` transparent kompiliert und ausgeführt
- **AND** kein Pre-Build-Step erforderlich
- **AND** Stack-Traces zeigen TypeScript-Zeilen (Source-Maps)

---

### Requirement: Coverage-Trend-Visualisierung
Das System SHALL Coverage-Trends über Zeit visualisieren, entweder via Codecov-Integration oder erweiterte GitHub Actions Summary.

#### Scenario: Codecov Integration (Option A)
- **GIVEN** Codecov-Token als GitHub Secret konfiguriert
- **WHEN** Coverage-Workflow abgeschlossen ist
- **THEN** werden lcov-Reports zu Codecov hochgeladen
- **AND** PR erhält automatischen Kommentar mit Coverage-Diff
- **AND** Codecov-Dashboard zeigt Trend-Charts (letzte 30 Tage)

#### Scenario: Manuelle Summary (Option B / Fallback)
- **GIVEN** Codecov ist nicht konfiguriert oder ausgefallen
- **WHEN** Coverage-Gate-Script ausgeführt wird
- **THEN** erzeugt es erweiterte GitHub Actions Summary
- **AND** Summary enthält Delta-Indikatoren (🟢 +2%, 🔴 -1%)
- **AND** Summary zeigt Top-Improvers und Top-Regressors

---

### Requirement: Umfassende Troubleshooting-Dokumentation
Das System SHALL häufige Coverage-Fehlerszenarien mit Lösungen in Entwickler-Dokumentation bereitstellen.

#### Scenario: Selbsthilfe bei häufigen Fehlern
- **GIVEN** ein Entwickler erhält Coverage-Gate-Fehler "missing coverage-summary.json"
- **WHEN** er Troubleshooting-Guide in `docs/development/testing-coverage.md` konsultiert
- **THEN** findet er exakte Fehlermeldung als Überschrift
- **AND** erhält Step-by-Step-Lösung (Dependencies prüfen, Commands ausführen)
- **AND** kann Fehler ohne Support-Anfrage beheben

#### Scenario: Affected ist leer
- **GIVEN** ein Entwickler führt `test:coverage:affected` aus
- **WHEN** keine Projekte als betroffen erkannt werden
- **THEN** erklärt der Troubleshooting-Guide typische Ursachen (z. B. Base-Ref nicht aktuell)
- **AND** zeigt Debugging-Commands (Nx affected mit --verbose)

#### Scenario: Baseline Drop
- **GIVEN** Coverage ist im Vergleich zur Baseline gefallen
- **WHEN** das Gate fehlschlägt ("dropped by X pp")
- **THEN** dokumentiert der Guide den empfohlenen Fix (Tests ergänzen)
- **AND** beschreibt, wann ein Baseline-Update legitim ist (Team-Entscheid)

#### Scenario: Exemptions
- **GIVEN** ein Projekt ist coverage-exempt
- **WHEN** ein Entwickler erwartet Coverage-Auswertung
- **THEN** erklärt der Guide die Bedeutung von Exemptions
- **AND** beschreibt den Prozess zum Entfernen aus Exemptions

#### Scenario: No tests configured
- **GIVEN** ein Projekt hat keine Tests
- **WHEN** Coverage-Artefakte fehlen trotz grünem Run
- **THEN** erklärt der Guide die Ursache (keine Tests / passWithNoTests)
- **AND** beschreibt den Fix (mindestens ein Unit-Test)

#### Scenario: Migration-Guide für neue Packages
- **GIVEN** ein Entwickler will neues Package zur Coverage hinzufügen
- **WHEN** er Migration-Guide folgt
- **THEN** kann er in <5 Minuten Package konfigurieren
- **AND** alle Commands sind copy-pastable
- **AND** Validierung (Gate lokal testen) ist dokumentiert

#### Scenario: Coverage-Artefakte auffinden
- **GIVEN** ein PR-Reviewer will Coverage-Artefakte prüfen
- **WHEN** er die PR-Checkliste verwendet
- **THEN** findet er den GitHub UI-Pfad zum Download der Artifacts
- **AND** Artefakt-Namen (coverage-summary.json, lcov.info) sind genannt

### Requirement: CI-Workflow-Optimierung via Concurrency
Das System SHALL redundante CI-Workflow-Runs via Concurrency-Control verhindern.

#### Scenario: Cancel-in-Progress für PR-Branches
- **GIVEN** ein PR hat mehrere schnell aufeinanderfolgende Commits
- **WHEN** neuer Commit gepusht wird während alter Workflow läuft
- **THEN** wird alter Workflow-Run gecancelt
- **AND** neuer Workflow startet sofort
- **AND** CI-Ressourcen werden für aktuellsten Code frei

#### Scenario: Main-Branch nie canceln
- **WHEN** Main-Branch Coverage-Workflow läuft
- **THEN** wird dieser niemals gecancelt (auch bei neuem Commit)
- **AND** Deployment-kritische Workflows bleiben intakt

---

### Requirement: Artifact-Retention-Management
Das System SHALL Coverage-Artifacts mit automatischer Retention-Policy verwalten.

#### Scenario: 7-Tage-Retention für Coverage-Artifacts
- **WHEN** Coverage-Workflow Artifacts uploaded
- **THEN** haben Artifacts eindeutige Namen (mit run_id)
- **AND** Artifacts werden nach 7 Tagen automatisch gelöscht
- **AND** alte Artifacts verbrauchen keinen unnötigen Speicher

---

### Requirement: Governance-Verankerung in Development-Rules
Das System SHALL Coverage-Requirements als Teil der verbindlichen Entwicklungsrichtlinien verankern.

#### Scenario: Coverage-Requirements in DEVELOPMENT_RULES.md
- **GIVEN** `DEVELOPMENT_RULES.md` ist das zentrale Regelwerk
- **WHEN** ein Entwickler neue Features implementiert
- **THEN** findet er Coverage-Requirements in Sektion 5
- **AND** Regeln sind klar (neue Features brauchen Tests, keine Baseline-Drops)
- **AND** Enforcement-Prozess ist dokumentiert (PR-Review-Checklist)

#### Scenario: Exemption-Prozess dokumentiert
- **WHEN** ein Package temporär coverage-exempt sein muss
- **THEN** ist Genehmigungsprozess in Rules dokumentiert
- **AND** Issue muss erstellt werden für nachträgliche Test-Implementierung
- **AND** Exemption wird in Policy transparent ausgewiesen

