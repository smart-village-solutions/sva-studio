# Waste Scheduling Unified Table Detail View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Tab `Ausweichtermine` auf eine gemeinsame Tabellenansicht für Feiertagsregeln, globale Ausweichtermine und tourbezogene Ausweichtermine umstellen und Bearbeitung/Erstellung auf eine gemeinsame Detailseite vereinheitlichen.

**Architecture:** Die bestehenden Backend-Entitäten bleiben unverändert. Im Plugin wird ein gemeinsames `SchedulingTableEntry`-Read-Model eingeführt, das die drei Quelltypen für Tabelle, Filter und Navigation normalisiert. Das Scheduling-Routing wird von spezialisierten View-Varianten (`create-global`, `edit-tour`, ...) auf ein gemeinsames Modell mit `list | create | edit` plus `schedulingEntryType` und `schedulingEntryId` umgestellt.

**Tech Stack:** TypeScript, React, TanStack Router, Vitest, Nx, `@sva/studio-ui-react`

---

### Task 1: Scheduling-Search-Params und Navigation auf gemeinsames Routingmodell umstellen

**Files:**
- Modify: `packages/plugin-waste-management/src/search-params.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-list-view.navigation.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-panel.effects.ts`
- Test: `packages/plugin-waste-management/tests/search-params.test.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling-list-view.navigation.test.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling-panel.test.tsx`

- [ ] Scheduling-View-Normalisierung von `list | create | create-global | create-tour | edit-global | edit-tour` auf `list | create | edit` reduzieren.
- [ ] Gemeinsame Search-Params `schedulingEntryType` und `schedulingEntryId` ergänzen und sauber normalisieren.
- [ ] Bestehenden `shiftContext`-Filter um `holiday` erweitern und ungültige Werte weiterhin fail-closed auf `all` normalisieren.
- [ ] Die Scheduling-Navigationshelfer so umstellen, dass `Bearbeiten` und `Neu anlegen` nur noch die gemeinsamen Routingzustände schreiben.
- [ ] Success-Redirects und Edit-Hydration auf das neue gemeinsame Routingmodell umstellen und alte `globalDateShiftId`-/`tourDateShiftId`-Spezialpfade entfernen.

### Task 2: Gemeinsames Scheduling-Listen-Read-Model einführen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.shared.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.controller.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.helpers.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling-shifts-table.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling-content.test.tsx`

- [ ] Ein gemeinsames `SchedulingTableEntry`-Modell mit `entryType`, `entryId`, Anzeige-Labels und typspezifischem Payload definieren.
- [ ] Feiertagsregeln, globale Ausweichtermine und tourbezogene Ausweichtermine in dieses gemeinsame Tabellenmodell normalisieren.
- [ ] Die bestehende Scheduling-Filterung so anpassen, dass `shiftContext=holiday|global|tour|all` auf dem gemeinsamen Read-Model korrekt greift.
- [ ] Sicherstellen, dass Feiertagsregeln als editierbar, aber nicht löschbar markiert werden.
- [ ] Sicherstellen, dass globale und tourbezogene manuelle Einträge weiterhin löschbar bleiben.

### Task 3: Tabellenansicht auf eine einzige gemeinsame Scheduling-Tabelle umstellen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-shifts-table.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.holiday-rules-list.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-list.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-list-view.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling-content.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling-shifts-table.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling-panel.test.tsx`

- [ ] Den separaten Feiertagsregel-Block aus der Scheduling-Liste entfernen.
- [ ] Die Tabelle auf eine gemeinsame Zeilenquelle umstellen und Spalten für `Datum alt`, `Datum neu`, `Typ`, `Kontext`, `Beschreibung / Regel` und `Aktionen` absichern.
- [ ] Row-Actions typabhängig verdrahten: Feiertagsregel-Edit, Global-Edit, Tour-Edit.
- [ ] Delete- und Bulk-Delete-Verhalten fail-closed auf nicht löschbare Feiertagsregeln absichern; wenn row-selektive Bulk-Löschung zu sperrig ist, Bulk-Delete für diesen Tab entfernen statt halb korrekt zu bleiben.
- [ ] Den Empty-State so anpassen, dass er nur bei vollständig leerem Scheduling-Datenbestand greift, nicht bei leerem Filterergebnis.

### Task 4: Gemeinsame Scheduling-Detailseite für Create und Edit aufbauen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-panel.views.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-create-form-view.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-form-content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-form.copy.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-tour-form-view.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-global-form-view.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling-form-copy.test.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.low-coverage-views.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling-panel.test.tsx`

- [ ] Eine gemeinsame Scheduling-Detailansicht für `create` und `edit` als führenden Nutzerpfad etablieren.
- [ ] Im Create-Fall eine Typwahl für `global-shift` und `tour-shift` vorsehen; `holiday-rule` im Create-Fall explizit blockieren.
- [ ] Im Edit-Fall den Typ aus `schedulingEntryType` übernehmen und nicht mehr änderbar machen.
- [ ] Die bestehenden fachlichen Formularsektionen für Feiertagsregel, globalen Ausweichtermin und tourbezogenen Ausweichtermin unter einem gemeinsamen äußeren Detailrahmen wiederverwenden.
- [ ] Die bisherigen spezialisierten Views nur noch als interne Zwischenstufe refactoren oder komplett ablösen, je nachdem welcher Pfad die geringere Komplexität hinterlässt.

### Task 5: Scheduling-Submit- und Ladepfade auf die gemeinsame Detailseite ausrichten

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.submissions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.actions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.state.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.loaders.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling.submissions.test.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.loaders.test.tsx`

- [ ] Submit-Handler so ausrichten, dass die gemeinsame Detailseite weiterhin korrekt in die bestehenden Mutationen für Feiertagsregeln, globale Ausweichtermine und tourbezogene Ausweichtermine verzweigt.
- [ ] State- und Action-Helfer auf das gemeinsame Edit-/Create-Modell reduzieren und nicht mehr an Dialog- oder Sondersichten koppeln.
- [ ] Lade- und Hydrationspfade so anpassen, dass `schedulingEntryType` und `schedulingEntryId` aus dem Overview-Datenbestand zuverlässig auflösbar sind.
- [ ] Ungültige Edit-Deep-Links fail-closed zurück auf `list` leiten.

### Task 6: Übersetzungen und Scheduling-Copy auf das gemeinsame Modell heben

**Files:**
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.scheduling.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.scheduling.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.shared.test.ts`
- Test: `packages/plugin-waste-management/tests/plugin.translations.shared.test.ts`

- [ ] Neue i18n-Keys für Typbezeichnungen, gemeinsame Tabellenüberschriften, Detailtitel, Typwahl und `shiftContext=holiday` ergänzen.
- [ ] Alte spezialisierte Scheduling-Copy nur dort behalten, wo sie fachlich noch exakt passt.
- [ ] Sicherstellen, dass keine Scheduling-Detailansicht auf widersprüchliche Alt-Copy (`create-global`, `edit-tour` etc.) zurückfällt.

### Task 7: Regressionen schließen und kleinsten relevanten Gate-Pfad grün ausführen

**Files:**
- Modify: `packages/plugin-waste-management/tests/waste-management.scheduling-content.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.scheduling-panel.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.scheduling-list-view.navigation.test.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.scheduling-shifts-table.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.scheduling.submissions.test.ts`
- Modify: `packages/plugin-waste-management/tests/search-params.test.ts`

- [ ] Gemeinsame Tabellenansicht für alle drei Scheduling-Typen durch UI-Tests absichern.
- [ ] Routing `list/create/edit` inklusive `schedulingEntryType` und `schedulingEntryId` durch Navigationstests absichern.
- [ ] Feiertagsregeln als editierbar, aber nicht löschbar testen.
- [ ] Gemeinsame Create-Detailseite nur für `global-shift` und `tour-shift` absichern.
- [ ] `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/search-params.test.ts --testFiles=tests/waste-management.scheduling-list-view.navigation.test.ts --testFiles=tests/waste-management.scheduling-content.test.tsx --testFiles=tests/waste-management.scheduling-shifts-table.test.tsx --testFiles=tests/waste-management.scheduling-panel.test.tsx --testFiles=tests/waste-management.scheduling.submissions.test.ts --testFiles=tests/plugin.translations.shared.test.ts --testFiles=tests/waste-management.low-coverage-views.test.tsx`
- [ ] `pnpm nx run plugin-waste-management:test:types`
