# Public-Waste-iCal-Event-Descriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Public-Waste-iCal-Feed soll pro `VEVENT` eine gesammelte Beschreibung aus Fraktionsbeschreibung, Tourbeschreibung und Terminnotiz exportieren.

**Architecture:** Die öffentliche Kalenderprojektion wird um eine optionale Fraktionsbeschreibung erweitert. Der iCal-Endpoint baut daraus einen stabil formatierten mehrzeiligen Beschreibungstext, während `SUMMARY` und kalenderweite Metadaten unverändert kurz bleiben.

**Tech Stack:** TypeScript, Vitest, Nx, OpenSpec, serverseitiger Public-Waste-Endpoint

---

### Task 1: Öffentliche Kalenderprojektion erweitern

**Files:**
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-contract.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
- Test: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts`

- [ ] **Step 1: Write the failing repository test**
- [ ] **Step 2: Run the repository test and verify it fails because the public entry lacks `fractionDescription`**
- [ ] **Step 3: Extend the public calendar entry contract and repository mapping with optional `fractionDescription`**
- [ ] **Step 4: Run the repository test and verify it passes**

### Task 2: iCal event description builder ergänzen

**Files:**
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-endpoints.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-ical.server.ts`
- Test: `apps/public-waste-calendar-web/src/lib/public-waste-ical.server.test.ts`
- Test: `apps/public-waste-calendar-web/src/lib/public-waste-endpoints.server.test.ts`

- [ ] **Step 1: Write failing renderer and endpoint tests for collected event descriptions**
- [ ] **Step 2: Run the tests and verify they fail on missing composed `VEVENT.DESCRIPTION` content**
- [ ] **Step 3: Implement the minimal description composer with stable order and duplicate suppression**
- [ ] **Step 4: Run the renderer and endpoint tests and verify they pass**

### Task 3: Verifikation und Quality Gates

**Files:**
- Modify: `openspec/changes/update-public-waste-ical-event-descriptions/tasks.md`

- [ ] **Step 1: Run targeted Public-Waste unit tests for repository, renderer and endpoint**
- [ ] **Step 2: Run `pnpm nx run public-waste-calendar-web:test:types`**
- [ ] **Step 3: Run the smallest relevant Nx affected gate for unit tests**
- [ ] **Step 4: Mark the OpenSpec task checklist with completed items that are actually done**
