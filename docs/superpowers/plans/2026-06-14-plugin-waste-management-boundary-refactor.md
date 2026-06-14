# Plugin Waste Management Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@sva/plugin-waste-management` schrittweise vom aktuellen Brownfield-Zuschnitt auf den dokumentierten Plugin-Vertrag zurückführen, ohne den laufenden Funktionsumfang oder den warn-only Rollout des Guards zu destabilisieren.

**Architecture:** Der Umbau trennt drei Problemklassen bewusst: erstens echte Host-Kopplungen auf Package- und Runtime-Ebene, zweitens browserseitige Orchestrierungsdateien mit für Plugins unpassender Rollenbenennung, drittens den späteren Übergang von warn-only zu no-new-violations. Die Umsetzung erfolgt in kleinen, testbaren Phasen mit Kompatibilitätsbrücken, damit jede Phase für sich verifizierbar und revertierbar bleibt.

**Tech Stack:** TypeScript strict mode, React 19, pnpm, Nx, Vitest, tsx, Markdown-Doku, Plugin Boundary Guard

---

## Ausgangslage

Der Guard meldet heute für `packages/plugin-waste-management` drei unterschiedliche Drift-Arten:

1. **Echte Package-Kopplungen**
   - `@sva/core`
   - `@sva/studio-module-iam`

2. **Host-/Runtime-Rollen im Plugin-Package**
   - `src/server.ts`
   - `src/plugin-operations.ts` als falsch benannte Metadaten-/Definitionsdatei

3. **Browser-seitige Orchestrierungsdateien mit reviewpflichtigen Signalnamen**
   - `*.controller.*`
   - `*.loaders.*`
   - `*.submissions.*`
   - `*.state.*`

Wichtig: Die dritte Gruppe ist nach heutigem Stand nicht automatisch fachlich falsch. Ein großer Teil dieser Dateien ist browserseitige UI-Orchestrierung und kann im Plugin bleiben, sollte aber anders zugeschnitten und benannt werden, damit die Plugin-Grenze technisch sauberer und reviewärmer wird.

## Zielbild nach dem Umbau

- `@sva/plugin-waste-management` bleibt ein Browser-/Plugin-Package.
- Das Package hängt nur noch von `@sva/plugin-sdk`, `@sva/studio-ui-react` und externen NPM-Paketen ab.
- Plugin-IAM-Metadaten kommen nicht mehr aus `@sva/studio-module-iam`, sondern aus einem plugin-eigenen oder SDK-öffentlichen Vertrag.
- Runtime-/Job-Execution-Logik liegt in einem host-owned Package außerhalb von `packages/plugin-*`.
- Plugin-Metadaten wie `jobTypes` und `importProfiles` bleiben beim Browser-/Plugin-Package, werden aber semantisch passend benannt.
- Browserseitige Dateien im Plugin werden nach React-/Plugin-Semantik geschnitten:
  - `controller` → `use-...-model` oder `use-...-view-model`
  - `loaders` → `use-...-overview` oder `...-queries`
  - `submissions` → `...-mutations`
  - `state` → `use-...-state`
  - `plugin-operations` → `...-job-definitions` oder `...-plugin-metadata`
- Der Guard bleibt bis zum Ende des Umbaus warn-only; erst danach wird auf no-new-violations verschärft.

## Absicherungsstrategie

### Technische Gates pro Phase

- Immer vor Start einer Phase:
  - [ ] `pnpm check:plugin-architecture-boundary`
  - [ ] `pnpm nx run plugin-waste-management:test:unit`
  - [ ] `pnpm nx run plugin-waste-management:test:types`

- Nach jeder abgeschlossenen Phase zusätzlich:
  - [ ] `pnpm test:eslint`
  - [ ] `pnpm check:file-placement`

- Nach jeder Phase mit Package-Schnitt oder Export-Änderung zusätzlich:
  - [ ] `pnpm nx affected --target=test:types --base=origin/main`
  - [ ] `pnpm check:server-runtime` falls ein neues host-owned Runtime-Package entsteht

### Inhaltliche Sicherungen

- Keine Logik- und Namensrefactorings in demselben Commit mischen.
- Vor jeder Umbenennung zuerst charakterisierende Tests ergänzen.
- Neue öffentliche Verträge zuerst parallel einführen, alte Pfade erst in einem Folgeschritt entfernen.
- Der Guard bleibt während der ganzen Umbauphase nicht blockierend; neue Warnungen gelten aber reviewseitig als Regression.
- Für jede Phase wird die erwartete Guard-Differenz explizit festgehalten: welche Warnungen verschwinden sollen und welche bewusst bleiben.
- Vor jeder Extraktion in ein neues Package wird mit `rg` oder Tests geprüft, ob die betroffene Datei wirklich host-owned Runtime ist oder nur unglücklich benannte Plugin-Metadaten enthält.

### Review- und Rollout-Sicherung

- Jede Phase als eigener PR oder mindestens als eigener Commit-Block.
- Architekturreview ist Pflicht für:
  - neues host-owned Runtime-Package
  - neue Plugin-SDK-Exports
  - Änderungen an `config/plugin-architecture-allowlist.json`
- Erst nach Abschluss von Phase 4 wird entschieden, ob `pnpm check:plugin-architecture-boundary` auf no-new-violations umgestellt wird.

## File Structure Map

### Bestehende Dateien mit hoher Änderungswahrscheinlichkeit

- Modify: `packages/plugin-waste-management/package.json`
- Modify: `packages/plugin-waste-management/src/index.ts`
- Modify: `packages/plugin-waste-management/src/plugin.tsx`
- Modify: `packages/plugin-waste-management/src/server.ts`
- Modify: `packages/plugin-waste-management/src/plugin-operations.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.controller.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.controller.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.controller.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tools.controller.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.loaders.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.loaders.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.loaders.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.loaders.parts.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.submissions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.submissions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.submissions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.state.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.state.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tools.state.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.state.ts`

### Voraussichtlich neue Dateien oder neue Zielorte

- Create: `packages/plugin-waste-management/src/waste-management.module-iam.ts`
- Create: `packages/plugin-waste-management/src/waste-management.job-definitions.ts`
- Create: `packages/plugin-waste-management/src/use-waste-master-data-view-model.ts`
- Create: `packages/plugin-waste-management/src/use-waste-scheduling-view-model.ts`
- Create: `packages/plugin-waste-management/src/use-waste-tours-view-model.ts`
- Create: `packages/plugin-waste-management/src/use-waste-tools-view-model.ts`
- Create: `packages/plugin-waste-management/src/use-waste-master-data-state.ts`
- Create: `packages/plugin-waste-management/src/use-waste-scheduling-state.ts`
- Create: `packages/plugin-waste-management/src/use-waste-tools-state.ts`
- Create: `packages/plugin-waste-management/src/use-waste-tours-state.ts`
- Create: `packages/plugin-waste-management/src/waste-management.master-data-mutations.ts`
- Create: `packages/plugin-waste-management/src/waste-management.scheduling-mutations.ts`
- Create: `packages/plugin-waste-management/src/waste-management.tours-mutations.ts`
- Create: `packages/plugin-waste-management/src/use-waste-master-data-overview.ts`
- Create: `packages/plugin-waste-management/src/use-waste-scheduling-overview.ts`
- Create: `packages/plugin-waste-management/src/use-waste-tours-overview.ts`
- Create: `packages/waste-management-runtime/package.json`
- Create: `packages/waste-management-runtime/src/index.ts`
- Create: `packages/waste-management-runtime/src/server.ts`

### Betroffene Doku- und Guard-Dateien

- Modify: `config/plugin-architecture-allowlist.json`
- Modify: `docs/guides/plugin-development.md`
- Modify: `docs/architecture/package-zielarchitektur.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`

## Task 1: Sicherheitsnetz und Baseline vor dem eigentlichen Umbau stabilisieren

**Files:**
- Modify: `packages/plugin-waste-management` Tests rund um `plugin.tsx`, `server.ts`, `plugin-operations.ts`
- Modify: `scripts/ci/check-plugin-architecture-boundary.test.ts` nur falls eine Guard-Snapshot-Absicherung fehlt

- [ ] **Step 1: Charakterisierende Tests für Plugin-Metadaten ergänzen**

Ergänze oder schärfe Unit-Tests für:
- `permissions`
- `auditEvents`
- `jobTypes`
- `importProfiles`
- `moduleIam`

Ziel: spätere Entkopplungen dürfen die veröffentlichten Plugin-Metadaten nicht versehentlich ändern.

- [ ] **Step 2: Charakterisierende Tests für Runtime-Exports ergänzen**

Sichere ab, dass `server.ts` und `plugin-operations.ts` dieselben Job-Type-IDs, Progress-Keys und Result-Detail-Keys liefern wie heute.

- [ ] **Step 3: Guard-Status als Umbau-Baseline dokumentieren**

Notiere in einer kurzen internen Notiz oder im PR-Kontext die heute erwarteten Warnungen:
- 2 Package-Dependencies
- 1 Runtime-Signaldatei
- 1 Metadaten-/Definitionsdatei mit ungeeignetem Namen
- 15 Browser-Signaldateien

- [ ] **Step 4: Relevante Tests und Gates ausführen**

Run:

```bash
pnpm check:plugin-architecture-boundary
pnpm nx run plugin-waste-management:test:unit
pnpm nx run plugin-waste-management:test:types
```

Expected: Alles grün, Guard weiterhin warn-only mit dem bekannten Altbestand.

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-waste-management scripts/ci/check-plugin-architecture-boundary.test.ts
git commit -m "test: characterize waste management plugin boundary behavior"
```

## Task 2: Direkte Package-Kopplungen abbauen, ohne Laufzeitverhalten zu ändern

**Files:**
- Modify: `packages/plugin-waste-management/package.json`
- Modify: `packages/plugin-waste-management/src/plugin.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.module-iam.ts`
- Test: bestehende oder neue Tests für `plugin.tsx`

- [ ] **Step 1: `@sva/core`-Nutzung vollständig verifizieren**

Prüfe mit `rg`, ob `@sva/core` im Plugin überhaupt noch direkt referenziert wird. Nach aktuellem Stand kommen die relevanten Waste-Contracts bereits aus `@sva/plugin-sdk`.

- [ ] **Step 2: `@sva/core` aus `package.json` entfernen, falls ungenutzt**

Wenn keine direkten Importe existieren, entferne die Dependency in einem isolierten Commit ohne weitere Logikänderung.

- [ ] **Step 3: `@sva/studio-module-iam` durch lokalen Plugin-Vertrag ersetzen**

Extrahiere die Waste-Management-IAM-Metadaten aus `plugin.tsx` in eine neue lokale Datei `waste-management.module-iam.ts`. `plugin.tsx` soll den Vertrag direkt verwenden statt `studioModuleIamRegistry.get('waste-management')`.

Begründung:
- Das Plugin kennt seine eigenen Permission-IDs bereits selbst.
- Der aktuelle Registry-Zugriff ist nur eine Host-Kopplung ohne echte Mehrwertlogik.

- [ ] **Step 4: `@sva/studio-module-iam` aus `package.json` entfernen**

Sobald `plugin.tsx` nur noch lokale oder SDK-öffentliche Verträge nutzt, entferne die Dependency.

- [ ] **Step 5: Relevante Tests und Gates ausführen**

Run:

```bash
pnpm check:plugin-architecture-boundary
pnpm nx run plugin-waste-management:test:unit
pnpm nx run plugin-waste-management:test:types
pnpm test:eslint
```

Expected: Beide Dependency-Warnungen verschwinden; die übrigen Signalwarnungen bleiben unverändert.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-waste-management/package.json packages/plugin-waste-management/src/plugin.tsx packages/plugin-waste-management/src/waste-management.module-iam.ts
git commit -m "refactor: remove host package dependencies from waste plugin"
```

## Task 3: Browser-Orchestrierung semantisch umbenennen und in UI-nahe Rollen schneiden

**Files:**
- Create: `packages/plugin-waste-management/src/use-waste-master-data-view-model.ts`
- Create: `packages/plugin-waste-management/src/use-waste-scheduling-view-model.ts`
- Create: `packages/plugin-waste-management/src/use-waste-tours-view-model.ts`
- Create: `packages/plugin-waste-management/src/use-waste-tools-view-model.ts`
- Create: `packages/plugin-waste-management/src/waste-management.job-definitions.ts`
- Create: `packages/plugin-waste-management/src/use-waste-master-data-state.ts`
- Create: `packages/plugin-waste-management/src/use-waste-scheduling-state.ts`
- Create: `packages/plugin-waste-management/src/use-waste-tools-state.ts`
- Create: `packages/plugin-waste-management/src/use-waste-tours-state.ts`
- Create: `packages/plugin-waste-management/src/use-waste-master-data-overview.ts`
- Create: `packages/plugin-waste-management/src/use-waste-scheduling-overview.ts`
- Create: `packages/plugin-waste-management/src/use-waste-tours-overview.ts`
- Create: `packages/plugin-waste-management/src/waste-management.master-data-mutations.ts`
- Create: `packages/plugin-waste-management/src/waste-management.scheduling-mutations.ts`
- Create: `packages/plugin-waste-management/src/waste-management.tours-mutations.ts`
- Modify: alle bisherigen `*.controller.*`, `*.loaders.*`, `*.submissions.*`, `*.state.*`-Verbraucher
- Modify: `packages/plugin-waste-management/src/plugin-operations.ts`
- Modify: `packages/plugin-waste-management/src/plugin.tsx`
- Modify: `packages/plugin-waste-management/src/index.ts`

- [ ] **Step 1: Nur die `controller`-Dateien umstellen**

Ersetze die `controller`-Dateien zuerst durch `use-...-view-model`-Dateien mit identischem Verhalten und kompatiblen Rückgabewerten. In dieser Phase keine inhaltlichen Änderungen an Loader-, Submission- oder State-Logik vornehmen.

- [ ] **Step 2: Nach der Controller-Umbenennung gezielt testen**

Run:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=src/plugin.test.tsx
pnpm check:plugin-architecture-boundary
```

Expected: Die `*.controller.*`-Warnungen verschwinden; keine neuen Warnungen entstehen.

- [ ] **Step 3: `loaders` in browserseitige Overview-/Query-Hooks umstellen**

Ziel ist keine neue Datenarchitektur, sondern ein semantisch sauberer Name für clientseitige Ladeorchestrierung.

- [ ] **Step 4: `submissions` in `mutations` umstellen**

Die Dateien bleiben im Plugin, aber werden als browserseitige Mutationslogik modelliert statt als servernah klingende Submission-Schicht.

- [ ] **Step 5: `state` in `use-...-state` umstellen**

Die State-Dateien sind React/UI-State und sollen auch so benannt sein. Erst jetzt umstellen, damit vorherige Umbauten nicht mit State-Renames vermischt werden.

- [ ] **Step 6: `plugin-operations.ts` als Plugin-Metadaten umbenennen**

Da die Datei aktuell `jobTypes` und `importProfiles` definiert, aber keine Host-Runtime ausführt, bleibt sie im Plugin-Package. Benenne sie in `waste-management.job-definitions.ts` oder einen gleichwertig präzisen Namen um und passe nur die Importe in `plugin.tsx`, `index.ts` und Tests an.

- [ ] **Step 7: Breitere Tests und Gates ausführen**

Run:

```bash
pnpm nx run plugin-waste-management:test:unit
pnpm nx run plugin-waste-management:test:types
pnpm check:plugin-architecture-boundary
pnpm test:eslint
```

Expected: Alle Warnungen für `*.controller.*`, `*.loaders.*`, `*.submissions.*`, `*.state.*` und `plugin-operations.ts` sind verschwunden. Übrig bleibt nur `server.ts`.

- [ ] **Step 8: Commit**

```bash
git add packages/plugin-waste-management
git commit -m "refactor: align waste plugin browser orchestration with plugin semantics"
```

## Task 4: Discovery-Checkpoint vor der Runtime-Extraktion

**Files:**
- Inspect only: Host-Wiring-Stellen für Job-Runtime und Plugin-Exports

- [ ] **Step 1: Tatsächliche Runtime-Importe verifizieren**

Prüfe mit `rg`, welche Stellen heute wirklich `createPluginJobExecutionHandlers` oder `server.ts` verwenden. Nach heutigem Stand ist das eine andere Klasse als `plugin.tsx`, das nur `jobTypes` und `importProfiles` braucht.

- [ ] **Step 2: Extraktionsziel bewusst bestätigen**

Go für die nächste Phase nur, wenn beide Aussagen stimmen:
- `server.ts` enthält echte host-owned Runtime-Logik
- `plugin-operations.ts` wurde bereits als reine Plugin-Metadaten-Datei im Plugin belassen oder umbenannt

- [ ] **Step 3: Architektur-Checkpoint dokumentieren**

Halte in PR oder Notiz fest:
- welche Importe auf `server.ts` zeigen
- ob `@sva/waste-management-runtime` der richtige Zielort ist
- ob ein anderer bestehender Host-Kontext besser passt

## Task 5: Nur die echte Runtime-Logik aus dem Plugin in ein host-owned Package extrahieren

**Files:**
- Create: `packages/waste-management-runtime/package.json`
- Create: `packages/waste-management-runtime/src/index.ts`
- Create: `packages/waste-management-runtime/src/server.ts`
- Modify: `packages/plugin-waste-management/src/index.ts`
- Modify: ggf. Host-Wiring-Stellen, die bisher `@sva/plugin-waste-management/server` nutzen
- Modify: betroffene Tests und Typ-Checks

- [ ] **Step 1: Neues host-owned Runtime-Package ohne Verhaltensänderung anlegen**

Lege `@sva/waste-management-runtime` an. Verschiebe zunächst nur `server.ts` inklusive Tests und Package-Metadaten, ohne die alten Exporte sofort zu löschen.

- [ ] **Step 2: Host-Wiring auf das neue Package umstellen**

Suche alle Importe auf:
- `@sva/plugin-waste-management/server`
- `@sva/plugin-waste-management`
  nur für `createPluginJobExecutionHandlers`

Stelle nur diese Runtime-Importe auf `@sva/waste-management-runtime` um. `jobTypes` und `importProfiles` bleiben über das Plugin-Package verfügbar.

- [ ] **Step 3: Kompatibilitätsfenster kurz halten**

Wenn temporäre Re-Exports notwendig sind, nur für einen kurzen Commit-Block. Danach:
- `server.ts` aus dem Plugin-Package entfernen
- `src/index.ts` nur noch browserrelevante Exporte lassen

- [ ] **Step 4: Server-Runtime und betroffene Affected-Gates ausführen**

Run:

```bash
pnpm check:server-runtime
pnpm nx affected --target=test:types --base=origin/main
pnpm nx run plugin-waste-management:test:unit
pnpm check:plugin-architecture-boundary
```

Expected: Die letzte Path-Signal-Warnung (`server.ts`) verschwindet.

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-waste-management packages/waste-management-runtime
git commit -m "refactor: extract waste management runtime from plugin package"
```

## Task 6: Guard, Allowlist und Doku auf den neuen Ist-Zustand nachziehen

**Files:**
- Modify: `config/plugin-architecture-allowlist.json`
- Modify: `docs/guides/plugin-development.md`
- Modify: `docs/architecture/package-zielarchitektur.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`

- [ ] **Step 1: Allowlist bereinigen**

Entferne Einträge, die durch den Umbau obsolet geworden sind. Wenn der Umbau vollständig durchgezogen wurde, sollte für `plugin-waste-management` idealerweise keine aktive Import-Allowlist mehr nötig sein.

- [ ] **Step 2: Architektur- und Plugin-Doku auf den neuen Zuschnitt aktualisieren**

Dokumentiere explizit:
- Browser-Package `@sva/plugin-waste-management`
- host-owned Runtime-Package `@sva/waste-management-runtime`
- verbleibenden Guard-Status

- [ ] **Step 3: Vollständige relevante Verifikation ausführen**

Run:

```bash
pnpm check:plugin-architecture-boundary
pnpm nx run plugin-waste-management:test:unit
pnpm nx run plugin-waste-management:test:types
pnpm test:eslint
pnpm check:file-placement
```

Expected: Kein Guard-Warning mehr für `packages/plugin-waste-management`, oder nur bewusst dokumentierte Restfälle.

- [ ] **Step 4: Commit**

```bash
git add config/plugin-architecture-allowlist.json docs/guides/plugin-development.md docs/architecture/package-zielarchitektur.md docs/architecture/10-quality-requirements.md docs/architecture/11-risks-and-technical-debt.md
git commit -m "docs: document waste management plugin boundary refactor"
```

## Task 7: Entscheidung über Nachschärfung des Guards treffen

**Files:**
- Modify: optional `scripts/ci/check-plugin-architecture-boundary.ts`
- Modify: optionale Governance-Doku

- [ ] **Step 1: Guard-Output nach dem Umbau bewerten**

Prüfe, ob `packages/plugin-*` noch verbleibende Brownfield-Ausnahmen haben oder ob `plugin-waste-management` als größter Altfall jetzt bereinigt ist.

- [ ] **Step 2: Entscheidung dokumentieren**

Entscheide bewusst zwischen:
- Guard bleibt global warn-only
- Guard wird auf no-new-violations verschärft
- Guard wird nur für ausgewählte Ziele wie `@sva/core` oder `apps/**` früher verschärft

- [ ] **Step 3: Breiten Gate-Lauf vor Policy-Änderung ausführen**

Run:

```bash
pnpm check:plugin-architecture-boundary
pnpm test:eslint
pnpm nx affected --target=test:unit --base=origin/main
pnpm nx affected --target=test:types --base=origin/main
```

Expected: Keine unerwarteten neuen Guard-Regressionssignale.

## Risiken und Gegenmaßnahmen

- **Risiko:** Umbenennungen zerreißen Imports und erschweren Reviews.
  - **Gegenmaßnahme:** Umbenennungen immer als mechanische Schritte ohne Fachlogik trennen; kleine PRs.

- **Risiko:** Das neue Runtime-Package zieht wieder ungewollt Browser-Code oder React-Abhängigkeiten an.
  - **Gegenmaßnahme:** `package.json`, Runtime-Tests und `check:server-runtime` früh und separat grün halten.

- **Risiko:** Das Entfernen von `@sva/studio-module-iam` dupliziert still Hostwissen.
  - **Gegenmaßnahme:** Nur plugin-eigene Waste-Management-IAM-Metadaten lokal spiegeln; keine hostfremden Module übernehmen.

- **Risiko:** Die Teams versuchen, Warnungen durch Renames zu “gewinnen”, ohne echte Verantwortungsgrenzen zu verbessern.
  - **Gegenmaßnahme:** Jede Umbenennung im Review fachlich begründen: browserseitige React-Orchestrierung bleibt, serverseitige Host-Verantwortung wandert heraus.

- **Risiko:** Der Umbau bleibt nach halber Strecke stehen und hinterlässt zwei konkurrierende Pfade.
  - **Gegenmaßnahme:** `server.ts` nur mit kurzem Kompatibilitätsfenster parallel halten; keine langfristigen Doppel-Exporte zulassen.

## Empfohlene Reihenfolge

1. Task 1 und Task 2 zuerst, weil sie die echten Package-Kopplungen klein und risikoarm abbauen.
2. Task 3 als rein browserseitige Semantik- und Strukturphase.
3. Task 4 als expliziter Discovery- und Architektur-Checkpoint vor jeder Extraktion.
4. Task 5 als einzig wirklich architekturtragender Extraction-Schritt.
5. Task 6 und Task 7 erst danach, damit Doku und Governance den realen Endstand beschreiben.
