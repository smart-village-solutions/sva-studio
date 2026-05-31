# News Category Multiselect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ersetze die bisherigen News-Felder `Kategorie` und Freitext-`Kategorien` durch eine suchbare Mehrfachauswahl, die verfügbare Kategorien per Mainserver-GraphQL lädt.

**Architecture:** Der Mainserver erhält einen kleinen read-only Kategorien-Endpoint über die bestehende Service-/GraphQL-Schicht. Das News-Plugin lädt diese Kategorien beim Editorstart, hält die Auswahl als Liste von Kategorienamen im Formular und rendert eine suchbare Vorschlagsliste mit entfernbaren Chips und explizitem `Kategorie hinzufügen`.

**Tech Stack:** TypeScript, React, react-hook-form, Nx, bestehende Mainserver-Service-Layer, Vitest.

---

### Task 1: Mainserver-Kategorien lesbar machen

**Files:**
- Create: `packages/sva-mainserver/src/generated/categories.ts`
- Modify: `packages/sva-mainserver/src/types.ts`
- Modify: `packages/sva-mainserver/src/server/service.ts`
- Modify: `packages/sva-mainserver/src/index.ts`
- Modify: `packages/sva-mainserver/src/index.server.ts`
- Create: `packages/sva-mainserver/src/server/categories-route.ts`
- Test: `packages/sva-mainserver/src/server/categories-route.test.ts`
- Modify: `apps/sva-studio-react/src/server.ts`
- Create: `apps/sva-studio-react/src/lib/mainserver-categories-api.server.ts`

- [x] Failing Tests für den neuen `/api/v1/mainserver/categories`-Read-Endpoint schreiben.
- [x] Minimalen GraphQL-Read für `categories(order: name_ASC)` implementieren und auf `SvaMainserverCategory[]` mappen.
- [x] Endpoint über Studio-Server durchverdrahten.
- [x] Betroffene Server-Tests grün ziehen.

### Task 2: News-Plugin auf neue Kategorienquelle und neues Formularmodell umstellen

**Files:**
- Modify: `packages/plugin-news/src/news.types.ts`
- Modify: `packages/plugin-news/src/news.api.ts`
- Modify: `packages/plugin-news/src/news.detail-form.ts`
- Modify: `packages/plugin-news/src/news.detail-basis-tab.tsx`
- Modify: `packages/plugin-news/src/plugin.translations.ts`
- Test: `packages/plugin-news/tests/news.detail-form.test.ts`

- [x] Failing Tests für das neue Formularmodell schreiben: keine `categoryName`/`categoriesText` mehr, stattdessen ausgewählte Kategorienliste.
- [x] Kategorien-Ladefunktion im Plugin ergänzen.
- [x] Formular-Mapping und Mutation so umbauen, dass nur noch `categories: [{ name }]` geschrieben wird.
- [x] Validierung und Dirty-State auf das neue Feld umstellen.

### Task 3: Suchbares Auswahlfeld mit Entfernen und Hinzufügen bauen

**Files:**
- Create: `packages/plugin-news/src/news.category-multiselect.tsx`
- Modify: `packages/plugin-news/src/news.detail-page.tsx`
- Test: `packages/plugin-news/tests/news.pages.test.tsx`

- [x] Failing UI-Tests schreiben für:
  - Laden der Kategorie-Vorschläge
  - Filtern per Suche
  - Hinzufügen einer Kategorie
  - Entfernen einer Kategorie
  - Hinzufügen mehrerer Kategorien
- [x] Lokalen Multi-Select mit Input, Vorschlags-Dropdown/Datalist, Chips und `Kategorie hinzufügen` implementieren.
- [x] Basis-Tab auf den neuen Baustein umstellen.
- [x] Speichern/Create/Edit-Tests grün ziehen.

### Task 4: Verifikation

**Files:**
- Test only

- [x] `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/categories-route.test.ts`
- [x] `pnpm nx run plugin-news:test:unit --testFiles=tests/news.detail-form.test.ts --testFiles=tests/news.pages.test.tsx`
- [x] `pnpm nx run plugin-news:test:types`
- [x] Falls Typgrenzen betroffen sind: `pnpm nx run sva-mainserver:test:types`
