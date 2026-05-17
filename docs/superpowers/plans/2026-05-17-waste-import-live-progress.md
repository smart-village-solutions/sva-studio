# Waste Import Live Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den laufenden Waste-Spezialimport mit echtem Prozent- und Zeilenfortschritt statt grobem Zweischritt-Status anzeigen.

**Architecture:** Der bestehende generische Job-Vertrag bleibt erhalten. Detaillierter Fortschritt wird über `StudioJobProgress.details` transportiert, im Waste-Import blockweise gemeldet und in der bestehenden laufenden Import-Karte visualisiert. Die UI liest nur den aktuell laufenden Import detailliert aus; historische Einträge bleiben kompakt.

**Tech Stack:** TypeScript, React, Nx, Vitest, OpenSpec, bestehende Plugin-Operations- und Waste-Import-Runtime

---

### Task 1: Fortschrittsvertrag und Progress-Helfer vorbereiten

**Files:**
- Modify: `packages/plugin-waste-management/src/server.ts`
- Modify: `packages/core/src/plugin-operations-contract.ts`
- Test: `packages/plugin-waste-management/tests/server.test.ts`

- [ ] **Step 1: Write the failing test**

Add a server-side test that expects progress reports for import jobs to preserve structured `details` such as `processedRows` and `totalRows` instead of only a fixed two-step payload.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/plugin-waste-management && pnpm exec vitest run tests/server.test.ts`
Expected: FAIL because the import job handler still emits only the current coarse `createProgress(...)` payload.

- [ ] **Step 3: Write minimal implementation**

In `packages/plugin-waste-management/src/server.ts`, stop hardcoding the final shape of import progress for all phases. Keep initial/final wrapper progress, but allow the runtime-import path to provide richer progress objects with `details`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/plugin-waste-management && pnpm exec vitest run tests/server.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-waste-management/src/server.ts packages/plugin-waste-management/tests/server.test.ts packages/core/src/plugin-operations-contract.ts
git commit -m "feat: prepare waste import progress contract"
```

### Task 2: Waste-Import-Runtime progressfähig machen

**Files:**
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.server.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.import.ts`
- Test: `apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test for the CSV-Spezialimport that starts with known `validRowCount` and expects blockwise progress calls containing:
- `currentPhase`
- `processedRows`
- `totalRows`
- `invalidRowCount`

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts`
Expected: FAIL because `importData(...)` does not accept or invoke a progress callback.

- [ ] **Step 3: Write minimal implementation**

In `apps/sva-studio-react/src/lib/waste-management-operations.server.ts`, extend `importData(...)` to accept an optional progress sink.

In `apps/sva-studio-react/src/lib/waste-management-operations.import.ts`:
- add a lightweight progress callback type
- report phase transitions such as `mapping`, `importing`, `finalizing`
- use `parsed.validRowCount` as `totalRows`
- increment `processedRows` during the persist loop
- emit blockwise updates, e.g. every 25 rows and on completion

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/sva-studio-react/src/lib/waste-management-operations.server.ts apps/sva-studio-react/src/lib/waste-management-operations.import.ts apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts
git commit -m "feat: report live waste import progress"
```

### Task 3: Job-Progress in Auth-Runtime und Polling stabil konsumieren

**Files:**
- Modify: `packages/auth-runtime/src/plugin-operations/job-progress-reporter.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tools.job-state.ts`
- Test: `packages/auth-runtime/src/plugin-operations/job-progress-reporter.test.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tools.history.test.tsx`

- [ ] **Step 1: Write the failing test**

Add one test that expects `job-progress-reporter` to persist `details` unchanged and one UI-adjacent test that expects active import polling to continue surfacing updated progress values.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=packages/auth-runtime/src/plugin-operations/job-progress-reporter.test.ts`
Run: `cd packages/plugin-waste-management && pnpm exec vitest run tests/waste-management.tools.history.test.tsx`
Expected: At least one FAIL because richer import details are not yet covered end-to-end.

- [ ] **Step 3: Write minimal implementation**

Keep `job-progress-reporter` structurally unchanged where possible, but verify and harden that `progress.details` survives persistence.

In `packages/plugin-waste-management/src/waste-management.tools.job-state.ts`, lower the polling interval for active imports to a more responsive cadence such as `2000` or `3000` milliseconds while preserving the existing guard for terminal states.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=packages/auth-runtime/src/plugin-operations/job-progress-reporter.test.ts`
Run: `cd packages/plugin-waste-management && pnpm exec vitest run tests/waste-management.tools.history.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/auth-runtime/src/plugin-operations/job-progress-reporter.ts packages/auth-runtime/src/plugin-operations/job-progress-reporter.test.ts packages/plugin-waste-management/src/waste-management.tools.job-state.ts packages/plugin-waste-management/tests/waste-management.tools.history.test.tsx
git commit -m "feat: preserve and poll detailed import progress"
```

### Task 4: Laufende Import-Karte auf echten Zeilenfortschritt umstellen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tools.history.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tools.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tools.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tools.history.test.tsx`

- [ ] **Step 1: Write the failing test**

Extend the existing history test so that a running import job with:
- `details.totalRows = 1240`
- `details.processedRows = 310`
- `details.invalidRowCount = 12`

must render:
- a progress bar with `25`
- a text like `310 / 1240`
- a phase/status label

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/plugin-waste-management && pnpm exec vitest run tests/waste-management.tools.history.test.tsx`
Expected: FAIL because the card currently derives progress only from `completedSteps / totalSteps`.

- [ ] **Step 3: Write minimal implementation**

In `packages/plugin-waste-management/src/waste-management.tools.history.tsx`:
- prefer `details.processedRows / details.totalRows` when available
- fall back to the generic step percentage only if row details are missing
- render `processedRows / totalRows` and the current phase text

Update DE/EN translation files with row-oriented labels and any missing phase wording.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/plugin-waste-management && pnpm exec vitest run tests/waste-management.tools.history.test.tsx tests/waste-management.tools-panel.body.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-waste-management/src/waste-management.tools.history.tsx packages/plugin-waste-management/src/plugin.translations.de.tools.ts packages/plugin-waste-management/src/plugin.translations.en.tools.ts packages/plugin-waste-management/tests/waste-management.tools.history.test.tsx packages/plugin-waste-management/tests/waste-management.tools-panel.body.test.tsx
git commit -m "feat: show row-based live import progress"
```

### Task 5: Gesamtlauf, Spezifikation und Doku absichern

**Files:**
- Modify: `openspec/changes/update-waste-import-live-progress/*`
- Modify: `docs/architecture/README.md` or affected referenced arc42 sections if runtime/building-block text needs adjustment

- [ ] **Step 1: Run focused verification**

Run:
```bash
pnpm nx run plugin-waste-management:test:types
pnpm nx run auth-runtime:test:unit --testFiles=packages/auth-runtime/src/plugin-operations/job-progress-reporter.test.ts
pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts
cd packages/plugin-waste-management && pnpm exec vitest run tests/waste-management.tools.history.test.tsx tests/server.test.ts
```
Expected: PASS

- [ ] **Step 2: Validate the spec change**

Run: `openspec validate update-waste-import-live-progress --strict`
Expected: PASS

- [ ] **Step 3: Update implementation notes**

Mark completed checklist items in `openspec/changes/update-waste-import-live-progress/tasks.md` and update any affected architecture notes if the runtime-view description changed materially.

- [ ] **Step 4: Commit**

```bash
git add openspec/changes/update-waste-import-live-progress docs/architecture
git commit -m "docs: capture waste import live progress change"
```
