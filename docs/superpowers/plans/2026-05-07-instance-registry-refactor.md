# Instanzverwaltung Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Instanzverwaltung entlang klarer Domänen-, Repository-, Service- und UI-Grenzen zerlegen, damit die aktuellen Komplexitäts-Findings ohne reine Kosmetik verschwinden und künftige Änderungen lokal bleiben.

**Architecture:** Zuerst werden Verträge und Aggregatgrenzen stabilisiert, danach Daten- und Service-Adapter auf Feature-Slices zerlegt und erst anschließend die Admin-UI auf kleinere View-Model- und Section-Module umgebaut. Die öffentliche API von `@sva/instance-registry` wird von einem Sammel-Index auf kuratierte Feature-Entrypoints reduziert, damit `publicExports`, Dateigröße und Änderungsradius gemeinsam sinken.

**Tech Stack:** TypeScript strict, React, Nx, pnpm Workspace, Vitest, OpenSpec, ESM-Server-Packages

---

## Zielbild und Reihenfolge

1. Verträge und Capability-Schnitt stabilisieren
2. Repository-Funktionen nach Lesemodellen, Mutationen und Keycloak-Runs aufteilen
3. Data-Layer auf kleine Fassaden über dem Repository reduzieren
4. `@sva/instance-registry` in Feature-Module statt God-Files zerlegen
5. Admin-UI in Route-Shell, View-Model, Sections und Action-Adapter splitten
6. Operative Skripte nur noch gegen Services/Fassaden statt gegen interne Mischzuständigkeiten laufen lassen
7. Optional: Organisationsverwaltung als separaten Folge-Stream behandeln

## Leitplanken

- Keine neue Fachlogik direkt in `index.ts`-Dateien
- `publicExports` nur über kuratierte Subpath-Entrypoints erhöhen, nicht über einen breiteren Root-Index
- Core bleibt framework-agnostisch; React-spezifische Ableitungen wandern in die App
- Serverseitige Runtime-Imports bleiben ESM-strikt mit `.js`
- Nach jedem Änderungsblock sofort betroffene Unit- und Type-Tests ausführen
- Architektur- und Refactor-Entscheidungen in OpenSpec plus `docs/architecture/` dokumentieren

### Task 1: Refactor-Rahmen und Zielgrenzen festziehen

**Files:**
- Modify: `openspec/changes/` via neuer Change `refactor-instance-registry-composition`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/development/complexity-quality-governance.md`

- [ ] **Step 1: OpenSpec-Change für den Refactor anlegen**
  Inhalt:
  - Capability: Instanzverwaltung
  - Ziel: Modulgrenzen, Exportflächen, Service-Slices, UI-Slices
  - Betroffene Schichten: `packages/core`, `packages/data*`, `packages/instance-registry`, `apps/sva-studio-react`, `scripts/ops`

- [ ] **Step 2: Architektur-Grenzen explizit dokumentieren**
  Dokumentiere vier Verantwortungsbereiche:
  - `packages/core`: reine Typen, Host-/Status-/Transition-Regeln
  - `packages/data-repositories`: SQL-nahe Persistenzbausteine
  - `packages/data`: Laufzeitnahe Fassaden, Caching, Invalidation
  - `packages/instance-registry`: Orchestrierung, HTTP, Provisioning, Runtime-Wiring

- [ ] **Step 3: Plan und Doku validieren**
  Run: `openspec validate refactor-instance-registry-composition --strict`
  Expected: erfolgreicher Validate-Lauf ohne Format- oder Scenario-Fehler

### Task 2: Core-Verträge und Exportflächen entmischen

**Files:**
- Modify: `packages/core/src/instances/registry.ts`
- Create: `packages/core/src/instances/registry-types.ts`
- Create: `packages/core/src/instances/registry-hosts.ts`
- Create: `packages/core/src/instances/registry-status.ts`
- Modify: `packages/core/src/index.ts` oder bestehender Public-Entry nach vorhandenem Muster
- Test: `packages/core/src/instances/*.test.ts`

- [ ] **Step 1: `registry.ts` entlang fachlicher Responsibility splitten**
  Zielstruktur:
  - `registry-types.ts`: Read-Model- und Run-Typen
  - `registry-hosts.ts`: `normalizeHost`, `isValid*`, `buildPrimaryHostname`, `classifyHost`
  - `registry-status.ts`: Statuskonstanten, Guards, `canTransitionInstanceStatus`

- [ ] **Step 2: Root-Exportfläche klein halten**
  Nur stabile Verträge aus `@sva/core` re-exporten; interne Helper nicht breit neu publizieren.

- [ ] **Step 3: Betroffene Tests ausführen**
  Run: `pnpm nx run core:test:unit`
  Run: `pnpm nx run core:test:types`
  Expected: grün; keine neuen `publicExports`-/Runtime-Probleme

### Task 3: Repository-Schicht in fachliche Dateien zerlegen

**Files:**
- Modify: `packages/data-repositories/src/instance-registry/index.ts`
- Create: `packages/data-repositories/src/instance-registry/repository-types.ts`
- Create: `packages/data-repositories/src/instance-registry/repository-mappers.ts`
- Create: `packages/data-repositories/src/instance-registry/repository-read-model.ts`
- Create: `packages/data-repositories/src/instance-registry/repository-module-assignments.ts`
- Create: `packages/data-repositories/src/instance-registry/repository-provisioning-runs.ts`
- Create: `packages/data-repositories/src/instance-registry/repository-keycloak-runs.ts`
- Create: `packages/data-repositories/src/instance-registry/repository-mutations.ts`
- Modify: `packages/data-repositories/src/instance-registry/server.ts`
- Test: `packages/data-repositories/src/instance-registry/*.test.ts`

- [ ] **Step 1: Typen und Mapper aus dem Repository-Einstieg herausziehen**
  `index.ts` soll am Ende nur noch den Vertrag plus Factory-Komposition enthalten, nicht alle Row-Typen und SQL-Bausteine.

- [ ] **Step 2: Reads, Mutations und Keycloak-Run-Persistenz separat kapseln**
  Empfohlene Schnitte:
  - Listen/Detail/Hostname-Auflösung
  - Modulzuweisung und IAM-Sync
  - Provisioning-Runs/Audit-Events
  - Keycloak-Provisioning-Runs und Steps

- [ ] **Step 3: `server.ts` auf Cache-/Invalidation-Helfer begrenzen**
  Keine Query- oder Mapping-Logik mehr in `server.ts`; nur servernahe Repository-Erzeugung und Host-Invalidierung.

- [ ] **Step 4: Repository-Tests nach Slice ausführen**
  Run: `pnpm nx run data-repositories:test:unit`
  Run: `pnpm nx run data-repositories:test:types`
  Run: `pnpm nx run data-repositories:check:runtime`
  Expected: grün; keine Node-ESM-Verstöße

### Task 4: `packages/data` zu schlanken Fassaden umbauen

**Files:**
- Modify: `packages/data/src/instance-registry/index.ts`
- Modify: `packages/data/src/instance-registry/server.ts`
- Create: `packages/data/src/instance-registry/repository-contract.ts`
- Create: `packages/data/src/instance-registry/instance-registry-read-service.ts`
- Create: `packages/data/src/instance-registry/instance-registry-mutation-service.ts`
- Modify: `packages/data/src/integrations/instance-integrations.server.ts`
- Modify: `packages/data-repositories/src/integrations/instance-integrations.server.ts`
- Test: `packages/data/src/instance-registry/*.test.ts`

- [ ] **Step 1: Duplizierte Repository-Contracts zwischen `data` und `data-repositories` abbauen**
  Ziel: Ein führender Vertrag, die andere Schicht importiert Typen statt Copy-Paste-Strukturen weiterzutragen.

- [ ] **Step 2: `packages/data` auf app-nahe Fassaden reduzieren**
  Trennung:
  - Read-Fassade für Listen/Detail/Hostname
  - Mutation-Fassade für Create/Update/Status/Module
  - Server-Helfer für Invalidation und runtime-nahe Defaults

- [ ] **Step 3: Integrationsdateien auf denselben Contract ausrichten**
  `instance-integrations.server.ts` nur dort anfassen, wo die aktuelle Instanz-/Integrationskopplung auf denselben aufgeblähten Vertrag zeigt.

- [ ] **Step 4: Tests direkt nach dem Schnitt fahren**
  Run: `pnpm nx run data:test:unit`
  Run: `pnpm nx run data:test:types`
  Run: `pnpm nx run data:check:runtime`
  Expected: grün; keine Drift zwischen `data` und `data-repositories`

### Task 5: Service- und HTTP-Schicht von `@sva/instance-registry` in Feature-Slices zerlegen

**Files:**
- Modify: `packages/instance-registry/src/service.ts`
- Modify: `packages/instance-registry/src/service-keycloak.ts`
- Modify: `packages/instance-registry/src/service-keycloak-execution-shared.ts`
- Modify: `packages/instance-registry/src/http-instance-handlers.ts`
- Modify: `packages/instance-registry/src/http-mutation-handlers.ts`
- Modify: `packages/instance-registry/src/index.ts`
- Modify: `packages/instance-registry/src/mutation-input-builders.ts`
- Modify: `packages/instance-registry/src/provisioning-auth-state.ts`
- Create: `packages/instance-registry/src/service/instance-list.ts`
- Create: `packages/instance-registry/src/service/instance-detail.ts`
- Create: `packages/instance-registry/src/service/instance-mutations.ts`
- Create: `packages/instance-registry/src/service/module-assignment.ts`
- Create: `packages/instance-registry/src/service/keycloak-status.ts`
- Create: `packages/instance-registry/src/service/keycloak-execution.ts`
- Create: `packages/instance-registry/src/http/http-read-handlers.ts`
- Create: `packages/instance-registry/src/http/http-mutation-actions.ts`
- Create: `packages/instance-registry/src/http/http-keycloak-actions.ts`
- Create: `packages/instance-registry/src/contracts/instance-mutation-inputs.ts`
- Create: `packages/instance-registry/src/contracts/instance-registry-public.ts`
- Test: `packages/instance-registry/src/*.test.ts`

- [ ] **Step 1: `service.ts` auf reine Komposition reduzieren**
  Die Factory `createInstanceRegistryService` soll nur Handler zusammensetzen. Fachlogik wandert in dedizierte Funktionsmodule.

- [ ] **Step 2: Keycloak-Flows nach Read/Plan/Execute aufteilen**
  Ziel:
  - Status/Preflight lesen
  - Provisioning-Plan erzeugen
  - Queue-Claim/Execute/Finalize getrennt halten
  - Secret-Lese-/Decrypt-Helfer separat kapseln

- [ ] **Step 3: HTTP-Dateien in Route-Handler und Action-Dispatcher trennen**
  `http-mutation-handlers.ts` sollte nicht gleichzeitig Validierung, Error-Mapping, Action-Auswahl und Response-Building enthalten.

- [ ] **Step 4: Root-Index verschlanken und Subpath-Entrypoints bevorzugen**
  `src/index.ts` nur für die Kernfläche:
  - Service-Factory
  - Runtime-Wiring
  - stabile HTTP-Fassaden
  - öffentliche Vertragstypen
  Input-Builder und interne Provisioning-Helfer über Subpaths statt Root-Export.

- [ ] **Step 5: Package-Gates vollständig ausführen**
  Run: `pnpm nx run instance-registry:test:unit`
  Run: `pnpm nx run instance-registry:test:types`
  Run: `pnpm nx run instance-registry:check:runtime`
  Expected: grün; `publicExports` reduziert; keine gebrochenen Subpath-Consumer

### Task 6: Auth-Runtime-Konsumenten auf die neue `instance-registry`-Fläche umstellen

**Files:**
- Review/Modify: `packages/auth-runtime/src/iam-instance-registry/core.ts`
- Review/Modify: `packages/auth-runtime/src/iam-instance-registry/core-mutations.ts`
- Review/Modify: `packages/auth-runtime/src/iam-instance-registry/core-keycloak.ts`
- Review/Modify: `packages/auth-runtime/src/iam-instance-registry/service.ts`
- Review/Modify: `packages/auth-runtime/src/iam-instance-registry/service-keycloak.ts`
- Review/Modify: `packages/auth-runtime/src/iam-instance-registry/service-keycloak-execution.ts`
- Review/Modify: `packages/auth-runtime/src/iam-instance-registry/service-keycloak-execution-shared.ts`
- Review/Modify: `packages/auth-runtime/src/iam-instance-registry/provisioning-auth*.ts`
- Test: `packages/auth-runtime/src/iam-instance-registry/*.test.ts`

- [ ] **Step 1: Consumer-Matrix gegen neue Entrypoints prüfen**
  Ziel ist, dass `auth-runtime` weniger breite Root-Imports nutzt und stattdessen stabile Subpaths verwendet.

- [ ] **Step 2: Vitest-Aliase und Paket-Exports mitziehen**
  Besonders relevant wegen bestehender Alias-Matrix in `packages/auth-runtime/vitest.config.ts`.

- [ ] **Step 3: Runtime- und Typ-Checks ausführen**
  Run: `pnpm nx run auth-runtime:test:unit`
  Run: `pnpm nx run auth-runtime:test:types`
  Run: `pnpm nx run auth-runtime:check:runtime`
  Expected: grün; keine Importpfad-Regressionen

### Task 7: Admin-UI in Route-Shell, View-Model und Sektionen zerlegen

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instances-shared.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-create-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/instances/create-instance-model.ts`
- Create: `apps/sva-studio-react/src/routes/admin/instances/detail-instance-model.ts`
- Create: `apps/sva-studio-react/src/routes/admin/instances/instance-error-messages.ts`
- Create: `apps/sva-studio-react/src/routes/admin/instances/instance-status-labels.ts`
- Create: `apps/sva-studio-react/src/routes/admin/instances/components/*.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/instances/*.test.tsx`

- [ ] **Step 1: `-instances-shared.tsx` als Domänen-UI-Toolkit zerlegen**
  Empfohlene Schnitte:
  - Status- und Label-Konstanten
  - Fehlermapping
  - Create-/Detail-Form-Modelle
  - Cockpit-/Assessment-Ableitungen
  - kleine Presentational Components separat

- [ ] **Step 2: Create-Page auf Wizard-Shell plus Step-Komponenten reduzieren**
  Die Route-Datei soll nur State-Orchestrierung und Server-Mutation halten; Validierungs- und Copy-Helfer wandern aus.

- [ ] **Step 3: Detail-Page in Control-Tower-, Workbench- und Historien-Sektionen zerlegen**
  Sinnvolle Teilmodule:
  - Overview/Primary Action
  - Tenant-IAM-Cockpit
  - Keycloak/Provisioning
  - Modulzuweisungen
  - Historie/Audit

- [ ] **Step 4: UI-spezifische Tests und danach App-Gates ausführen**
  Run: `pnpm nx run sva-studio-react:test:unit`
  Run: `pnpm nx run sva-studio-react:test:types`
  Expected: grün; keine neuen Hardcoded-Strings; i18n bleibt in `t('...')`

### Task 8: Operative Skripte auf kleine Commands und gemeinsame Services umstellen

**Files:**
- Modify: `scripts/ops/instance-registry.ts`
- Modify: `scripts/ops/bootstrap-local-instance-db.ts`
- Create: `scripts/ops/instance-registry/command-context.ts`
- Create: `scripts/ops/instance-registry/read-commands.ts`
- Create: `scripts/ops/instance-registry/mutation-commands.ts`
- Create: `scripts/ops/instance-registry/formatters.ts`
- Test: `scripts/ops/**/*.test.ts`

- [ ] **Step 1: CLI-Skript in Command-Module splitten**
  Reads, Mutations, Ausgabeformatierung und Runtime-Bootstrap dürfen nicht weiter in einer Datei vermischt bleiben.

- [ ] **Step 2: Lokales DB-Bootstrap-Skript auf Seed-Bausteine aufteilen**
  Seed-Daten, SQL-Setup, CLI-Parsing und Logging in getrennte kleine Module.

- [ ] **Step 3: Betroffene Skript-Tests ausführen**
  Run: `pnpm nx affected --target=test:unit --files=scripts/ops/instance-registry.ts,scripts/ops/bootstrap-local-instance-db.ts`
  Expected: grün; keine Regression der lokalen Ops-Flows

### Task 9: Optionaler Folge-Stream Organisationsverwaltung

**Files:**
- Review later: `packages/iam-admin/src/organization-mutation-handlers.ts`
- Review later: `packages/iam-admin/src/organization-read-handlers.ts`

- [ ] **Step 1: Nicht in denselben PR mischen, solange keine harte gemeinsame Schnittstelle blockiert**
  Die Handler sind fachlich benachbart, aber kein zwingender Teil des ersten Instanzverwaltungs-Refactors.

- [ ] **Step 2: Nur ausnahmsweise vorziehen**
  Vorziehen nur, wenn beim Export-Rückbau oder Handler-Splitting in `instance-registry` direkte Cross-Package-Zyklen sichtbar werden.

## Empfohlene PR-Slices

1. OpenSpec + Architektur-Doku
2. `packages/core` + `packages/data-repositories`
3. `packages/data` + angrenzende Integrationsverträge
4. `packages/instance-registry` Service/HTTP/API
5. `packages/auth-runtime` Konsumenten-Anpassung
6. Admin-UI
7. Ops-Skripte

## Priorisierte Refactor-Reihenfolge für die aktuelle Finding-Liste

1. `packages/instance-registry/src/index.ts`
2. `packages/instance-registry/src/service.ts`
3. `packages/instance-registry/src/http-mutation-handlers.ts`
4. `packages/data-repositories/src/instance-registry/index.ts`
5. `packages/data/src/instance-registry/index.ts`
6. `apps/sva-studio-react/src/routes/admin/instances/-instances-shared.tsx`
7. `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.tsx`
8. `apps/sva-studio-react/src/routes/admin/instances/-instance-create-page.tsx`
9. `scripts/ops/instance-registry.ts`
10. Restliche Keycloak-/Server-/Integration-Helfer als Nachschnitt

## Definition of Done

- Alle getrackten Instanzverwaltungs-Hotspots liegen wieder unter den Grenzwerten oder sind auf kleinere, klar begrenzte Folge-Findings heruntergebrochen
- `@sva/instance-registry` hat eine kleinere Root-Exportfläche und stabile Subpath-Entrypoints
- `packages/data` und `packages/data-repositories` teilen sich keinen aufgeblähten Doppelvertrag mehr
- Admin-UI-Routen bestehen aus Route-Shell plus kleinen Teilmodulen statt aus 500-1200-Zeilen-Dateien
- Relevante OpenSpec-, Architektur- und Entwicklungsdoku ist aktualisiert
- Mindestens `pnpm test:unit`, `pnpm test:types`, `pnpm test:eslint` für die betroffenen Projekte sowie zielgerichtete Nx-Gates sind grün
