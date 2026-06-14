# i18n Resources Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `apps/sva-studio-react/src/i18n/resources.ts` into feature- and locale-specific modules without changing translation behavior or plugin merge semantics.

**Architecture:** Keep `resources.ts` as the public aggregation and merge entry point. Move the host translation data into `resources/de/*.ts` and `resources/en/*.ts`, add locale aggregators, and leave the runtime merge helpers in place so consumers and plugin translation merging remain unchanged.

**Tech Stack:** TypeScript, Vitest, Nx, pnpm workspace

---

### Task 1: Add aggregation regression coverage

**Files:**
- Modify: `apps/sva-studio-react/src/i18n/translate.test.ts`

- [ ] Add a regression test that asserts `i18nResources` still exposes host translations from multiple feature namespaces after the split.
- [ ] Run `pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/i18n/translate.test.ts` and verify the targeted test suite is green.

### Task 2: Split locale resources by feature

**Files:**
- Create: `apps/sva-studio-react/src/i18n/resources/de/*.ts`
- Create: `apps/sva-studio-react/src/i18n/resources/en/*.ts`
- Create: `apps/sva-studio-react/src/i18n/resources/de.ts`
- Create: `apps/sva-studio-react/src/i18n/resources/en.ts`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`

- [ ] Move each top-level host translation branch (`shell`, `studioTable`, `placeholder`, `plugins`, `host`, `monitoring`, `content`, `media`, `shared`, `home`, `interfaces`, `account`, `admin`) into a feature file per locale.
- [ ] Rebuild `de.ts` and `en.ts` as object aggregators that export the per-locale resource trees.
- [ ] Update `resources.ts` so `i18nResources` imports the aggregated locale objects and the existing merge helpers continue to operate on the same shape.

### Task 3: Verify type and unit safety

**Files:**
- Verify only

- [ ] Run `pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/i18n/translate.test.ts`.
- [ ] Run `pnpm nx run sva-studio-react:test:types`.
