# Implementation Tasks

## Phase 1: Quick Wins (Hoch-Prio)

### Task 1.1: Nx Caching für Test-Coverage aktivieren
- [x] `nx.json` öffnen und `targetDefaults` erweitern
- [x] `test:coverage` Target mit `cache: true` konfigurieren
- [x] `inputs` definieren: `["default", "^production", "{workspaceRoot}/vitest.config.ts"]`
- [x] `outputs` definieren: `["{projectRoot}/coverage"]`
- [x] Named Input `testing` erstellen für Test-spezifische Files
- [x] Named Input zu `test:unit` Target hinzufügen
- [x] Lokal testen: `pnpm test:coverage` zweimal ausführen (2. Mal sollte "cache hit" zeigen)
- [x] Cache-Verhalten validieren: `nx show project sdk --verbose`

**Akzeptanzkriterien:**
- ✅ Zweiter Coverage-Run zeigt Nx Cache-Hit
- ✅ `nx.json` validiert ohne Fehler
- ✅ Coverage-Artefakte werden korrekt gecached

---

### Task 1.2: Colored Terminal Output im Coverage-Gate
- [x] `scripts/ci/coverage-gate.mjs` öffnen
- [x] Color-Helper-Funktionen hinzufügen (oben im File):
  ```javascript
  const colors = {
    reset: '\x1b[0m',
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
  };
  ```
- [x] Erfolgs-Meldungen mit `colors.green()` wrappen
- [x] Fehler-Meldungen mit `colors.red()` wrappen
- [x] Warnungen mit `colors.yellow()` wrappen
- [x] Emojis hinzufügen: ✅ (pass), ❌ (fail), ⚠️ (warn)
- [x] Lokal testen: `node scripts/ci/coverage-gate.mjs`
- [x] Fehlerfall testen: temporär Floor erhöhen, Gate sollte farbig fehlschlagen

**Akzeptanzkriterien:**
- ✅ Output ist farbig in Terminal
- ✅ Emojis werden korrekt dargestellt
- ✅ CI-Logs zeigen korrekte ANSI-Codes

**Geschätzter Aufwand:** 30 Minuten

---

### Task 1.3: Troubleshooting-Sektion in Dokumentation
- [x] `docs/development/testing-coverage.md` öffnen
- [x] Neue Sektion "## Troubleshooting" am Ende hinzufügen
- [x] Fehlerszenario 1: "missing coverage-summary.json" dokumentieren
  - Ursache
  - Lösung (vitest/coverage-v8 installieren)
  - Beispiel-Commands
- [x] Fehlerszenario 2: "affected leer" dokumentieren
  - Ursache
  - Lösung (origin/main aktualisieren, affected Debugging)
  - Beispiel-Commands
- [x] Fehlerszenario 3: "dropped by X pp" dokumentieren
  - Ursache
  - Lösung (Tests hinzufügen oder Baseline updaten)
  - Wann Baseline-Update legitim ist
- [x] Fehlerszenario 4: "Exemptions" dokumentieren
  - Bedeutung (excluded aus Gate / global)
  - Prozess zum Entfernen aus Exemptions
- [x] Fehlerszenario 5: "No tests configured" dokumentieren
  - Ursache
  - Lösung (mindestens ein Unit-Test, optional passWithNoTests entfernen)
- [x] Neue Sektion "## Migration Guide" hinzufügen
- [x] Step-by-Step für "Neues Package zur Coverage hinzufügen"
  1. Dependencies installieren
  2. Targets in project.json
  3. Tests schreiben
  4. Policy aktualisieren (exemptProjects entfernen)
  5. Baseline setzen
- [x] Beispiel-Commands für alle Schritte hinzufügen
- [x] PR-Checkliste präzisieren: wo Coverage-Artefakte in der GitHub UI zu finden sind (`docs/reports/PR_CHECKLIST.md`)
- [x] Cross-Links zu `PR_CHECKLIST.md` und `coverage-policy.json` einfügen

**Akzeptanzkriterien:**
- ✅ Top 3 Fehlerszenarien sind dokumentiert
- ✅ Migration-Guide ist vollständig
- ✅ Alle Commands sind copy-pastable
- ✅ Links funktionieren

**Geschätzter Aufwand:** 45 Minuten

---

### Task 1.4: CI-Workflow Concurrency & Artifact-Optimierung
- [x] `.github/workflows/test-coverage.yml` öffnen
- [x] Concurrency-Block nach `name:` hinzufügen:
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
  ```
- [x] Artifact-Upload anpassen:
  - Name: `coverage-reports-${{ github.run_id }}`
  - `retention-days: 7` hinzufügen
- [x] Workflow lokal validieren: `actionlint .github/workflows/test-coverage.yml`
- [ ] In PR testen: mehrere Commits schnell hintereinander pushen
- [ ] Verifizieren: ältere Workflow-Runs werden gecancelt

**Akzeptanzkriterien:**
- ✅ Concurrency funktioniert (alte Runs werden gecancelt)
- ✅ Artifacts haben eindeutige Namen
- ✅ Retention-Policy ist aktiv (Artifacts werden nach 7 Tagen gelöscht)
- ✅ Main-Branch Runs werden nie gecancelt

**Geschätzter Aufwand:** 30 Minuten

---

## Phase 2: Strukturelle Verbesserungen (Mittel-Prio)

### Task 2.1: vitest.workspace.ts Migration
- [x] `vitest.workspace.ts` im Root erstellen
- [x] Workspace-Definition schreiben:
  ```typescript
  import { defineWorkspace } from 'vitest/config';

  export default defineWorkspace([
    'apps/*/vitest.config.ts',
    'packages/*/vitest.config.ts',
  ]);
  ```
- [x] Shared Config in Root `vitest.config.ts` erstellen
- [x] Coverage-Reporter zentral konfigurieren (text-summary, json-summary, lcov)
- [x] Coverage-Output-Dir standardisieren: `./coverage`
- [x] Package-Configs vereinfachen (nur noch Projekt-spezifische Overrides behalten)
- [x] `apps/sva-studio-react/project.json` anpassen:
  - `cwd` Parameter entfernen
  - Command: `pnpm exec vitest run --coverage` (ohne explizite Reporter)
- [x] `packages/sdk/project.json` analog anpassen
- [x] Alle Tests lokal ausführen: `pnpm test:unit`
- [x] Coverage lokal ausführen: `pnpm test:coverage`
- [x] Verifizieren: Coverage-Files werden an erwarteten Orten generiert

**Akzeptanzkriterien:**
- ✅ vitest.workspace.ts ist funktional
- ✅ Alle Package-Configs nutzen Workspace
- ✅ Coverage-Reports haben konsistentes Format
- ✅ Keine Duplikate in Coverage-Output

**Geschätzter Aufwand:** 2 Stunden

---

### Task 2.2: TypeScript-Migration für coverage-gate
- [x] `scripts/ci/coverage-gate.ts` erstellen (basierend auf .mjs)
- [x] TypeScript-Interfaces definieren:
  ```typescript
  interface CoveragePolicy {
    version: number;
    metrics: CoverageMetric[];
    globalFloors: MetricFloors;
    maxAllowedDropPctPoints: number;
    exemptProjects: string[];
    perProjectFloors: Record<string, MetricFloors>;
  }

  type CoverageMetric = 'lines' | 'statements' | 'functions' | 'branches';

  interface MetricFloors {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  }

  interface CoverageBaseline {
    projects: Record<string, MetricFloors>;
  }
  ```
- [x] Typed Helper-Funktionen erstellen
- [x] Original .mjs Logik nach TypeScript portieren
- [x] `tsx` als Dev-Dependency hinzufügen: `pnpm add -D tsx`
- [x] Root `package.json` Script aktualisieren:
  ```json
  "coverage-gate": "tsx scripts/ci/coverage-gate.ts"
  ```
- [x] CI-Workflow anpassen: `node` → `pnpm coverage-gate`
- [x] Lokal testen: `pnpm coverage-gate`
- [x] Fehlerszenarien testen (falsche Policy-Struktur sollte Type-Error werfen)
- [x] Alte .mjs-Datei behalten bis TypeScript-Version validiert ist

**Akzeptanzkriterien:**
- ✅ TypeScript-Version hat 100% Type Coverage
- ✅ Funktional identisch mit .mjs-Version
- ✅ Alle Tests (unit + integration) passen
- ✅ CI nutzt TypeScript-Version erfolgreich

**Geschätzter Aufwand:** 2-3 Stunden

---

### Task 2.3: Coverage-Requirements in DEVELOPMENT_RULES.md
- [x] `DEVELOPMENT_RULES.md` öffnen
- [x] Neue Sektion "## 5. Test Coverage Requirements" nach Sektion 4 einfügen
- [x] REQUIRED-Block schreiben:
  - Neue Features brauchen Unit-Tests
  - Coverage darf nicht unter Baseline fallen
  - Kritische Module (auth, payment) brauchen >90% Coverage
- [x] FORBIDDEN-Block schreiben:
  - PRs ohne Tests für neue Funktionalität
  - Baseline-Updates ohne Team-Approval
  - Coverage-Gate umgehen durch Exemptions
- [x] Process-Block schreiben:
  1. Tests parallel zur Feature-Entwicklung
  2. Lokale Coverage-Prüfung: `pnpm test:coverage`
  3. Gate-Check vor PR: `pnpm coverage-gate`
  4. Bei Exemptions: Issue + Genehmigung erforderlich
- [x] Enforcement-Block schreiben:
  - PRs ohne Tests werden abgelehnt (mit Begründung)
  - Code-Review-Checklist erweitern
  - Exemption-Prozess dokumentieren
- [x] Beispiele hinzufügen (analog zu Sektion 1):
  ```typescript
  // ❌ WRONG - Neue Feature-Funktion ohne Tests
  export function calculateDiscount(price: number) { ... }

  // ✅ CORRECT - Feature mit Tests
  export function calculateDiscount(price: number) { ... }
  // + tests/calculateDiscount.test.ts mit >80% Coverage
  ```
- [x] Cross-Link zu `docs/development/testing-coverage.md` einfügen
- [x] Cross-Link zu `PR_CHECKLIST.md` einfügen

**Akzeptanzkriterien:**
- ✅ Coverage-Requirements sind klar definiert
- ✅ Enforcement-Prozess ist dokumentiert
- ✅ Beispiele sind aussagekräftig
- ✅ Konsistent mit bestehendem Format in DEVELOPMENT_RULES.md

**Geschätzter Aufwand:** 1 Stunde

---

## Phase 3: Integration & Visualisierung (Optional)

### Task 3.1: Codecov Integration
- [ ] Codecov Account einrichten (falls nicht vorhanden)
- [ ] Codecov Token als GitHub Secret speichern: `CODECOV_TOKEN`
- [x] `.github/workflows/test-coverage.yml` erweitern:
  ```yaml
  - name: Upload to Codecov
    uses: codecov/codecov-action@v4
    with:
      token: ${{ secrets.CODECOV_TOKEN }}
      files: ./apps/**/coverage/lcov.info,./packages/**/coverage/lcov.info
      fail_ci_if_error: false
      flags: unittests
      name: coverage-${{ github.run_id }}
  ```
- [x] Codecov-Konfiguration erstellen: `codecov.yml`
  ```yaml
  coverage:
    status:
      project:
        default:
          target: auto
          threshold: 0.5%
      patch:
        default:
          target: 80%
  ```
- [ ] PR öffnen und Codecov-Kommentar verifizieren
- [x] Coverage-Badge in `README.md` einfügen (optional)

**Alternative:** Erweiterte GitHub Actions Summary statt Codecov
- [x] `scripts/ci/coverage-gate.ts` erweitern (N/A, Option A Codecov gewählt)
- [x] Trend-Berechnung vs. letzte 5 Runs (via GitHub API) (N/A, Option A Codecov gewählt)
- [x] Visual Chart in Markdown-Table (ASCII-Art) (N/A, Option A Codecov gewählt)
- [x] Delta-Anzeige pro Projekt (🟢 +2%, 🔴 -1%) (N/A, Option A Codecov gewählt)

**Akzeptanzkriterien:**
- ✅ Codecov zeigt Coverage-Daten korrekt an
- ✅ PR-Kommentare enthalten Coverage-Diff
- ✅ Trends sind visualisiert
- **ODER** (bei manueller Variante):
- ✅ GitHub Actions Summary zeigt erweiterte Metrics
- ✅ Trend-Daten der letzten 5 Runs sind sichtbar

**Geschätzter Aufwand:** 2-3 Stunden

---

## Testing Strategy

### Unit Tests
- [x] Jest/Vitest Tests für coverage-gate.ts
- [x] Mock-Policy/Baseline-Dateien für Testszenarien
- [x] Edge Cases testen:
  - Leeres Coverage-Summary
  - Fehlende Policy-Datei
  - Baseline-Drops an Grenzwerten

### Integration Tests
- [x] Full Coverage-Workflow lokal durchlaufen
- [ ] CI-Workflow in Feature-Branch testen
- [x] Verifizieren: Gate blockiert bei Coverage-Drop
- [x] Verifizieren: Gate passiert bei ausreichender Coverage

### Regression Tests
- [x] Bestehende Tests laufen weiterhin (keine Breaks)
- [x] Coverage-Artefakte werden weiterhin generiert
- [x] Nx Cache invalidiert nicht ungewollt

---

## Documentation Updates

Nach Implementation:
- [x] `docs/development/testing-coverage.md` auf aktuellsten Stand bringen
- [x] `PR_CHECKLIST.md` mit neuen Requirements updaten
- [x] `AGENTS.md` mit neuen Skills/Patterns updaten (falls relevant)
- [x] `README.md` mit Coverage-Badge updaten (bei Codecov)

---

## Rollout-Strategie

1. **Phase 1 (Quick Wins) → 1 PR**
   - Sofort merge-bar, minimales Risiko
   - Unmittelbare DX-Verbesserung

2. **Phase 2 (Strukturell) → 1-2 PRs**
   - Vitest-Workspace separat reviewen
   - TypeScript-Migration nach Vitest-Workspace
   - DEVELOPMENT_RULES.md in eigenem Commit

3. **Phase 3 (Optional) → 1 PR**
   - Nach Feedback aus Phase 1+2
   - Codecov vs. manuelle Summary entscheiden
   - Kann auch später nachgeholt werden

---

## Success Metrics

Nach vollständiger Implementation messen:

1. **CI-Performance:**
   - Coverage-Run-Zeit (affected) vor/nach
   - Anzahl Cache-Hits pro Woche
   - Ziel: 30-50% schnellere Coverage-Runs

2. **Developer Feedback:**
   - Time-to-Debug bei Coverage-Fehlern
   - Adoption-Rate neuer Packages (mit Tests)
   - Ziel: <5min Migration neuer Packages

3. **Code-Qualität:**
   - Durchschnittliche Coverage-Werte (Trend über 3 Monate)
   - Anzahl Coverage-Regressions (sollte sinken)
   - Ziel: Kontinuierlicher Anstieg globaler Coverage

4. **Support-Last:**
   - Anzahl Coverage-bezogener Issues/Fragen
   - Ziel: 50% Reduktion durch bessere Doku
