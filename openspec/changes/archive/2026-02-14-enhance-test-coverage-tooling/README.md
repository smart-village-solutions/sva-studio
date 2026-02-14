# Test-Coverage-Tooling Enhancements

**Change ID:** `enhance-test-coverage-tooling`  
**Status:** 🟡 Proposal (awaiting approval)  
**Priority:** High (Phase 1), Medium (Phase 2+3)  
**Estimated Effort:** 8-12 hours over 3-4 PRs

## Quick Links

- [📄 Proposal](./proposal.md) - Das Was & Warum
- [✅ Tasks](./tasks.md) - Implementation Checklist (3 Phasen)
- [🏗️ Design](./design.md) - Technische Entscheidungen & Architektur
- [📝 Spec Delta: test-coverage-governance](./specs/test-coverage-governance/spec.md)
- [📝 Spec Delta: monorepo-structure](./specs/monorepo-structure/spec.md)

## Zusammenfassung

Dieses Change-Proposal verbessert die Test-Coverage-Governance aus PR #46 mit:

### Phase 1: Quick Wins (Hoch-Prio, ~2-3h)
- ⚡ **Nx Caching** für Coverage-Targets → 30-50% schnellere CI-Runs
- 🎨 **Colored Terminal Output** im Coverage-Gate → bessere Lesbarkeit
- 📚 **Troubleshooting-Dokumentation** → weniger Support-Anfragen
- 🔄 **Concurrency-Control** im CI-Workflow → Ressourcen-Effizienz

### Phase 2: Strukturelle Verbesserungen (Mittel-Prio, ~4-6h)
- 🏗️ **vitest.workspace.ts** Migration → zentrale Konfiguration
- 🔐 **TypeScript Coverage-Gate** → Type Safety & Wartbarkeit
- 📋 **Coverage-Requirements** in DEVELOPMENT_RULES.md → Governance

### Phase 3: Integration & Visualisierung (Optional, ~2-3h)
- 📊 **Codecov Integration** → Coverage-Trends & PR-Kommentare
- 📈 **Erweiterte GitHub Summary** → Alternative zu Codecov

## Motivation

PR #46 hat eine solide Coverage-Governance etabliert. Custom Agent Review identifizierte jedoch:

- **Performance-Lücken:** Nx Cache wird nicht genutzt
- **DX-Probleme:** Monochrome Logs, fehlende Troubleshooting-Doku
- **Wartbarkeit:** JavaScript statt TypeScript, dezentrale Configs
- **Governance:** Coverage-Requirements nicht in Dev-Rules verankert

**Risiko ohne Enhancements:** Sinkende Akzeptanz des Coverage-Systems

## Betroffene Specs

- ✏️ **test-coverage-governance** (MODIFIED - 7 neue/erweiterte Requirements)
- ✏️ **monorepo-structure** (MODIFIED - 3 neue Requirements für Nx Cache & Vitest Workspace)

## Betroffene Dateien

**Neu:**
- `vitest.workspace.ts` (Root)
- `scripts/ci/coverage-gate.ts` (ersetzt .mjs)

**Modifiziert:**
- `nx.json` (targetDefaults, namedInputs)
- `.github/workflows/test-coverage.yml` (concurrency, codecov, artifacts)
- `docs/development/testing-coverage.md` (Troubleshooting + Migration)
- `DEVELOPMENT_RULES.md` (Coverage-Requirements Sektion 5)
- Package `vitest.config.ts` (vereinfacht durch workspace)

## Nächste Schritte

1. ✅ **Review Proposal** - Team-Review & Feedback
2. ⏸️ **Approval Gate** - Freigabe einholen
3. 🚀 **Phase 1 Implementation** - Quick Wins (1 PR)
4. 🔄 **Feedback Loop** - Learning aus Phase 1
5. 🏗️ **Phase 2 Implementation** - Strukturelles (1-2 PRs)
6. 📊 **Phase 3 (Optional)** - Visualisierung (1 PR)

## Erfolgsmetriken

Nach vollständiger Implementation:

- ⚡ **CI-Performance:** 30-50% schnellere affected Coverage-Runs
- 👨‍💻 **DX:** <5min Migration neuer Packages (mit Guide)
- 📈 **Code-Qualität:** Kontinuierlicher Anstieg globaler Coverage
- 🎯 **Support:** 50% Reduktion Coverage-bezogener Fragen

## Rollback-Plan

Alle Enhancements sind unabhängig revertierbar:
- Nx Cache: `cache: false` in nx.json
- Vitest Workspace: Zurück zu individuellen Configs
- TypeScript Gate: Workflow auf .mjs zurückstellen
- Codecov: Workflow-Step entfernen

**Full Rollback:** `git revert <pr-sha> && pnpm install && nx reset`

---

**Author:** Custom Agent Review (GitHub Copilot)  
**Date:** 2026-02-12  
**Based on:** PR #46 Review Findings
