# Implementation Tasks

## 1. Spec & Architektur
- [x] 1.1 Capability `test-coverage-governance` mit normativen Requirements anlegen
- [x] 1.2 `monorepo-structure` um verpflichtende Test-Target-Konvention erweitern
- [x] 1.3 OpenSpec strict validation ausführen (`openspec validate add-test-coverage-governance --strict`)

## 2. Test-Target-Normalisierung (Nx)
- [x] 2.1 Für relevante Projekte `test:unit` einführen/vereinheitlichen
- [x] 2.2 Für relevante Projekte `test:coverage` einführen (Coverage-Reporter aktiv)
- [x] 2.3 Infra-abhängige Tests nach `test:integration` trennen
- [x] 2.4 Platzhalter-Targets entfernen oder als explizit ausgenommen dokumentieren

## 3. Coverage-Baseline & Policy
- [x] 3.1 Workspace-weite Coverage-Policy-Datei definieren (Metriken, Floors, Excludes)
- [x] 3.2 Initiale Baseline pro Paket erfassen
- [x] 3.3 Ratcheting-Regel für schrittweise Erhöhung dokumentieren

## 4. CI & Reporting
- [x] 4.1 CI-Workflow für Coverage-Läufe (affected + optional full) ergänzen
- [x] 4.2 PR Summary erzeugen (pro Paket + global + Delta zur Baseline)
- [x] 4.3 Coverage-Artefakte (`json-summary`, `lcov`) als Workflow-Artefakte publizieren
- [x] 4.4 Gate-Logik implementieren: pro Paket + global

## 5. Integrationstest-Policy
- [x] 5.1 `test:integration` in separatem Job/Workflow laufen lassen (optional in PR, verpflichtend nightly/main)
- [x] 5.2 Unit-Gates strikt auf `test:unit`/`test:coverage` begrenzen

## 6. Dokumentation
- [x] 6.1 Dokumentation `docs/development/testing-coverage.md` erstellen/aktualisieren
- [x] 6.2 Lokalen Entwickler-Workflow für affected coverage dokumentieren
- [x] 6.3 PR-Checkliste um Coverage-Nachweise ergänzen
