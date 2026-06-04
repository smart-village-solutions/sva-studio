# Waste Tours Filter Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Touren-Tab im Waste-Management-Plugin von einem aufklappbaren Inline-Filter auf ein erweiterbares Filter-Modal mit externem Schnell-Reset umstellen.

**Architecture:** Die bestehenden Touren-Search-Params `q` und `status` bleiben der kanonische aktive Filterzustand. Im UI wird davor ein lokaler Draft-Zustand für das Modal eingeführt, damit Änderungen erst mit `Anwenden` in den Router geschrieben werden. Zusätzlich wird das Empty-State-Gating so angepasst, dass bei vorhandenen Touren und leerem Filterergebnis weiterhin die Listenansicht mit Toolbar sichtbar bleibt.

**Tech Stack:** TypeScript, React, TanStack Router, Vitest, Nx, `@sva/studio-ui-react`

**Archivstatus:** Inhaltlich umgesetzt im Waste-Management-Filter-Slice auf `main`; die Checkboxen wurden für die Archivierung auf den tatsächlichen Stand nachgezogen.

---

### Task 1: Touren-Filterzustand auf Modal-Draft und Reset vorbereiten

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours.content.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-list-view.navigation.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tours-list-view.navigation.test.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tours-content.test.tsx`

- [x] **Step 1: Failing Tests für Modal-Draft und kombiniertes Filter-Writeback ergänzen**
  - In `packages/plugin-waste-management/tests/waste-management.tours-list-view.navigation.test.ts` einen Fall ergänzen, der einen neuen kombinierten Search-Helper für Touren erwartet, der `q`, `status` und `page: 1` in einem Schritt setzt.
  - In `packages/plugin-waste-management/tests/waste-management.tours-content.test.tsx` einen Fall ergänzen, der folgendes Verhalten fordert:
    - `Filtern` öffnet noch kein Inline-Panel.
    - Modal-Draft kann `Name` und `Status` ändern.
    - `Abbrechen` übernimmt Änderungen nicht.
    - `Anwenden` ruft die aktive Filteränderung erst am Ende auf.

- [x] **Step 2: Gezielte Tests rot ausführen**
  - Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-list-view.navigation.test.ts --testFiles=tests/waste-management.tours-content.test.tsx`
  - Expected: FAIL, weil Touren heute nur `setQuery` und `setStatus` getrennt kennen und weiterhin das alte Inline-Filtermodell verwenden.

- [x] **Step 3: Minimalen Draft- und Apply-Pfad implementieren**
  - In `packages/plugin-waste-management/src/waste-management.tours.content.parts.tsx` den bisherigen `filtersOpen`-Zustand durch einen modal-orientierten Zustand ersetzen:
    - `filterDialogOpen`
    - `draftQuery`
    - `draftStatus`
    - `hasActiveFilters`
  - In `packages/plugin-waste-management/src/waste-management.tours.content.tsx` den Draft aus `query` und `status` initialisieren und `onApplyFilters` plus `onResetFilters` verdrahten.
  - In `packages/plugin-waste-management/src/waste-management.tours-list-view.navigation.ts` einen kombinierten Helper wie `toToursFiltersSearch(search, q, status)` plus eine passende Navigationsmethode einführen, damit `Anwenden` nur einen einzigen Router-Writeback auslöst.

- [x] **Step 4: Dieselben Tests grün ausführen**
  - Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-list-view.navigation.test.ts --testFiles=tests/waste-management.tours-content.test.tsx`
  - Expected: PASS

### Task 2: Inline-Filter durch Toolbar-Modal und Reset ersetzen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours.toolbar.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.toolbar.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.content.body.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.tours-content.test.tsx`

- [x] **Step 1: Failing UI-Assertions für das neue Toolbar-Muster ergänzen**
  - In `packages/plugin-waste-management/tests/waste-management.tours-content.test.tsx` Erwartungen ergänzen für:
    - `Filter zurücksetzen` nur bei aktivem `q` oder `status !== 'all'`
    - `Filtern` öffnet ein Modal
    - das bisherige Inline-Element `waste-tours-filters` wird nicht mehr gerendert
    - `Tour anlegen` bleibt separat als Primäraktion bestehen

- [x] **Step 2: Gezielten Testlauf rot bestätigen**
  - Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-content.test.tsx`
  - Expected: FAIL, weil Toolbar und Filter heute noch das Inline-Panel verwenden.

- [x] **Step 3: Touren-Toolbar auf Fraktionen-Muster umstellen**
  - In `packages/plugin-waste-management/src/waste-management.tours.toolbar.parts.tsx` das Inline-Filterpanel entfernen und stattdessen aufteilen in:
    - Bulk-/Filter-Actions links
    - `Filter zurücksetzen`
    - `Filtern`
    - Modal mit `Name`, `Status`, `Abbrechen`, `Anwenden`
  - In `packages/plugin-waste-management/src/waste-management.tours.toolbar.tsx` die Props auf das neue Muster umstellen.
  - In `packages/plugin-waste-management/src/waste-management.tours.content.body.tsx` die neuen Callback- und Status-Props durchreichen, statt `filtersOpen`/`setFiltersOpen` zu verwenden.

- [x] **Step 4: Touren-Content-Test erneut grün ausführen**
  - Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-content.test.tsx`
  - Expected: PASS

### Task 3: Touren-Empty-State gegen gefilterte Leerzustände absichern

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours-list-view.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.controller.ts` (nur falls für den Rohdatenzugriff nötig)
- Test: `packages/plugin-waste-management/tests/waste-management.tours-list-view.test.tsx`

- [x] **Step 1: Failing Test für gefiltert leere, fachlich aber vorhandene Touren schreiben**
  - In `packages/plugin-waste-management/tests/waste-management.tours-list-view.test.tsx` einen Fall ergänzen, in dem:
    - `controller.tours` leer ist
    - die zugrunde liegende Tour-Overview im Controller aber mindestens eine Tour enthält
    - die Listenansicht gerendert werden muss statt `WasteToursEmptyState`

- [x] **Step 2: Gezielten Test rot ausführen**
  - Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-list-view.test.tsx`
  - Expected: FAIL, weil `WasteToursListView` aktuell nur `controller.tours.length` prüft.

- [x] **Step 3: Empty-State nur für wirklich leere Datenbasis verwenden**
  - In `packages/plugin-waste-management/src/waste-management.tours-list-view.tsx` den Empty-State-Check so anpassen, dass zwischen
    - „keine Touren in der Datenquelle“
    - und „Touren vorhanden, aber durch Filter ausgeblendet“
    unterschieden wird.
  - Wenn Rohdaten vorhanden sind, muss weiterhin `WasteToursContent` gerendert werden, damit Reset und Filter-Modal erreichbar bleiben.

- [x] **Step 4: Listenansichts-Test grün ausführen**
  - Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-list-view.test.tsx`
  - Expected: PASS

### Task 4: Übersetzungen, Regressionen und Gate-Pfad abschließen

**Files:**
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tours.ts`
- Verify: `packages/plugin-waste-management/tests/waste-management.tours-content.test.tsx`
- Verify: `packages/plugin-waste-management/tests/waste-management.tours-list-view.test.tsx`
- Verify: `packages/plugin-waste-management/tests/waste-management.tours-list-view.navigation.test.ts`

- [x] **Step 1: Neue Touren-i18n-Keys ergänzen**
  - In `packages/plugin-waste-management/src/plugin.translations.de.tours.ts` und `packages/plugin-waste-management/src/plugin.translations.en.tours.ts` Schlüssel für das Modal- und Reset-Muster ergänzen:
    - Filter öffnen
    - Filter zurücksetzen
    - Modal-Titel
    - Modal-Beschreibung
    - Name-Label
    - Status-Label
    - Statusoptionen
    - Anwenden
    - Abbrechen

- [x] **Step 2: Kleinsten relevanten Unit-Gate-Pfad ausführen**
  - Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-content.test.tsx --testFiles=tests/waste-management.tours-list-view.test.tsx --testFiles=tests/waste-management.tours-list-view.navigation.test.ts`
  - Expected: PASS

- [x] **Step 3: Type-Gate für das betroffene Package ausführen**
  - Run: `pnpm nx run plugin-waste-management:test:types`
  - Expected: PASS

- [x] **Step 4: Plan gegen Spec querprüfen**
  - Prüfen, dass alle Punkte aus `docs/superpowers/specs/2026-05-31-waste-tours-filter-modal-design.md` abgedeckt sind:
    - Modal statt Inline-Filter
    - externer Reset
    - `Name` und `Status`
    - Draft + Apply/Cancel
    - leer gefilterte Listenansicht bleibt bedienbar
