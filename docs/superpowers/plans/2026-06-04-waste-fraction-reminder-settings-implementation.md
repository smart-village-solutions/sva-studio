# Waste Fraction Reminder Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abfallfraktionen erhalten eine persistierte Reminder-Konfiguration mit Validierung, Normalisierung und einem vierten Formularblock im Create-/Edit-View.

**Architecture:** Die Reminder-Felder werden additiv direkt am Fraktionsmodell verankert. Die Umsetzung läuft durchgängig über bestehende Waste-Verträge: Core- und Plugin-SDK-Typen, Repository-Mapping gegen `waste_fractions`, Auth-Runtime-Schemas und Fraktions-Handler sowie das bestehende Create-/Edit-Formular der Fraktionen. Die Listenansicht bleibt unverändert.

**Tech Stack:** TypeScript strict mode, Zod, React, Vitest, Nx, pnpm

---

### Task 1: Verträge und Persistenz vorbereiten

**Files:**
- Modify: `packages/core/src/waste-management/master-data-contract.ts`
- Modify: `packages/core/src/waste-management/master-data-addresses.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/plugin-sdk/src/public-api.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.master-data-inputs.fractions.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.fractions.ts`
- Test: `packages/data-repositories/src/waste-management/master-data.test.ts`

- [ ] **Step 1: Write failing repository contract test**
- [ ] **Step 2: Run repository unit test to verify red**
- [ ] **Step 3: Add reminder enums and fields to core/sdk/input contracts**
- [ ] **Step 4: Extend fraction repository row mapping and upsert SQL**
- [ ] **Step 5: Run repository unit test to verify green**

### Task 2: Host validation and normalization

**Files:**
- Modify: `packages/auth-runtime/src/waste-management/core/schemas.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/fractions.ts`
- Modify: `packages/auth-runtime/src/waste-management/core.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/master-data-branches.test.ts`

- [ ] **Step 1: Write failing auth-runtime tests for valid reminder persistence and normalization**
- [ ] **Step 2: Run targeted auth-runtime tests to verify red**
- [ ] **Step 3: Extend fraction request schemas and add server-side normalization helper usage**
- [ ] **Step 4: Run targeted auth-runtime tests to verify green**

### Task 3: Fraktionsformular und Dialog-Mapping

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.forms.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-fraction-create.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-fraction-create-content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-fraction-dialog.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.masterData.fractions.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.masterData.fractions.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tours-form-content.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.master-data-fractions-content.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.master-data-fraction-submissions.test.ts`
- Create or Modify: `packages/plugin-waste-management/tests/waste-management.master-data-fraction-create-content.test.tsx`

- [ ] **Step 1: Write failing plugin tests for form defaults, mapping and fourth reminder block**
- [ ] **Step 2: Run targeted plugin tests to verify red**
- [ ] **Step 3: Extend form state, input mappers and create/edit view with the fourth reminder block**
- [ ] **Step 4: Keep the fractions table unchanged**
- [ ] **Step 5: Run targeted plugin tests to verify green**

### Task 4: Schema and docs alignment

**Files:**
- Modify: `docs/development/studio-db-schema.md`
- Modify: `docs/development/studio-db-schema-final.sql` only if this repo tracks the external waste schema snapshot there
- Modify: `openspec/changes/add-waste-fraction-reminder-settings/tasks.md`

- [ ] **Step 1: Document the new fraction reminder fields in the canonical schema docs if that snapshot owns the waste schema**
- [ ] **Step 2: Mark completed OpenSpec tasks to reflect reality**

### Task 5: Verification

**Files:**
- No code changes expected unless verification finds regressions

- [ ] **Step 1: Run smallest relevant unit test path**
  Run:
  `pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.test.ts`
  `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core.test.ts --testFiles=src/waste-management/core/master-data-branches.test.ts`
  `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.master-data-fraction-create-content.test.tsx --testFiles=tests/waste-management.master-data-fraction-submissions.test.ts --testFiles=tests/waste-management.master-data-fractions-content.test.tsx`

- [ ] **Step 2: Run smallest relevant type gate**
  Run:
  `pnpm nx run core:test:types`
  `pnpm nx run data-repositories:test:types`
  `pnpm nx run auth-runtime:test:types`
  `pnpm nx run plugin-waste-management:test:types`

- [ ] **Step 3: Run server runtime gates for changed server packages**
  Run:
  `pnpm nx run core:check:runtime`
  `pnpm nx run data-repositories:check:runtime`
  `pnpm nx run auth-runtime:check:runtime`

- [ ] **Step 4: Update plan/OpenSpec checklist after fresh green evidence**
