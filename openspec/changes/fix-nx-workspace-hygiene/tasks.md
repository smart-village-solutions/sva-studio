## Phase 1: Nx-Konfiguration bereinigen

### Task 1.1: tsconfig.base.json Paths ergänzen (NX-3, NX-4)
- [ ] 1.1.1 `@sva/routing` Path-Mapping hinzufügen: `["packages/routing/src/index.ts"]`
- [ ] 1.1.2 `@sva/sdk/server` Path-Mapping hinzufügen: `["packages/sdk/src/server.ts"]`
- [ ] 1.1.3 `@sva/sdk/logger/index.server` prüfen und ggf. hinzufügen
- [ ] 1.1.4 `@sva/sdk/middleware/request-context.server` prüfen und ggf. hinzufügen
- [ ] 1.1.5 `@sva/sdk/observability/context.server` prüfen und ggf. hinzufügen
- [ ] 1.1.6 Verifizieren: IDE-Auflösung der neuen Imports funktioniert (z. B. `import { ... } from '@sva/routing'`)
- [ ] 1.1.7 `pnpm nx affected --target=build` – keine neuen Fehler

### Task 1.2: Routing-Package Nx-Konfiguration bereinigen (NX-6, NX-7)
- [ ] 1.2.1 `packages/routing/project.json`: Target `test` → `test:unit` umbenennen
- [ ] 1.2.2 `packages/routing/project.json`: Tag `type:core` → `type:lib` ändern
- [ ] 1.2.3 `packages/routing/project.json`: `lint`-Target ergänzen (konsistent mit anderen Packages)
- [ ] 1.2.4 `packages/routing/project.json`: `test:coverage`-Target ergänzen (konsistent mit anderen Packages)
- [ ] 1.2.5 Verifizieren: `pnpm nx run routing:test:unit` und `pnpm nx run routing:lint` funktionieren

### Task 1.3: Lint-Executors vereinheitlichen (NX-5)
- [ ] 1.3.1 `packages/auth/project.json`: `lint`-Target auf `@nx/eslint:lint` Executor umstellen
- [ ] 1.3.2 `packages/monitoring-client/project.json`: `lint`-Target auf `@nx/eslint:lint` Executor umstellen
- [ ] 1.3.3 Verifizieren: `pnpm nx run auth:lint && pnpm nx run monitoring-client:lint`

### Task 1.4: Veraltete C-4-Annahme bereinigen
- [x] 1.4.1 Verifiziert: `packages/core/src/iam/token.ts` nutzt keine Node.js-spezifischen APIs mehr (`Buffer.from()` entfällt)
- [x] 1.4.2 Scope angepasst: kein `.server.ts`-Rename erforderlich
- [ ] 1.4.3 `pnpm nx affected --target=build` nach Abschluss von Task 1.1–1.3 ohne neue Fehler ausführen

---

## Phase 2: Test-Coverage-Governance stärken

### Task 2.1: Coverage-Floors anheben (TEST-1)
- [ ] 2.1.1 `tooling/testing/coverage-policy.json` öffnen und globale Floors setzen:
  - `lines`: 10 (Mindest-Einstieg)
  - `statements`: 10
  - `functions`: 20
  - `branches`: 20
- [ ] 2.1.2 Package-spezifische Floors basierend auf Baseline:
  - `auth`: lines ≥ 14, functions ≥ 50, branches ≥ 70
  - `sdk`: lines ≥ 30, functions ≥ 50
  - Routing/Core: bleiben vorerst exempt bis Tests existieren (Phase 2.2)
- [ ] 2.1.3 `pnpm coverage-gate` lokal ausführen – Gate validiert mit neuen Floors
- [ ] 2.1.4 Sicherstellen, dass `maxAllowedDropPctPoints` bei 0.5 bleibt

### Task 2.2: Basis-Tests für Core-Package (TEST-2)
- [x] 2.2.1 `packages/core/vitest.config.ts` vorhanden
- [x] 2.2.2 Test-Datei `packages/core/src/security/field-encryption.test.ts` vorhanden:
  - Encrypt/Decrypt Round-Trip
  - Key-Rotation (verschiedene KeyIds)
  - Ungültige Key-Länge
  - Ungültige Cipher-Text-Formate
- [ ] 2.2.3 Test-Datei `packages/core/src/iam/authorization-engine.test.ts` erstellen:
  - Alle 5 Evaluation-Stages
  - Edge Cases: leere Claims, fehlender instanceId, unbekannte Actions
- [ ] 2.2.4 Test-Datei `packages/core/src/iam/claims.test.ts` erstellen:
  - `extractDisplayName` mit verschiedenen Token-Payloads
  - `extractRoles` mit validen und invaliden Strukturen
- [ ] 2.2.5 `pnpm nx run core:test:unit` – alle Tests grün
- [ ] 2.2.6 Core-Package aus Coverage-Exemption-Liste entfernen

### Task 2.3: Basis-Tests für Routing-Package
- [x] 2.3.1 `packages/routing/vitest.config.ts` vorhanden
- [x] 2.3.2 Test-Datei `packages/routing/src/auth.routes.server.test.ts` vorhanden:
  - Handler-Mapping enthält alle bekannten Pfade
  - Unbekannter Pfad führt zu Fehler (nach Fix R-2 aus Proposal 1)
- [ ] 2.3.3 `pnpm nx run routing:test:unit` – alle Tests grün

---

## Phase 3: Coverage-Gate-Refactoring & Validierung

### Task 3.1: Coverage-Gate-Komplexität reduzieren (COV-1)
- [ ] 3.1.1 `scripts/ci/coverage-gate.ts`: `runCoverageGate`-Funktion in Subfunktionen aufteilen:
  - `loadCoverageData()` – Daten laden und parsen
  - `evaluateFloors()` – Floor-Checks durchführen
  - `evaluateRegressions()` – Baseline-Regressionen prüfen
  - `generateReport()` – Report-Markdown generieren
- [ ] 3.1.2 Cognitive Complexity < 15 pro Funktion sicherstellen
- [ ] 3.1.3 SonarQube `Array#push()` Finding beheben (concat oder `push(...items)` nutzen)
- [ ] 3.1.4 Bestehende Tests für Coverage-Gate anpassen

### Task 3.2: Abschließende Validierung
- [ ] 3.2.1 `pnpm nx affected --target=lint`
- [ ] 3.2.2 `pnpm nx affected --target=test:unit`
- [ ] 3.2.3 `pnpm nx affected --target=build`
- [ ] 3.2.4 `pnpm test:ci` (vollständige CI-Suite lokal)
- [ ] 3.2.5 `docs/architecture/05-building-block-view.md` prüfen: Routing-Modul-Konfiguration aktuell?
- [ ] 3.2.6 `docs/architecture/10-quality-requirements.md` prüfen: Coverage-Ziele dokumentiert?
