# Waste Tours Date Range Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den bestehenden Touren-Filter um Datumsbereichsfilter für ersten und letzten Termin erweitern.

**Architecture:** Die aktiven Touren-Filter bleiben vollständig in den Search-Params verankert. Das bestehende Touren-Modal erhält zusätzliche lokale Draft-Felder für Datumsbereiche, die erst bei `Anwenden` gesammelt in den Router geschrieben werden. Die eigentliche Filterlogik bleibt clientseitig in der Touren-Presentation.

**Tech Stack:** TypeScript, React, TanStack Router, Vitest, Nx, `@sva/studio-ui-react`

---

### Task 1: Touren-Suchzustand um Datumsbereiche erweitern

**Files:**
- Modify: `packages/plugin-waste-management/src/search-params.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-list-view.navigation.ts`
- Test: `packages/plugin-waste-management/tests/search-params.test.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tours-list-view.navigation.test.ts`

- [ ] Search-Params und Navigation für `firstDateFrom`, `firstDateTo`, `endDateFrom`, `endDateTo` ergänzen.
- [ ] Normalisierung und kombinierte Filter-Writebacks per Tests absichern.

### Task 2: Clientseitige Touren-Filterlogik um Datumsvergleiche erweitern

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours.shared.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tours.shared.test.ts`

- [ ] Inklusive Bereichsvergleiche auf `firstDate` und `endDate` ergänzen.
- [ ] Fehlende Datumswerte bei aktivem Feldfilter explizit ausschließen.

### Task 3: Touren-Modal und Reset um Datums-Draft erweitern

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours.content.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.content.body.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.toolbar.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.toolbar.parts.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.tours-content.test.tsx`

- [ ] Lokalen Draft-Zustand für alle vier Datumsfelder ergänzen.
- [ ] Modal-Felder, Apply/Cancel und Schnell-Reset erweitern.

### Task 4: Übersetzungen und Verifikation abschließen

**Files:**
- Modify: `packages/plugin-waste-management/src/plugin.translations.shared.scheduling.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tours.ts`
- Test: `packages/plugin-waste-management/tests/plugin.translations.shared.test.ts`

- [ ] i18n-Keys für die vier Datumsfeld-Labels ergänzen.
- [ ] Relevante Unit-Tests und `plugin-waste-management:test:types` grün ausführen.
