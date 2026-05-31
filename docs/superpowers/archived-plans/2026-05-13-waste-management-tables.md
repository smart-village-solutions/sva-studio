# Waste-Management Tabellen Implementation Plan

> **Status:** abgeschlossen
> **Abgeschlossen am:** 31. Mai 2026
> **Hinweis:** Die Umsetzung war im Repo bereits vorhanden. Der Plan wurde am Abschlussdatum inhaltlich auf den tatsächlichen Stand nachgezogen und anschließend archiviert.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Waste-Management-Übersichten für Touren, Ausweichtermine und Historie von Card-Listen auf Tabellen umstellen und die neue Übersichtsregel dokumentieren.

**Architecture:** Die bestehenden fachlichen Komponenten bleiben erhalten, aber ihre Mehrfachlisten werden durch tabellarische Listen mit klaren Spalten, Zeilenaktionen und barrierefreien Beschriftungen ersetzt. Übersetzungen und Tests werden parallel auf das neue Tabellenmuster angepasst.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, pnpm, Nx

---

### Task 1: Dokumentation der Regel und des Umbauumfangs

**Files:**
- Create: `docs/superpowers/specs/2026-05-13-waste-management-tables-design.md`
- Create: `docs/superpowers/plans/2026-05-13-waste-management-tables.md`

- [x] **Step 1: Spezifikation in Deutsch festhalten**

Beschreiben:
- Tabellen als Default für Übersichtsseiten
- Waste-Umfang: Touren, Scheduling, Historie
- Cards nur noch für Details, KPIs und visuelle Sonderfälle

- [x] **Step 2: Implementierungsplan speichern**

Beschreiben:
- betroffene UI-Komponenten
- benötigte Übersetzungen
- betroffene Tests
- Verifikationskommandos

### Task 2: Tests für tabellarische Touren- und Scheduling-Ansichten zuerst ergänzen

**Files:**
- Modify: `packages/plugin-waste-management/tests/...` für Touren und Scheduling

- [x] **Step 1: Failing Tests für Touren-Tabelle schreiben**
- [x] **Step 2: Testlauf ausführen und erwartetes Fehlschlagen prüfen**
- [x] **Step 3: Failing Tests für Scheduling-Tabellen schreiben**
- [x] **Step 4: Testlauf ausführen und erwartetes Fehlschlagen prüfen**

### Task 3: Touren und Scheduling auf Tabellen umbauen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours.content.tsx`
- Modify or replace: `packages/plugin-waste-management/src/waste-management.tours-card.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-content.tsx`
- Modify or replace: `packages/plugin-waste-management/src/waste-management.scheduling-card.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.scheduling.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.scheduling.ts`

- [x] **Step 1: Tabellenstruktur mit Caption, Headern und Zeilenaktionen implementieren**
- [x] **Step 2: Nicht mehr benötigte Card-Komponenten entfernen oder in Tabellenzeilenlogik überführen**
- [x] **Step 3: Neue Übersetzungen für Spalten und Tabellenbeschriftungen ergänzen**
- [x] **Step 4: Gezielte Tests erneut ausführen**

### Task 4: Historie/Overview testgetrieben auf Tabellen umbauen

**Files:**
- Modify: `packages/plugin-waste-management/tests/waste-management.overview-content.test.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.overview-content.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.overview.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.overview.ts`

- [x] **Step 1: Failing Tests für technische und Audit-Tabellen schreiben**
- [x] **Step 2: Testlauf ausführen und erwartetes Fehlschlagen prüfen**
- [x] **Step 3: Tabellen für technische und Audit-Historie implementieren**
- [x] **Step 4: Übersetzungen für Spalten ergänzen**
- [x] **Step 5: Gezielte Tests erneut ausführen**

### Task 5: Abschlussverifikation

**Files:**
- Verify only

- [x] **Step 1: Betroffene Waste-Tests gesammelt ausführen**
Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.overview-content.test.tsx --testFiles=tests/waste-management.master-data-locations-workspace.test.tsx`

- [x] **Step 2: Relevanten Nx-Targetlauf für das Plugin oder die App ausführen**
Run: `pnpm nx run plugin-waste-management:test:unit`

- [x] **Step 3: Ergebnis prüfen und nur mit frischer Evidenz berichten**
Expected:
- Komponententests grün
- keine verbliebenen Referenzen auf card-basierte Übersichtslisten in den umgebauten Waste-Ansichten
