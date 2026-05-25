# Unified Content Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven execution for independent workstreams only after the host contract and SDK contract are fixed. Do not start plugin migration before the shared contracts are merged into the working tree.

**Goal:** `/admin/content` becomes the only redaktionelle Übersicht für News, Events und POI. Die bisherigen Listenrouten `/admin/news`, `/admin/events` und `/admin/poi` entfallen. Ein generischer Typ-Picker unter `/admin/content/new` zeigt nur anlegbare Inhaltstypen. Create/Edit bleiben typspezifisch, aber laufen hinter dem gemeinsamen Host-Einstieg.

**Architecture:** Die Umsetzung erfolgt in fünf Schichten: zuerst Host-Vertrag für Aggregation und Query-Modell, dann SDK-/Plugin-Registry-Vertrag, danach Host-UI für Inhaltsliste und Typ-Picker, anschließend Migration der drei Standard-Content-Plugins, zuletzt Entfernung alter Listenrouten und End-to-End-Verifikation. Rechte, Sortierung, Filterung und Pagination bleiben host-owned und serverseitig geführt.

**Tech Stack:** Nx, pnpm, TypeScript strict mode, React, TanStack Router, `@sva/plugin-sdk`, `@sva/routing`, `@sva/studio-ui-react`, Vitest

---

## File Structure Map

### Planung und Referenzen

- Reference: `docs/superpowers/specs/2026-05-24-unified-content-entry-design.md`
- Reference: `docs/development/studio-list-page-standard.md`
- Reference: `docs/development/studio-uebersichts-und-detailseiten-standard.md`

### Host-Content-Übersicht

- Modify: `apps/sva-studio-react/src/routes/content/-content-list-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/content/-content-list-page.test.tsx`
- Create or Modify: neue Host-Helfer für aggregiertes Listenmodell unter `apps/sva-studio-react/src/lib/**`
- Create or Modify: serverseitige Host-API-/Adapterpfade für aggregierte Inhalte unter `apps/sva-studio-react/src/lib/**`

### Typ-Picker und gemeinsamer Einstieg

- Create: `apps/sva-studio-react/src/routes/content/-content-type-picker-page.tsx`
- Create: `apps/sva-studio-react/src/routes/content/-content-type-picker-page.test.tsx`
- Modify: `apps/sva-studio-react/src/lib/breadcrumbs.ts`
- Modify: `apps/sva-studio-react/src/lib/breadcrumbs.test.ts`

### SDK und Registry

- Modify: `packages/plugin-sdk/src/content-types.ts`
- Modify: `packages/plugin-sdk/src/plugins.ts`
- Modify: `packages/plugin-sdk/src/build-time-registry.ts`
- Modify: `packages/plugin-sdk/src/public-api.ts`
- Modify: `packages/plugin-sdk/src/index.ts`
- Create or Modify: Tests in `packages/plugin-sdk/src/**/*.test.ts` und `packages/plugin-sdk/tests/**/*.test.ts`

### Routing

- Modify: `packages/routing/src/admin-resource-routes.ts`
- Modify: `packages/routing/src/app.routes.shared.ts`
- Modify: `packages/routing/src/route-paths.ts`
- Modify: `packages/routing/src/**/*.test.ts`

### Plugin-Migration: News

- Modify: `packages/plugin-news/src/plugin.tsx`
- Modify: `packages/plugin-news/src/news.pages.tsx`
- Modify: `packages/plugin-news/src/index.ts`
- Modify: `packages/plugin-news/tests/**/*.test.ts*`

### Plugin-Migration: Events

- Modify: `packages/plugin-events/src/plugin.tsx`
- Modify: `packages/plugin-events/src/events.pages.tsx`
- Modify: `packages/plugin-events/src/index.ts`
- Modify: `packages/plugin-events/tests/**/*.test.ts*`

### Plugin-Migration: POI

- Modify: `packages/plugin-poi/src/plugin.tsx`
- Modify: `packages/plugin-poi/src/poi.pages.tsx`
- Modify: `packages/plugin-poi/src/index.ts`
- Modify: `packages/plugin-poi/tests/**/*.test.ts*`

### Navigation und Shell

- Modify: `apps/sva-studio-react/src/components/Sidebar.tsx`
- Modify: `apps/sva-studio-react/src/components/Sidebar.test.tsx`
- Modify: `apps/sva-studio-react/src/router.tsx`
- Modify: `apps/sva-studio-react/src/router.test.ts`
- Modify: `apps/sva-studio-react/src/router.runtime.test.ts`

## Task 1: Host-Vertrag für gemeinsame Inhaltsübersicht festziehen

**Files:**
- Reference: `docs/superpowers/specs/2026-05-24-unified-content-entry-design.md`
- Modify: `apps/sva-studio-react/src/routes/content/-content-list-page.tsx`
- Create or Modify: aggregierte Host-Modelle/Resolver unter `apps/sva-studio-react/src/lib/**`

- [ ] **Step 1: Capture the target list contract**

Document the canonical aggregated row shape before coding:

```md
- typeId
- itemId
- displayTitle
- status
- updatedAt
- readRoute
```

- [ ] **Step 2: Identify current host dependencies**

Run:

```bash
rg -n "/admin/content|content\\.page|content\\.table|contentsApi|contentAccessApi" apps/sva-studio-react/src/routes/content apps/sva-studio-react/src/lib
```

Expected: Current generic content list entry points and host-only dependencies.

- [ ] **Step 3: Define the aggregated query responsibilities**

Implement or stub host-side modules so that the following responsibilities are explicit:

```md
- effective read filtering per type
- normalized search
- type filter
- status filter
- global sort
- global pagination
```

- [ ] **Step 4: Add tests for the host contract**

Add focused tests that prove:

```md
- unauthorized item types are excluded
- sorting happens on the shared fields only
- pagination applies after filtering/sorting
- row routes resolve to type-specific edit targets
```

## Task 2: SDK- und Registry-Vertrag für registrierbare Inhaltstypen erweitern

**Files:**
- Modify: `packages/plugin-sdk/src/content-types.ts`
- Modify: `packages/plugin-sdk/src/plugins.ts`
- Modify: `packages/plugin-sdk/src/build-time-registry.ts`
- Modify: `packages/plugin-sdk/src/public-api.ts`
- Modify: `packages/plugin-sdk/src/index.ts`
- Modify: tests under `packages/plugin-sdk/src/**/*.test.ts` and `packages/plugin-sdk/tests/**/*.test.ts`

- [ ] **Step 1: Define the new content type descriptor**

Extend the public contract with a descriptor equivalent to:

```ts
type RegisteredStudioContentType = {
  typeId: string;
  displayName: string;
  description?: string;
  icon?: string;
  requiredReadAction: string;
  requiredCreateAction: string;
  createRoute: string;
  editRoute: string;
  contentListAdapter: ...;
};
```

- [ ] **Step 2: Wire descriptor collection into the build-time registry**

Ensure the build-time plugin registry can collect these definitions from all plugins and expose them to the host.

- [ ] **Step 3: Guard the contract with validation**

Add fail-fast behavior for:

```md
- duplicate type ids
- missing action ids
- missing routes
- invalid adapter shape
```

- [ ] **Step 4: Add regression tests**

Add tests that prove:

```md
- registered content types are collected in order
- duplicate registrations fail
- host lookup can resolve create/edit targets
```

## Task 3: Gemeinsame Inhaltsliste unter `/admin/content` umbauen

**Files:**
- Modify: `apps/sva-studio-react/src/routes/content/-content-list-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/content/-content-list-page.test.tsx`
- Modify or Create: supporting host helpers under `apps/sva-studio-react/src/lib/**`

- [ ] **Step 1: Replace the generic content table assumption**

Refactor the page so it renders the aggregated content rows instead of the current generic content source.

- [ ] **Step 2: Normalize the visible columns**

The table must render exactly the agreed common base:

```md
- Typ
- Titel/Name
- Status
- Zuletzt geändert
- Aktionen
```

- [ ] **Step 3: Add host-owned filters**

Implement and test:

```md
- search
- type
- status
```

- [ ] **Step 4: Bind sort and pagination to shared search params**

Use typed search params so reload and direct links preserve:

```md
- page
- pageSize
- sortBy
- sortDirection
- status
- type
- q
```

- [ ] **Step 5: Add UI tests**

Add tests that prove:

```md
- mixed type rows render correctly
- actions navigate into the correct type-specific edit route
- filters and pagination survive navigation state
```

## Task 4: Typ-Picker unter `/admin/content/new` einführen

**Files:**
- Create: `apps/sva-studio-react/src/routes/content/-content-type-picker-page.tsx`
- Create: `apps/sva-studio-react/src/routes/content/-content-type-picker-page.test.tsx`
- Modify: `apps/sva-studio-react/src/lib/breadcrumbs.ts`
- Modify: `apps/sva-studio-react/src/lib/breadcrumbs.test.ts`

- [ ] **Step 1: Build the host-owned picker page**

The page must render:

```md
- breadcrumbs
- H1
- description
- type cards
```

- [ ] **Step 2: Drive visibility by effective create rights**

Only render content types whose `requiredCreateAction` is satisfied by the current user.

- [ ] **Step 3: Add the empty state**

If no content type is creatable, show a dedicated empty state instead of disabled cards.

- [ ] **Step 4: Add tests**

Prove:

```md
- only creatable types are shown
- card click routes to the type-specific create page
- no disabled cards are rendered
```

## Task 5: News, Events und POI auf den neuen Vertrag migrieren

**Files:**
- Modify: `packages/plugin-news/src/plugin.tsx`
- Modify: `packages/plugin-events/src/plugin.tsx`
- Modify: `packages/plugin-poi/src/plugin.tsx`
- Modify: page files and tests in each plugin package

- [ ] **Step 1: Register each plugin content type**

Each plugin must expose the new descriptor with:

```md
- display name
- picker description
- required read action
- required create action
- create route
- edit route
- list adapter
```

- [ ] **Step 2: Remove list-page ownership as primary entry**

Keep type-specific create/edit pages, but stop treating `/admin/news`, `/admin/events`, `/admin/poi` as canonical list entries.

- [ ] **Step 3: Update plugin tests**

Prove that plugin metadata now supports:

```md
- host picker inclusion
- host list aggregation
- type-specific create/edit routing
```

## Task 6: Alte Listenrouten und Navigation entfernen

**Files:**
- Modify: `packages/routing/src/admin-resource-routes.ts`
- Modify: `packages/routing/src/app.routes.shared.ts`
- Modify: `packages/routing/src/route-paths.ts`
- Modify: `apps/sva-studio-react/src/components/Sidebar.tsx`
- Modify: `apps/sva-studio-react/src/components/Sidebar.test.tsx`
- Modify: `apps/sva-studio-react/src/router.tsx`
- Modify: related route and runtime tests

- [ ] **Step 1: Remove `/admin/news`, `/admin/events`, `/admin/poi` as active list routes**

The route set must no longer treat these as normal overview entries.

- [ ] **Step 2: Collapse shell navigation to `/admin/content`**

The sidebar and other direct entry points must prefer the single unified content entry.

- [ ] **Step 3: Update breadcrumbs and route diagnostics**

Remove assumptions that the old list routes are the canonical parent routes.

- [ ] **Step 4: Add regression tests**

Prove:

```md
- `/admin/content` remains present
- `/admin/content/new` remains present
- old list routes are no longer active overview routes
```

## Task 7: Verification and quality gates

**Files:**
- Modify: tests across host, routing, plugin-sdk, plugin-news, plugin-events, plugin-poi as needed

- [ ] **Step 1: Run targeted unit tests during each workstream**

Minimum expected command families:

```bash
pnpm nx run plugin-sdk:test:unit
pnpm nx run routing:test:unit
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/content/-content-list-page.test.tsx
pnpm nx run plugin-news:test:unit
pnpm nx run plugin-events:test:unit
pnpm nx run plugin-poi:test:unit
```

- [ ] **Step 2: Run affected type tests when contracts change**

Run:

```bash
pnpm nx affected --target=test:types --base=origin/main
```

- [ ] **Step 3: Run lint and final affected tests**

Run:

```bash
pnpm nx affected --target=test:unit --base=origin/main
pnpm test:eslint
```

- [ ] **Step 4: Record residual risks**

If anything remains deferred, document at least:

```md
- additional content types not yet registered
- remaining assumptions in generic content host code
- follow-up cleanup for create/edit visual harmonization
```

## Suggested Subagent Breakdown

Use subagents only after **Task 1** and **Task 2** have stabilized the contracts.

### Subagent A: Host Aggregation

- Task 1
- Task 3

### Subagent B: SDK and Registry

- Task 2

### Subagent C: Type Picker and Shell Entry

- Task 4
- parts of Task 6 affecting navigation and breadcrumbs

### Subagent D: Plugin Migration

- Task 5

### Subagent E: Verification

- Task 7

## Execution Order

1. Task 1
2. Task 2
3. Parallel:
   - Task 3
   - Task 4
   - Task 5
4. Task 6
5. Task 7
