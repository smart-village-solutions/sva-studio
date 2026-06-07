# Mainserver-Schnittstelle löschen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die SVA-Mainserver-Schnittstelle auf `/interfaces` soll löschbar sein und nach dem Bestätigen vollständig aus der Liste verschwinden.

**Architecture:** Die bestehende Sonderbehandlung des Mainservers bleibt bestehen. Die UI zeigt die Löschaktion künftig auch für den Mainserver, und der API-Layer routet die Mainserver-ID auf eine dedizierte Löschfunktion im `sva-mainserver` Package statt auf den generischen Stored-Interface-Delete-Pfad.

**Tech Stack:** React, TanStack Start Server Functions, Vitest, Nx, pnpm

---

### Task 1: Mainserver-Settings testgetrieben löschbar machen

**Files:**
- Modify: `packages/sva-mainserver/src/server/settings.test.ts`
- Modify: `packages/sva-mainserver/src/server/settings.ts`

- [ ] **Step 1: Write the failing test**

Ergänze in `packages/sva-mainserver/src/server/settings.test.ts` einen Test, der einen vorhandenen Mainserver-Record lädt, `deleteSvaMainserverSettings('de-test')` aufruft und `deleteExternalInterfaceRecord` mit der erwarteten Record-ID erwartet.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=packages/sva-mainserver/src/server/settings.test.ts`
Expected: FAIL, weil `deleteSvaMainserverSettings` noch nicht existiert.

- [ ] **Step 3: Write minimal implementation**

Ergänze in `packages/sva-mainserver/src/server/settings.ts` eine exportierte Funktion `deleteSvaMainserverSettings(instanceId: string): Promise<boolean>`, die den Default-Record vom Typ `sva_mainserver` lädt und bei Vorhandensein per `deleteExternalInterfaceRecord(record.id)` entfernt.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=packages/sva-mainserver/src/server/settings.test.ts`
Expected: PASS

### Task 2: Delete-API auf dedizierten Mainserver-Pfad routen

**Files:**
- Modify: `apps/sva-studio-react/src/lib/interfaces-api.test.ts`
- Modify: `apps/sva-studio-react/src/lib/interfaces-api.ts`

- [ ] **Step 1: Write the failing test**

Ergänze in `apps/sva-studio-react/src/lib/interfaces-api.test.ts` einen Test, der `deleteInstanceInterfaceServerFn` mit `id: 'sva-mainserver:de-musterhausen'` aufruft und erwartet, dass `deleteSvaMainserverSettings('de-musterhausen')` genutzt wird, während `deleteStoredInterface` unberührt bleibt.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/src/lib/interfaces-api.test.ts`
Expected: FAIL, weil die Delete-Logik den Mainserver noch nicht speziell behandelt.

- [ ] **Step 3: Write minimal implementation**

Passe `apps/sva-studio-react/src/lib/interfaces-api.ts` so an, dass der Delete-Handler bei `data.id === \`sva-mainserver:${instanceId}\`` die neue Funktion `deleteSvaMainserverSettings(instanceId)` aus `@sva/sva-mainserver/server` verwendet.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/src/lib/interfaces-api.test.ts`
Expected: PASS

### Task 3: UI-Löschaktion für Mainserver freischalten

**Files:**
- Modify: `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.tsx`

- [ ] **Step 1: Write the failing test**

Ergänze in `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.test.tsx` einen Test, der für einen alleinstehenden Mainserver-Eintrag den Löschbutton klickt und danach den Aufruf von `deleteInterface` mit `id: 'sva-mainserver:de-musterhausen'` erwartet.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/src/routes/interfaces/-interfaces-page.test.tsx`
Expected: FAIL, weil der Löschbutton für `mainserver` aktuell fehlt.

- [ ] **Step 3: Write minimal implementation**

Entferne in `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.tsx` die UI-Bedingung, die `Löschen` für `row.type === 'mainserver'` ausblendet.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/src/routes/interfaces/-interfaces-page.test.tsx`
Expected: PASS

### Task 4: Relevante Gates laufen lassen

**Files:**
- Test only

- [ ] **Step 1: Run focused package tests**

Run: `pnpm nx run-many --target=test:unit --projects=sva-mainserver,sva-studio-react`
Expected: PASS

- [ ] **Step 2: Run affected unit gate**

Run: `pnpm nx affected --target=test:unit --base=origin/main`
Expected: PASS
