# Change: Test-Coverage-Tooling Enhancements

## Why

Die initiale Test-Coverage-Governance (PR #46) hat eine solide Basis geschaffen. Ein Review durch Custom Agents hat jedoch mehrere Optimierungspotenziale identifiziert:

**Performance & CI-Effizienz:**
- Nx Caching wird für Coverage-Targets nicht genutzt → redundante Test-Runs
- Fehlende Concurrency-Control → parallele Workflow-Runs bei schnellen PR-Updates
- Artifact-Management ohne Retention-Policy → Speicherverschwendung

**Developer Experience:**
- Coverage-Gate-Output ist monochrom und schwer lesbar in CI-Logs
- Fehlende Troubleshooting-Dokumentation führt zu Support-Anfragen
- Coverage-Trends sind nicht visualisiert (nur Snapshots)

**Code-Qualität & Wartbarkeit:**
- Coverage-Gate-Script in JavaScript statt TypeScript → keine Type Safety
- Vitest-Konfigurationen sind dezentral → Inkonsistenzen möglich
- Coverage-Requirements nicht in DEVELOPMENT_RULES.md verankert → fehlende Verbindlichkeit

**Risiko:**
Ohne diese Verbesserungen sinkt die Akzeptanz des Coverage-Systems, was die Governance-Ziele gefährdet.

## What Changes

### 1. Nx Workspace Optimierung (Hoch)
- **Nx Caching für Coverage-Targets aktivieren**
  - `targetDefaults` für `test:coverage` in `nx.json`
  - Named Inputs für test-spezifische Dependencies
  - Cache-Outputs für `{projectRoot}/coverage`

### 2. Dokumentation (Hoch)
- **Troubleshooting-Guide ergänzen**
  - Häufige Fehlerszenarien & Lösungen in `docs/development/testing-coverage.md`
    - `affected` ist leer / es laufen keine Coverage-Targets
    - fehlende `coverage-summary.json`
    - Baseline-Drop ("dropped by X pp")
    - Exemptions (coverage-exempt)
    - "No tests configured" / keine Tests vorhanden
  - Migration-Guide für neue Packages
  - Quick-Reference für lokale Coverage-Workflows
  - PR-Checkliste präzisieren: wo Coverage-Artefakte in der GitHub UI zu finden sind

### 3. Script-Verbesserungen (Hoch)
- **Colored Terminal Output**
  - ANSI-Farben für bessere Lesbarkeit (`green` = pass, `red` = fail)
  - Emoji-Marker für Status-Highlights

### 4. Zentrale Vitest-Konfiguration (Mittel)
- **Migration zu vitest.workspace.ts**
  - Workspace-wide Konfiguration im Root
  - Konsistente Coverage-Reporter über alle Packages
  - Eliminierung von `cwd`-Parameter in Targets

### 5. Coverage-Visualisierung (Mittel)
- **Codecov/Coveralls Integration**
  - Upload zu Codecov in CI-Workflow
  - PR-Kommentare mit Coverage-Diff
  - Trend-Visualisierung über Zeit
  - **oder** manuelle Alternative: GitHub Actions Summary erweitern

### 6. TypeScript-Migration (Mittel)
- **coverage-gate.mjs → coverage-gate.ts**
  - Type-sichere Policy/Baseline-Strukturen
  - Bessere IDE-Unterstützung & Refactoring
  - Runtime via `tsx` oder Pre-Build-Step

### 7. Governance-Verankerung (Mittel)
- **Coverage-Requirements in DEVELOPMENT_RULES.md**
  - Klare Regeln für neue Features (Tests erforderlich)
  - Exemption-Prozess dokumentieren
  - Enforcement-Guidelines für Code-Reviews

### 8. CI-Workflow-Optimierung (Bonus)
- **Concurrency-Control**
  - Cancel-in-progress für PR-Updates
  - Eindeutige Artifact-Namen mit `${{ github.run_id }}`
  - Retention-Policy (7 Tage) für automatische Cleanup

## Impact

### Affected Specs
- `test-coverage-governance` (MODIFIED: erweiterte Tooling-Anforderungen)
- `monorepo-structure` (MODIFIED: vitest.workspace.ts Konvention)

### Affected Files
**Neue Dateien:**
- `vitest.workspace.ts` (Root)
- `scripts/ci/coverage-gate.ts` (ersetzt .mjs)

**Modifizierte Dateien:**
- `nx.json` (targetDefaults, namedInputs)
- `.github/workflows/test-coverage.yml` (concurrency, Codecov, artifacts)
- `docs/development/testing-coverage.md` (Troubleshooting + Migration)
- `docs/reports/PR_CHECKLIST.md` (Artefakt-Fundstelle)
- `DEVELOPMENT_RULES.md` (Coverage-Requirements Sektion)
- `scripts/ci/coverage-gate.mjs` → `.ts` (Migration)
- Package-spezifische `vitest.config.ts` (vereinfacht durch workspace)

### Developer Workflow
**Vorher:**
- Lokale Coverage-Runs langsam (kein Nx Cache)
- Fehlersuche trial-and-error (keine Doku)
- Keine Trend-Sichtbarkeit

**Nachher:**
- ⚡ Schnellere Coverage-Runs durch Caching
- 📖 Selbständige Fehlersuche via Troubleshooting-Guide
- 📊 Coverage-Trends in Codecov/PRs sichtbar
- 🎨 Bessere Lesbarkeit der Gate-Outputs
- 🔐 Type Safety im Coverage-Tooling

### BREAKING CHANGES
**Keine Breaking Changes** - alle Änderungen sind rückwärtskompatibel.

Migration von `.mjs` zu `.ts` erfolgt transparent via `package.json` Script-Update.

## Success Criteria

1. **Performance:**
   - Coverage-Runs nutzen Nx Cache (messbar via `nx show project [name] --verbose`)
   - CI-Zeit für affected Coverage reduziert sich um ~30-50%

2. **DX:**
   - Coverage-Gate-Output ist farbig & lesbar
   - Troubleshooting-Guide beantwortet Top-3-Fehlerszenarien
   - Migration neuer Packages dauert <5 Minuten (mit Guide)

3. **Qualität:**
   - Coverage-Gate-Script hat 100% TypeScript Coverage
   - Alle Package-Configs nutzen vitest.workspace.ts
   - Coverage-Trends sind in Codecov/PRs sichtbar

4. **Governance:**
   - DEVELOPMENT_RULES.md enthält Coverage-Anforderungen
   - PRs ohne Tests werden erkennbar blockiert (Gate + Regeln)

## Implementation Phases

### Phase 1: Quick Wins (Hoch-Prio, ~2-3h)
- ✅ Nx Caching aktivieren
- ✅ Colored Output im Gate-Script
- ✅ Troubleshooting-Doku ergänzen
- ✅ Concurrency-Control im Workflow

**Ziel:** Sofortige DX-Verbesserung ohne strukturelle Änderungen

### Phase 2: Strukturelle Verbesserungen (Mittel-Prio, ~4-6h)
- ✅ vitest.workspace.ts Migration
- ✅ TypeScript-Migration coverage-gate
- ✅ Coverage-Requirements in DEVELOPMENT_RULES.md

**Ziel:** Langfristige Wartbarkeit & Konsistenz

### Phase 3: Integration & Visualisierung (Optional, ~2-3h)
- ✅ Codecov/Coveralls Setup
- ✅ PR-Kommentar-Automation
- ✅ Erweiterte GitHub Actions Summary

**Ziel:** Coverage-Trends transparent machen

## Alternatives Considered

### Alternative 1: Externe Coverage-Service (SonarQube)
**Pro:** Umfassende Code-Quality-Metriken
**Contra:** Setup-Overhead, Kosten, externe Abhängigkeit
**Entscheidung:** Codecov ist leichtgewichtiger

### Alternative 2: Coverage-Gate in GitHub Action (YAML statt Script)
**Pro:** Weniger Code-Dependencies
**Contra:** Weniger Flexibilität, schlechtere Testbarkeit
**Entscheidung:** TypeScript-Script ist wartbarer

### Alternative 3: Alle Packages sofort auf vitest.workspace.ts migrieren
**Pro:** Sofortige Konsistenz
**Contra:** Hohes Risiko, großer Scope
**Entscheidung:** Stufenweise Migration mit Backward-Compat

## Dependencies & Risks

### Dependencies
- PR #46 (Test-Coverage-Governance) muss gemerged sein ✅
- Nx Cache muss funktional sein (bereits vorhanden)
- `tsx` Package für TypeScript-Ausführung

### Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Nx Cache-Invalidierung fehlerhaft | Mittel | Hoch | Extensive Testing mit `--skip-nx-cache` Fallback |
| vitest.workspace.ts bricht bestehende Configs | Niedrig | Mittel | Stufenweise Migration, Package-spezifische Overrides möglich |
| TypeScript-Migration führt zu Runtime-Errors | Niedrig | Hoch | Umfassende Tests, parallel .mjs behalten bis validiert |
| Codecov-Integration schlägt fehl | Niedrig | Niedrig | Optional Feature, manuelle Summary-Alternative |

### Rollback-Plan
- Nx Cache: `cache: false` in `nx.json` targetDefaults
- vitest.workspace: Packages behalten lokale Configs
- TypeScript: Revert zu `.mjs` via Git
- Codecov: Workflow-Step entfernen

## Timeline Estimate

**Phase 1:** 2-3 Stunden (1 PR)
**Phase 2:** 4-6 Stunden (1-2 PRs)
**Phase 3:** 2-3 Stunden (1 PR)

**Total:** ~8-12 Stunden über 3-4 PRs

**Recommendation:** Phase 1 sofort starten, Phase 2+3 basierend auf Feedback
