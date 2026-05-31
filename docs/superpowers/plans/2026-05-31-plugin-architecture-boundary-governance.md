# Plugin Architecture Boundary Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Architekturdrift bei Plugins stoppen und einen klaren Standard-/Advanced-Path für interne und externe Plugin-Autoren festlegen.

**Architecture:** Die Umsetzung erfolgt in fünf Schichten. Zuerst wird der öffentliche Zielvertrag für Plugins als zweistufiges Modell aus Standard Path und Advanced Path dokumentarisch festgezogen. Danach wird ein harter Boundary-Check eingeführt, der neue Drift auf Package-, Import- und Dateistruktur-Ebene blockiert. Bestehende Verstöße werden anschließend über eine Brownfield-Baseline kontrolliert statt stillschweigend toleriert. Abschließend werden Tag-/Ownership-Schlupflöcher geschlossen und die PR-/Review-Governance so verdrahtet, dass neue Architekturkomplexität nicht mehr unbemerkt einwachsen kann.

**Tech Stack:** Nx, pnpm, TypeScript strict mode, tsx, Vitest, OpenSpec, CI-Gates

---

## File Structure Map

### Planung und Referenzen

- Reference: `docs/architecture/package-zielarchitektur.md`
- Reference: `docs/guides/plugin-development.md`
- Reference: `docs/development/review-agent-governance.md`
- Reference: `openspec/specs/monorepo-structure/spec.md`
- Reference: `openspec/specs/plugin-platform/spec.md`

### Boundary Checks und Scripte

- Create: `scripts/ci/check-plugin-architecture-boundary.ts`
- Create: `scripts/ci/check-plugin-architecture-boundary.test.ts`
- Modify: `scripts/ci/run-pr-gate.ts`
- Modify: `scripts/ci/run-pr-gate.test.ts`
- Modify: `package.json`

### Governance- und Architektur-Dokumentation

- Modify: `docs/guides/plugin-development.md`
- Modify: `docs/architecture/package-zielarchitektur.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`
- Modify: `docs/development/review-agent-governance.md`

### OpenSpec und Brownfield-Inventar

- Create: `openspec/changes/refactor-plugin-architecture-boundary-governance/proposal.md`
- Create: `openspec/changes/refactor-plugin-architecture-boundary-governance/tasks.md`
- Create: `openspec/changes/refactor-plugin-architecture-boundary-governance/design.md`
- Create: `openspec/changes/refactor-plugin-architecture-boundary-governance/specs/monorepo-structure/spec.md`
- Create: `openspec/changes/refactor-plugin-architecture-boundary-governance/specs/plugin-platform/spec.md`
- Create: `docs/reports/plugin-architecture-boundary-baseline.md`

## Task 1: Zielvertrag Standard Path vs Advanced Path festschreiben

**Files:**
- Modify: `docs/guides/plugin-development.md`
- Modify: `docs/architecture/package-zielarchitektur.md`
- Create: `openspec/changes/refactor-plugin-architecture-boundary-governance/proposal.md`
- Create: `openspec/changes/refactor-plugin-architecture-boundary-governance/tasks.md`
- Create: `openspec/changes/refactor-plugin-architecture-boundary-governance/design.md`
- Create: `openspec/changes/refactor-plugin-architecture-boundary-governance/specs/monorepo-structure/spec.md`
- Create: `openspec/changes/refactor-plugin-architecture-boundary-governance/specs/plugin-platform/spec.md`

- [ ] **Step 1: OpenSpec-Change für die Governance-Schärfung anlegen**

Lege den Change mit dem festen `change-id` an:

```text
openspec/changes/refactor-plugin-architecture-boundary-governance/
```

Run:

```bash
mkdir -p \
  openspec/changes/refactor-plugin-architecture-boundary-governance/specs/monorepo-structure \
  openspec/changes/refactor-plugin-architecture-boundary-governance/specs/plugin-platform
```

Expected: Die Verzeichnisse für Proposal, Tasks, Design und beide Delta-Specs sind angelegt.

Der Change soll verbindlich diese Punkte abdecken:

```md
- Standard Path für typische Plugin-Use-Cases
- Advanced Path für explizit freigegebene Sonderfälle
- Neudrift-Blocker mit Brownfield-Baseline
- blockierende Governance für neue Ausnahmen
```

- [ ] **Step 2: Standard Path in der Doku ausdrücklich definieren**

Beschreibe den Happy Path so, dass externe und interne Plugin-Autoren dieselbe klare Leitplanke bekommen. Die normative Definition lautet:

```md
- Workspace-Dependencies: `@sva/plugin-sdk`
- bei React-Custom-Views zusätzlich `@sva/studio-ui-react`
- Peer Dependencies bleiben `react`, `react-dom`, `@tanstack/react-router`
- genau ein führendes `PluginDefinition`-Objekt aus `src/index.ts`
- keine Workspace-Dependencies auf `@sva/core`, `@sva/auth-runtime`, `@sva/server-runtime`, `@sva/routing`,
  `@sva/iam-*`, `@sva/instance-registry`, `@sva/data*`, `@sva/sva-mainserver`, `@sva/studio-module-iam`,
  `@sva/monitoring-client` oder App-Pfade
```

- [ ] **Step 3: Advanced Path als bewussten Escape Hatch formulieren**

Der Advanced Path muss ausdrücklich erlauben, dass Plugins eigene Implementierungen mitbringen dürfen, aber nur unter diesen Regeln:

```md
- nur über explizite öffentliche Host-Verträge, nie über interne Host-Packages
- Browser-UI darf weiter frei fachlich implementiert werden, solange nur `@sva/studio-ui-react` als gemeinsame Basis genutzt wird
- pluginseitige Server-, Job- und Integrationsbeiträge laufen nur in host-owned Execution-Contexts
- jede neue Advanced-Path-Fähigkeit braucht einen eigenen OpenSpec-Change oder eine explizite Erweiterung dieses Changes
- Advanced-Path-Nutzung wird im Boundary-Baseline-Report als bewusste Ausnahme dokumentiert
```

- [ ] **Step 4: Interne Plugins normativ wie externe Plugins behandeln**

Verankere in Guide, Architektur und Delta-Specs denselben Maßstab für interne und externe Plugins:

```md
- interne Plugins sind keine stillschweigenden Sonderfälle
- was extern kein sauberer Pfad wäre, gilt intern ebenfalls als Architekturdrift
- der Boundary-Check bewertet `packages/plugin-*` unabhängig von Repository-Nähe
```

- [ ] **Step 5: OpenSpec-Change validieren**

Run:

```bash
openspec validate refactor-plugin-architecture-boundary-governance --strict
```

Expected: Validation succeeds without missing scenarios or malformed delta files.

## Task 2: Harten Plugin-Architecture-Boundary-Check spezifizieren

**Files:**
- Create: `scripts/ci/check-plugin-architecture-boundary.ts`
- Create: `scripts/ci/check-plugin-architecture-boundary.test.ts`
- Modify: `package.json`
- Modify: `scripts/ci/run-pr-gate.ts`
- Modify: `scripts/ci/run-pr-gate.test.ts`

- [ ] **Step 1: Prüfumfang des neuen Checks festlegen**

Der neue Check soll als `tsx`-Script mit diesen öffentlichen Helfern implementiert werden:

```ts
export type PluginArchitectureViolationRule =
  | 'workspace-dependency'
  | 'workspace-import'
  | 'forbidden-path-signal'
  | 'review-required-path-signal';

export type PluginArchitectureViolation = {
  packageName: string;
  relativePath: string;
  rule: PluginArchitectureViolationRule;
  subject: string;
  message: string;
};

export type PluginArchitectureBaselineEntry = {
  packageName: string;
  rule: PluginArchitectureViolationRule;
  subject: string;
  owner: string;
  justification: string;
  removalChange: string;
};

export declare const parsePluginArchitectureBaseline: (
  markdown: string
)=> readonly PluginArchitectureBaselineEntry[];

export declare const collectPluginArchitectureViolations: (
  projectRoot?: string
)=> Promise<readonly PluginArchitectureViolation[]>;

export declare const diffViolationsAgainstBaseline: (
  violations: readonly PluginArchitectureViolation[],
  baseline: readonly PluginArchitectureBaselineEntry[]
)=> readonly PluginArchitectureViolation[];
```

Der Check soll für `@sva/plugin-*` mindestens diese Ebenen auswerten:

```md
- Workspace-Dependencies in `package.json`
- Source-Imports in `src/**`
- verdächtige Dateinamen und Verzeichnisnamen
- Nutzung nicht freigegebener Host-Packages trotz günstiger Nx-Tags oder gemischter Package-Rollen
```

- [ ] **Step 2: Erlaubte Standard-Path-Abhängigkeiten als Default codieren**

Die Standardregel für Plugin-Packages lautet:

```ts
const ALLOWED_WORKSPACE_DEPENDENCIES = [
  '@sva/plugin-sdk',
  '@sva/studio-ui-react',
];

const FORBIDDEN_HOST_WORKSPACE_PACKAGES = [
  '@sva/core',
  '@sva/auth-runtime',
  '@sva/server-runtime',
  '@sva/routing',
  '@sva/iam-core',
  '@sva/iam-admin',
  '@sva/iam-governance',
  '@sva/instance-registry',
  '@sva/data',
  '@sva/data-client',
  '@sva/data-repositories',
  '@sva/sva-mainserver',
  '@sva/studio-module-iam',
  '@sva/monitoring-client',
  '@sva/media',
];
```

Jede weitere Workspace-Dependency ist standardmäßig ein Verstoß, solange sie nicht über einen expliziten Advanced-Path-Mechanismus freigegeben ist.

- [ ] **Step 3: Verbotene und review-pflichtige Struktur-Signale unterscheiden**

Der Check soll mindestens diese zwei Klassen unterstützen:

```ts
const FORBIDDEN_PATH_SIGNALS = [
  'route-binding',
  'plugin-catalog',
  'catalog-loader',
  'plugin-build-registry',
  'mainserver-',
  'admin-resource-',
];

const REVIEW_REQUIRED_PATH_SIGNALS = [
  'server.ts',
  'plugin-operations.ts',
  '.controller.',
  '.loaders.',
  '.state.',
  '.submissions.',
];
```

Ziel:

```md
- klar host-owned Muster in Plugins sofort blockieren
- fortgeschrittene Muster nur dann tolerieren, wenn sie als exakte Baseline-Ausnahme dokumentiert sind
```

- [ ] **Step 4: Vitest-Script-Tests mit Fixtures ergänzen**

Die Tests sollen keine committed Fixture-Verzeichnisse benötigen. Nutze stattdessen Temp-Workspaces unter `os.tmpdir()` nach dem Muster aus `scripts/ci/run-workspace-node.test.ts`.

Die Tests müssen mindestens folgende Fälle abdecken:

```md
- Plugin mit nur `@sva/plugin-sdk` und `@sva/studio-ui-react` ist grün
- Plugin mit zusätzlicher Workspace-Dependency ist rot
- Plugin mit verbotenem Host-Import ist rot
- Plugin mit verbotenem Dateinamen ist rot
- Plugin mit review-pflichtigem Muster ohne Freigabe ist rot
- Plugin mit erlaubter Baseline-Ausnahme bleibt grün
- Plugin mit `@sva/studio-module-iam` bleibt nur dann grün, wenn die Ausnahme exakt aus der Baseline kommt
```

- [ ] **Step 5: Check in Package Scripts und PR-Gate verdrahten**

Ergänze den neuen Script-Einstieg und binde ihn in die bestehenden Gates ein:

```md
- neues `pnpm check:plugin-architecture-boundary`
- `test:eslint`: `pnpm check:plugin-ui-boundary && pnpm check:plugin-architecture-boundary && env -u NO_COLOR nx run-many -t lint`
- `test:eslint:affected`: `pnpm check:plugin-ui-boundary && pnpm check:plugin-architecture-boundary && env -u NO_COLOR nx affected --target=lint --base=${NX_BASE:-origin/main}`
- `test:ci` führt `pnpm check:plugin-architecture-boundary` direkt nach `pnpm check:plugin-ui-boundary` aus
- `scripts/ci/run-pr-gate.ts` bekommt einen neuen Duration-Eintrag `plugin-architecture-boundary`
```

- [ ] **Step 6: Script-Tests und Script-Typecheck ausführen**

Run:

```bash
pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts
pnpm exec vitest run scripts/ci/run-pr-gate.test.ts
pnpm exec tsc -p tsconfig.scripts.json --noEmit
```

Expected: All tests pass and the scripts typecheck stays green.

## Task 3: Brownfield-Baseline und Ausnahmeprozess definieren

**Files:**
- Create: `docs/reports/plugin-architecture-boundary-baseline.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`
- Modify: `docs/development/review-agent-governance.md`
- Modify: `scripts/ci/check-plugin-architecture-boundary.ts`
- Modify: `scripts/ci/check-plugin-architecture-boundary.test.ts`

- [ ] **Step 1: Bestehende Verstöße einmalig inventarisieren**

Die Baseline-Datei soll bestehende Altlasten sichtbar machen, statt sie zu verstecken. Die Datei erhält einen maschinenlesbaren JSON-Block unter der Überschrift `## Machine Readable Baseline`, zum Beispiel:

````md
## Machine Readable Baseline

```json
[
  {
    "packageName": "@sva/plugin-waste-management",
    "rule": "workspace-dependency",
    "subject": "@sva/studio-module-iam",
    "owner": "@sva-studio/core-maintainers",
    "justification": "waste-management konsumiert noch die host-owned studioModuleIamRegistry direkt",
    "removalChange": "refactor-studio-module-iam-public-contract"
  }
]
```
````

Für jeden Eintrag festhalten:

```md
- Package oder Pfad
- Art des Verstoßes
- Owner
- Begründung
- Abbauziel oder Folge-Change
```

- [ ] **Step 2: Neudrift gegen die Baseline vergleichen**

Der Check soll nicht nur absolute Regeln prüfen, sondern zusätzlich unterscheiden zwischen:

```md
- bereits bekanntem Altverstoß mit exakt gleichem `packageName`, `rule` und `subject`
- neu eingeführtem oder vergrößertem Verstoß
```

Nur der Altbestand aus der Baseline bleibt vorübergehend toleriert. Jede neue Abweichung muss blockierend fehlschlagen.

- [ ] **Step 3: Ausnahmeformat maschinenlesbar halten**

Verwende ausschließlich den JSON-Codeblock als Quellformat für den Script-Parser. Freitext ober- oder unterhalb des Blocks ist für Menschen, aber nicht Teil des Maschinenvertrags. Wichtig ist:

```md
- stabile Identifikatoren
- keine freien Mehrdeutigkeiten im Parser-Pfad
- jede Ausnahme beschreibt genau einen Verstoß
- der Parser bricht mit Fehler ab, wenn kein JSON-Block gefunden wird oder er ungültig ist
```

- [ ] **Step 4: Review-Governance für Baseline-Änderungen verschärfen**

Dokumentiere, dass jede Baseline-Erweiterung:

```md
- Architekturreview braucht
- eine technische Begründung braucht
- ein Abbauziel braucht
- nicht zusammen mit fachlichen Nebenänderungen versteckt werden darf
- im PR-Diff als eigener Abschnitt oder eigener Commit erkennbar bleiben soll
```

- [ ] **Step 5: Regressionsfall gegen die Baseline testen**

Run:

```bash
pnpm check:plugin-architecture-boundary
```

Expected: Der Check bleibt nur dann grün, wenn die bekannten Altverstöße exakt in `docs/reports/plugin-architecture-boundary-baseline.md` beschrieben sind.

## Task 4: Tag-/Ownership-Schlupflöcher schließen

**Files:**
- Modify: `docs/architecture/package-zielarchitektur.md`
- Modify: `docs/guides/plugin-development.md`
- Modify: `docs/reports/plugin-architecture-boundary-baseline.md`
- Create: `openspec/changes/refactor-studio-module-iam-public-contract/proposal.md`
- Create: `openspec/changes/refactor-studio-module-iam-public-contract/tasks.md`

- [ ] **Step 1: Mehrfachrollen im Projektgraphen identifizieren**

Prüfe gezielt Packages, die mehrere Rollen gleichzeitig signalisieren. Der erste bekannte Fall ist:

```md
- `packages/studio-module-iam/project.json` mit `scope:core` plus `scope:plugin-sdk`
```

- [ ] **Step 2: Für den Governance-Change keine Retagging-Breaks auslösen**

Dieser Governance-Change retaggt `studio-module-iam` noch nicht direkt, weil das den bestehenden Workspace abrupt rot machen würde. Stattdessen gilt:

```md
- `@sva/studio-module-iam` wird im neuen Boundary-Check explizit als nicht öffentlicher Host-Vertrag behandelt
- die heutige Nutzung bleibt ausschließlich über die Brownfield-Baseline toleriert
- die eigentliche Extraktion läuft als Folge-Change `refactor-studio-module-iam-public-contract`
```

- [ ] **Step 3: Nx- und ESLint-Regeln gegen Tag-Schlupflöcher schärfen**

Die Governance-Doku und der neue Script-Check dürfen nicht nur auf günstige Tags vertrauen, wenn ein Package semantisch keine Plugin-Boundary ist. Ergänze deshalb:

```md
- explizite Verbotslisten für nicht öffentliche Host-Packages im neuen Script
- klare Formulierung in Architektur- und Plugin-Guide, dass Package-Namen und öffentliche Vertragsrolle Vorrang vor Nx-Tags haben
```

- [ ] **Step 4: Plugin-seitige Consumption auf öffentliche Contracts zurückführen**

Der Folge-Change `refactor-studio-module-iam-public-contract` soll genau zwei Optionen prüfen und eine davon festziehen:

```md
- Vertrag nach `@sva/plugin-sdk` oder einen neuen öffentlichen Host-Contract verschieben
- oder Plugin-Zugriff verbieten und Implementierung host-owned machen
```

Der aktuelle Governance-Plan setzt nur die Schutzplanke, nicht die vollständige Extraktion um.

## Task 5: Review- und CI-Governance blockierend machen

**Files:**
- Modify: `docs/development/review-agent-governance.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Modify: `package.json`
- Modify: `scripts/ci/run-pr-gate.ts`
- Modify: `scripts/ci/run-pr-gate.test.ts`

- [ ] **Step 1: Trigger für Architekturreview explizit ergänzen**

Die Review-Governance soll neue Pflichtfälle benennen:

```md
- neues Plugin-Package
- neue Plugin-Capability außerhalb des Standard Path
- jede Baseline-Änderung
- jede neue öffentliche Host-Contract-Freigabe für Plugins
- jeder neue Boundary-Check-Disable oder jede neue dokumentierte Übergangsausnahme
```

- [ ] **Step 2: „Vorerst in der App“ nur noch mit Sunset zulassen**

Dokumentiere eine harte Regel:

```md
- kein temporärer Architekturpfad ohne Referenz auf Folge-Change oder Abbauziel
- keine unbefristeten Übergangsformulierungen in Designs oder Plänen
```

- [ ] **Step 3: PR-Gates auf konsistente Fehlermeldungen trimmen**

Der neue Check muss in CI so scheitern, dass die Ursache sofort klar ist. Das Fehlerschema ist:

```md
- welches Plugin betroffen ist
- ob es um Dependency, Import, Dateiname oder Tag-Schlupfloch geht
- ob der Verstoß neu ist oder aus der Baseline stammt
- welche `subject`-Kante oder welches Dateisignal exakt betroffen ist
```

- [ ] **Step 4: Dokumentierte Qualitätsanforderung aktualisieren**

In den Qualitätsanforderungen festhalten:

```md
- `pnpm check:plugin-architecture-boundary` ist blockierend
- `pnpm check:plugin-ui-boundary` bleibt ergänzender UI-Check
- Architekturkonformität ist kein reines Review-Thema mehr, sondern CI-Gate
```

- [ ] **Step 5: End-to-End-Gate-Lauf für den Governance-Change prüfen**

Run:

```bash
pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts scripts/ci/run-pr-gate.test.ts
pnpm test:eslint
pnpm exec tsc -p tsconfig.scripts.json --noEmit
```

Expected: Der neue Check ist in den Lint-/PR-Pfad integriert, Script-Tests bleiben grün und der Script-Typecheck bleibt stabil.

## Test Plan

- `pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts`
- `pnpm exec vitest run scripts/ci/run-pr-gate.test.ts`
- `pnpm check:plugin-architecture-boundary`
- `pnpm test:eslint`
- `pnpm exec tsc -p tsconfig.scripts.json --noEmit`
- Negativfall lokal verifizieren: künstliche zusätzliche Workspace-Dependency in einem Fixture-Plugin führt zu blockierendem Fehler
- Negativfall lokal verifizieren: künstlicher `@sva/studio-module-iam`-Import in einem Temp-Plugin führt zu blockierendem Fehler
- Negativfall lokal verifizieren: verbotenes Struktur-Signal in einem Temp-Plugin führt zu blockierendem Fehler
- Regressionsfall verifizieren: bekannter Baseline-Eintrag bleibt nur solange grün, wie `packageName`, `rule` und `subject` exakt übereinstimmen
- Optional vor Merge: `pnpm test:pr`

## Assumptions

- Der aktive Governance-Plan gehört in `docs/superpowers/plans/`, nicht nach `archived-plans/`.
- Der Standard Path ist der führende öffentliche Entwicklungsweg für externe Plugin-Autoren.
- Der Advanced Path bleibt möglich, ist aber explizit freigabepflichtig und kein stiller Zufallspfad.
- Neudrift wird sofort blockiert; der Bestand wird kontrolliert abgebaut statt per Big Bang bereinigt.
- Dieser Plan führt den Governance-Gate ein, aber nicht die vollständige Bereinigung aller bestehenden Boundary-Verstöße.
