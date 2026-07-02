# Content List Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add targeted server-side error logging for `/api/v1/iam/contents` so generic UI load failures can be correlated with the real backend error.

**Architecture:** Keep the response contract unchanged and add logging only at the server catch boundary where the root error is currently swallowed. Use the existing `@sva/server-runtime` logger and cover the change with focused Vitest assertions.

**Tech Stack:** TypeScript, Vitest, `@sva/server-runtime`

---

### Task 1: API Catch Logging

**Files:**
- Modify: `apps/sva-studio-react/src/lib/iam-content-list-api.server.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-content-list-api.server.test.ts`

- [ ] **Step 1: Write the failing test**

Add an assertion to the existing `"returns a deterministic list error when the projected list handler throws"` test so it expects `logger.error(...)` with the request ID and normalized context.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/iam-content-list-api.server.test.ts`
Expected: FAIL because no logger call exists yet.

- [ ] **Step 3: Write minimal implementation**

Create a module-local logger with `createSdkLogger({ component: 'iam-content-list-api' })` and log inside the GET catch before returning the existing `createListErrorResponse(...)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/iam-content-list-api.server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sva-studio-react/src/lib/iam-content-list-api.server.ts apps/sva-studio-react/src/lib/iam-content-list-api.server.test.ts docs/superpowers/plans/2026-07-02-content-list-logging.md
git commit -m "fix: log content list load failures"
```
