# User Detail Organization Memberships Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organisationsmitgliedschaften auf der User-Detailseite anzeigen und inklusive Zuweisung, Update und Entfernen pflegen.

**Architecture:** Das bestehende Organisations-Membership-Modell bleibt fuehrend. Das User-Detail-Read-Model wird um Organisationsmitgliedschaften erweitert, und beide UIs nutzen dieselbe Backend-Mutation fuer Membership-Attribute statt paralleler Fachlogik.

**Tech Stack:** TypeScript, React, Vitest, Nx, IAM-Admin-Handlers, TanStack Router

---

### Task 1: User-Detail-Contract und Read-Model erweitern

**Files:**
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `packages/iam-admin/src/user-detail-query.types.ts`
- Modify: `packages/iam-admin/src/user-detail-query.sql.ts`
- Modify: `packages/iam-admin/src/user-detail-query.mapping.ts`
- Test: `packages/iam-admin/src/user-detail-query.mapping.test.ts`
- Test: `packages/iam-admin/src/user-detail-query.test.ts`

- [ ] Step 1: Write failing tests for organization memberships in user detail
- [ ] Step 2: Run targeted user-detail tests and verify failure
- [ ] Step 3: Add contract, SQL projection, and mapping for `organizationMemberships`
- [ ] Step 4: Re-run targeted user-detail tests and verify pass

### Task 2: Membership-Update-Mutation im Backend ergaenzen

**Files:**
- Modify: `packages/iam-admin/src/organization-schemas.ts`
- Modify: `packages/iam-admin/src/organization-mutation-handlers.ts`
- Test: `packages/iam-admin/src/organization-schemas.test.ts`
- Test: `packages/iam-admin/src/organization-mutation-handlers.test.ts`

- [ ] Step 1: Write failing tests for updating `visibility` and `isDefaultContext`
- [ ] Step 2: Run targeted mutation tests and verify failure
- [ ] Step 3: Implement schema and handler support for membership updates
- [ ] Step 4: Re-run targeted mutation tests and verify pass

### Task 3: API- und Hook-Support im Frontend ergaenzen

**Files:**
- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`
- Modify: `apps/sva-studio-react/src/hooks/use-user.ts`
- Modify: `apps/sva-studio-react/src/hooks/use-organizations.ts`
- Test: `apps/sva-studio-react/src/lib/iam-api.test.ts`

- [ ] Step 1: Write failing API tests for membership update request
- [ ] Step 2: Run targeted API tests and verify failure
- [ ] Step 3: Implement request helper and hook actions
- [ ] Step 4: Re-run targeted API tests and verify pass

### Task 4: User-Detailseite um Organisations-Tab erweitern

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/users/user-edit-model.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/users/use-user-edit-controller.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.test.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources/de/admin/users.resources.ts`
- Modify: `apps/sva-studio-react/src/i18n/resources/en/admin/users.resources.ts`

- [ ] Step 1: Write failing UI tests for the `Organisationen` tab
- [ ] Step 2: Run targeted page tests and verify failure
- [ ] Step 3: Implement tab state, membership list, suchbare Auswahl, update and remove actions
- [ ] Step 4: Re-run targeted page tests and verify pass

### Task 5: Organisations-Detailseite auf Update-Flow umstellen

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.test.tsx`

- [ ] Step 1: Write failing tests for editing membership attributes on organization detail
- [ ] Step 2: Run targeted organization detail tests and verify failure
- [ ] Step 3: Implement shared update flow in the existing organization UI
- [ ] Step 4: Re-run targeted organization detail tests and verify pass

### Task 6: Architektur und Verifikation abschliessen

**Files:**
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `openspec/changes/update-user-detail-organization-memberships/tasks.md`

- [ ] Step 1: Update the relevant architecture sections for the new user-centric organization membership flow
- [ ] Step 2: Run the smallest relevant unit/type gates
- [ ] Step 3: Mark completed OpenSpec tasks
