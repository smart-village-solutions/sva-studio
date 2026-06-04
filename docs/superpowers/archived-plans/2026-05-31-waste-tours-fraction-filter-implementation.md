# Waste Tours Fraction Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das bestehende Touren-Filtermodal um einen Single-Select für Abfallarten erweitern, ohne mit dem Fraktionen-Stammdatenrouting zu kollidieren.

**Architecture:** Der neue Touren-Fraktionenfilter bekommt einen eigenen Search-Param `tourWasteFractionId`. Die aktive Filterung bleibt clientseitig in der Touren-Presentation, während das Modal wie bisher mit lokalem Draft arbeitet und erst bei `Anwenden` gesammelt in den Router schreibt. Der bestehende Param `wasteFractionId` bleibt ausschließlich für das Fraktionen-Stammdatenrouting reserviert.

**Tech Stack:** TypeScript, React, TanStack Router, Vitest, Nx, `@sva/studio-ui-react`

**Archivstatus:** Inhaltlich umgesetzt im Waste-Management-Filter-Slice auf `main`; die Checkboxen wurden für die Archivierung auf den tatsächlichen Stand nachgezogen.

---

### Task 1: Touren-Suchzustand um eigenen Fraktionen-Filter erweitern

**Files:**
- Modify: `packages/plugin-waste-management/src/search-params.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-list-view.navigation.ts`
- Test: `packages/plugin-waste-management/tests/search-params.test.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tours-list-view.navigation.test.ts`

- [x] Search-Param `tourWasteFractionId` ergänzen und sauber normalisieren.
- [x] Kombinierten Touren-Filter-Writeback um `tourWasteFractionId` erweitern.
- [x] Sicherstellen, dass `wasteFractionId` weiterhin unangetastet für Stammdaten bleibt.

### Task 2: Clientseitige Touren-Filterlogik um Abfallart erweitern

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours.shared.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tours.shared.test.ts`

- [x] Touren nur dann durchlassen, wenn `tourWasteFractionId` in `tour.wasteFractionIds` enthalten ist.
- [x] Den Fraktionenfilter mit den bestehenden Text-, Status- und Datumsfiltern zusammenspielen lassen.

### Task 3: Touren-Modal und Reset um Single-Select für Abfallarten erweitern

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours.content.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.content.body.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.toolbar.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.toolbar.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-list-view.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.tours-content.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.tours-content.sorting.test.tsx`

- [x] Lokalen Draft `draftTourWasteFractionId` ergänzen.
- [x] Select `Abfallart` mit `Alle` plus verfügbaren Fraktionen in das Modal einfügen.
- [x] Apply/Cancel/Reset so erweitern, dass `tourWasteFractionId` vollständig mitgeführt wird.

### Task 4: Übersetzungen und Verifikation abschließen

**Files:**
- Modify: `packages/plugin-waste-management/src/plugin.translations.shared.scheduling.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tours.ts`
- Test: `packages/plugin-waste-management/tests/plugin.translations.shared.test.ts`

- [x] i18n-Keys für `Abfallart` und `Alle` im Touren-Filter ergänzen.
- [x] Kleinsten relevanten Unit-Gate-Pfad grün ausführen.
- [x] `pnpm nx run plugin-waste-management:test:types` grün ausführen.
