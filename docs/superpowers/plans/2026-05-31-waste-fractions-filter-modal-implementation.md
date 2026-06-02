# Waste Fractions Filter Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Fraktionen-Liste im Waste-Management-Plugin um einen eigenen `Filtern`-Button mit Modal und reload-stabilem, tab-spezifischem Statusfilter erweitern.

**Architecture:** Der bestehende Waste-Search-Param-Vertrag wird um `fractionsStatus` ergaenzt, damit der Fraktionen-Filter nicht mehr den globalen `status`-Param der anderen Views wiederverwendet. Die Fraktionen-Ansicht konsumiert den neuen Param in der Praesentation und oeffnet ein kleines Modal aus der Tabellen-Toolbar, das die Auswahl `all|active|inactive` in den Router zurueckschreibt.

**Tech Stack:** TypeScript, React, TanStack Router, Vitest, Nx, `@sva/studio-ui-react`

---

### Task 1: Search-Param-Vertrag und Fractions-Praesentation erweitern

**Files:**
- Modify: `packages/plugin-waste-management/src/search-params.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.presentation.ts`
- Test: `packages/plugin-waste-management/tests/search-params.test.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.master-data-presentation.test.ts`

- [ ] Step 1: Failing Tests fuer `fractionsStatus` und Fraktionen-Filterung schreiben
- [ ] Step 2: Gezielte Testfiles per Nx ausfuehren und rote Faelle bestaetigen
- [ ] Step 3: `fractionsStatus` typisiert normalisieren und Fraktionen-Praesentation auf den neuen Param umstellen
- [ ] Step 4: Dieselben Testfiles erneut ausfuehren und gruen bestaetigen

### Task 2: Fraktionen-Toolbar mit Filter-Modal umsetzen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-fractions-content.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-fractions-content.view.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-fractions-content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-fractions-tab-view.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.master-data-fractions-content.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.master-data-tab-content.test.tsx`

- [ ] Step 1: Failing UI-Tests fuer `Filtern`-Button, Modal und Search-Param-Writeback schreiben
- [ ] Step 2: Gezielte Testfiles per Nx ausfuehren und rote Faelle bestaetigen
- [ ] Step 3: Minimalen Toolbar-/Modal-Pfad implementieren und Router-Writeback verdrahten
- [ ] Step 4: Dieselben Testfiles erneut ausfuehren und gruen bestaetigen

### Task 3: Uebersetzungen und betroffener Gate-Pfad

**Files:**
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.masterData.fractions.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.masterData.fractions.ts`
- Verify: `packages/plugin-waste-management/tests/search-params.test.ts`
- Verify: `packages/plugin-waste-management/tests/waste-management.master-data-presentation.test.ts`
- Verify: `packages/plugin-waste-management/tests/waste-management.master-data-fractions-content.test.tsx`
- Verify: `packages/plugin-waste-management/tests/waste-management.master-data-tab-content.test.tsx`

- [ ] Step 1: i18n-Keys fuer Button, Modal und Statusoptionen ergaenzen
- [ ] Step 2: Kleinsten relevanten Unit-Gate-Pfad per Nx ausfuehren
- [ ] Step 3: Type-Gate fuer das betroffene Package per Nx ausfuehren
- [ ] Step 4: Plan-Check gegen Spec und Diff abschliessen
