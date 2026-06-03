# Quality Gates Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Quality Gates sollen echte blinde Flecken schliessen, ohne den Standard-PR spuerbar zu verlangsamen oder bestehende Checks unnoetig doppelt laufen zu lassen.

**Architecture:** Die Umsetzung folgt einem "reuse before add"-Prinzip. Bestehende Gates werden zuerst ueber bessere Scope-Klassifikation, praezisere Inputs und ehrliche Signalnamen geschaerft; neue blockierende Jobs kommen nur hinzu, wenn sie schnell sind und keine vorhandenen Gates duplizieren. Schwere oder infra-nahe Gates bleiben pfadbasiert, release-nah oder werden erst nach einer Laufzeit-Benchmark aktiviert.

**Tech Stack:** Nx, pnpm, TypeScript strict mode, tsx, Vitest, GitHub Actions, dorny/paths-filter

---

## File Structure Map

### Referenzen und bestehende Gate-Einstiegspunkte

- Reference: `package.json`
- Reference: `.github/workflows/quality-gates.yml`
- Reference: `.github/workflows/runtime-gates.yml`
- Reference: `.github/workflows/main-build.yml`
- Reference: `.github/workflows/app-e2e.yml`
- Reference: `.github/workflows/repository-hygiene.yml`
- Reference: `docs/development/testing-coverage.md`
- Reference: `docs/architecture/10-quality-requirements.md`

### PR-Scope und Gate-Orchestrierung

- Modify: `scripts/ci/pr-scope.ts`
- Modify: `scripts/ci/pr-scope.test.ts`
- Optional Modify: `scripts/ci/run-pr-gate.ts`
- Optional Modify: `scripts/ci/run-pr-gate.test.ts`

### Bestehende App-/Frontend-Gates

- Modify: `apps/sva-studio-react/project.json`
- Modify: `scripts/ci/check-i18n-keys.ts`
- Create: `scripts/ci/check-i18n-keys.test.ts`
- Modify: `.github/workflows/main-build.yml`
- Modify: `.github/workflows/app-e2e.yml`
- Modify: `.github/workflows/quality-gates.yml`

### Integrationssignal und Hygienegates

- Modify: `package.json`
- Modify: `.github/workflows/runtime-gates.yml`
- Modify: `docs/development/testing-coverage.md`
- Optional Create: `scripts/ci/check-db-schema-snapshot.ts`
- Optional Create: `scripts/ci/check-db-schema-snapshot.test.ts`
- Optional Modify: `.github/workflows/repository-hygiene.yml`

## Anti-Duplication Contract

Diese Regeln sind waehrend der Umsetzung verbindlich:

- Vor einem neuen Gate zuerst pruefen, ob ein bestehender Gate-Pfad nur einen Scope- oder Input-Fehler hat.
- `check:i18n` bleibt ein bestehender Build-Vorcheck und wird nicht als zweiter blockierender PR-Job daneben noch einmal ausgefuehrt.
- Neue blockierende PR-Jobs muessen entweder `skip`, `affected` oder einen klaren pfadbasierten No-op-Pfad haben.
- Kein Task darf denselben Testtyp fuer denselben Scope doppelt erzwingen, nur weil zwei Workflows ihn bequem aufrufen koennen.
- `E2E`, `A11y`, `Build`, `Integration` und `Coverage` gelten als unterschiedliche Signale; doppelt ist nur derselbe Signaltyp mit demselben Scope.
- Teure Checks (>2-3 Minuten im Median) duerfen nur fuer klar relevante PRs, auf `main`/nightly oder im Release-Pfad blockieren.

## Task 1: PR-Scope fuer Plugin-UI und Studio-UI ehrlicher machen

**Files:**
- Modify: `scripts/ci/pr-scope.ts`
- Modify: `scripts/ci/pr-scope.test.ts`
- Optional Modify: `scripts/ci/run-pr-gate.ts`
- Optional Modify: `scripts/ci/run-pr-gate.test.ts`

- [x] **Step 1: Fehlende Scope-Faelle als Tests zuerst festziehen**

Erweitere `scripts/ci/pr-scope.test.ts` um mindestens diese Faelle:

```ts
it('classifies plugin waste-management tsx changes as app-build and e2e relevant', () => {
  const decision = classifyPrScope([
    'packages/plugin-waste-management/src/waste-management.page.tsx',
  ]);

  expect(decision.appBuildMode).toBe('affected');
  expect(decision.e2eMode).toBe('affected');
});

it('classifies plugin translation and page wiring changes as app-build relevant', () => {
  const decision = classifyPrScope([
    'packages/plugin-news/src/plugin.translations.ts',
  ]);

  expect(decision.appBuildMode).toBe('affected');
});

it('keeps docs-only pull requests as full no-op', () => {
  const decision = classifyPrScope([
    'docs/development/testing-coverage.md',
  ]);

  expect(decision.codeRelevant).toBe(false);
  expect(decision.appBuildMode).toBe('skip');
  expect(decision.e2eMode).toBe('skip');
});
```

- [x] **Step 2: Die relevanten Muster in `pr-scope.ts` minimal erweitern**

Erweitere die relevanten Mengen, ohne daraus einen pauschalen Full-Run zu machen:

```ts
const pluginUiPatterns = [
  /^packages\/plugin-news\/src\/.*\.(?:ts|tsx)$/u,
  /^packages\/plugin-events\/src\/.*\.(?:ts|tsx)$/u,
  /^packages\/plugin-poi\/src\/.*\.(?:ts|tsx)$/u,
  /^packages\/plugin-waste-management\/src\/.*\.(?:ts|tsx)$/u,
];
```

Verwende diese Muster fuer:

```ts
const e2eRelevantPatterns = [
  /^apps\/sva-studio-react\//u,
  /^packages\/studio-ui-react\//u,
  ...pluginUiPatterns,
];

const appBuildRelevantPatterns = [
  /^apps\/sva-studio-react\//u,
  /^packages\/routing\//u,
  /^packages\/studio-ui-react\//u,
  ...pluginUiPatterns,
];
```

Wichtig: Plugin-UI-Aenderungen sollen `affected` triggern, nicht automatisch `full`.

- [x] **Step 3: Den schmalen Scope-Testlauf ausfuehren**

Run:

```bash
pnpm exec vitest run scripts/ci/pr-scope.test.ts --reporter=verbose
```

Expected: FAIL vor der Implementierung, PASS nach der Implementierung.

- [x] **Step 4: Falls noetig `run-pr-gate`-Tests anpassen, aber keine neue Gate-Art einfuehren**

Nicht erforderlich in diesem Slice: `scripts/ci/run-pr-gate.test.ts` blieb unveraendert, weil weder Snapshot- noch JSON-Erwartungen gebrochen sind. Der Gate-Typ selbst bleibt unveraendert; nur die Scope-Entscheidungen wurden ehrlicher.

- [x] **Step 5: Keine Workflow-Verdopplung einfuehren**

Bestandsregel fuer diesen Task:

```text
Scope-Fix ja.
Neuer Build-Workflow nein.
Neuer E2E-Workflow nein.
```

Der Mehrwert kommt aus korrekter Triggerung der vorhandenen Jobs in `main-build.yml` und `app-e2e.yml`, nicht aus neuen Jobs.

- [x] **Step 6: Den lokalen PR-Gate-Pfad einmal gegen das neue Scope-Verhalten verifizieren**

Run:

```bash
pnpm exec tsx scripts/ci/pr-scope.cli.ts --base origin/main --json
```

Expected: Der CLI-Pfad bleibt funktionsfaehig. Die neue Plugin-UI-Klassifikation ist ueber die roten und danach gruenen `pr-scope`-Tests abgesichert; der reine CLI-Lauf gegen `origin/main...HEAD` zeigt im uncommitteten Arbeitsstand weiterhin `changedFiles: []`.

## Task 2: Vorhandene i18n-Checks wiederverwenden statt einen zweiten i18n-Gate-Job zu bauen

**Files:**
- Modify: `scripts/ci/check-i18n-keys.ts`
- Create: `scripts/ci/check-i18n-keys.test.ts`
- Modify: `apps/sva-studio-react/project.json`
- Modify: `docs/development/testing-coverage.md`

- [x] **Step 1: Die i18n-Scanlogik in testbare Helper schneiden**

Extrahiere aus `scripts/ci/check-i18n-keys.ts` kleine pure Helfer fuer:

```ts
export const SOURCE_ROOTS = [
  'apps/sva-studio-react/src',
  'packages/plugin-news/src',
  'packages/plugin-events/src',
  'packages/plugin-poi/src',
  'packages/plugin-waste-management/src',
] as const;
```

und fuer die Available-Key-Bildung:

```ts
export const collectAvailableKeys = (): Set<string> => {
  // app keys + plugin translation resources
};
```

- [x] **Step 2: Erst die fehlenden Tests fuer die neuen Source-Roots schreiben**

Lege `scripts/ci/check-i18n-keys.test.ts` mit mindestens diesen Erwartungen an:

```ts
it('scans app and plugin ui source roots', () => {
  expect(SOURCE_ROOTS).toContain('apps/sva-studio-react/src');
  expect(SOURCE_ROOTS).toContain('packages/plugin-waste-management/src');
});

it('includes plugin translation keys in the available key set', () => {
  const keys = collectAvailableKeys();
  expect(keys.has('news.navigation.title')).toBe(true);
});
```

- [x] **Step 3: Den Scan auf Plugin-UI erweitern, aber keinen separaten CI-Job einfuehren**

Passe den Scanner so an, dass er dieselbe vorhandene Enforcement-Stelle weiter benutzt:

```text
Build -> dependsOn check:i18n -> check-i18n-keys.ts scannt App + Plugin-UI
```

Es wird bewusst **kein** neuer blockierender PR-Job `i18n` angelegt, weil das denselben Signaltyp doppelt ausfuehren wuerde. Der Scanner wertet jetzt Plugin-UI-Source-Roots mit Namespace-Kontext aus, erkennt sowohl `t(...)` als auch `pt(...)`, ignoriert dynamische Template-Keys und schliesst Testdateien aus.

- [x] **Step 4: Die Nx-Inputs des Targets `check:i18n` cache-korrekt erweitern**

Ergaenze in `apps/sva-studio-react/project.json` die Inputs von `check:i18n`, damit Plugin-Aenderungen den Cache invalidieren:

```json
"inputs": [
  "default",
  "{workspaceRoot}/scripts/ci/check-i18n-keys.ts",
  "{workspaceRoot}/packages/plugin-news/src/**",
  "{workspaceRoot}/packages/plugin-events/src/**",
  "{workspaceRoot}/packages/plugin-poi/src/**",
  "{workspaceRoot}/packages/plugin-waste-management/src/**"
]
```

- [x] **Step 5: Nur den schmalen i18n-Pfad verifizieren**

Run:

```bash
pnpm exec vitest run scripts/ci/check-i18n-keys.test.ts --reporter=verbose
pnpm nx run sva-studio-react:check:i18n
```

Expected: PASS. Es wird kein zweiter Build-Lauf und kein zweiter i18n-Workflow-Test benoetigt. Beim ersten Real-Run wurde zusaetzlich echte Key-Drift im Plugin `plugin-waste-management` sichtbar; diese wurde im selben Block bereinigt, bis `sva-studio-react:check:i18n` wieder gruen war.

- [x] **Step 6: Die Doku auf den deduplizierten Gate-Pfad nachziehen**

Dokumentiere in `docs/development/testing-coverage.md`, dass i18n fuer App und Plugin-UI ueber den vorhandenen Build-Vorcheck erzwungen wird und deshalb kein eigener paralleler PR-Job existiert.

## Task 3: Ein selektives A11y-Gate einfuehren, das nur bei UI-relevanten PRs blockiert

**Files:**
- Modify: `scripts/ci/pr-scope.ts`
- Modify: `scripts/ci/pr-scope.test.ts`
- Modify: `.github/workflows/quality-gates.yml`
- Modify: `docs/development/testing-coverage.md`
- Modify: `docs/architecture/10-quality-requirements.md`

- [x] **Step 1: Eine eigene `a11yMode`-Entscheidung zuerst im Scope-Modell einfuehren**

Erweitere das Interface:

```ts
export interface PrScopeDecision {
  changedFiles: string[];
  codeRelevant: boolean;
  qualityGateMode: GateMode;
  coverageMode: GateMode;
  integrationMode: GateMode;
  e2eMode: GateMode;
  a11yMode: GateMode;
  appBuildMode: GateMode;
  escalationReasons: string[];
}
```

Die `a11yRelevantPatterns` sollen mindestens App-UI, `studio-ui-react` und Plugin-UI umfassen:

```ts
const a11yRelevantPatterns = [
  /^apps\/sva-studio-react\/src\/(?:components|routes|providers)\//u,
  /^packages\/studio-ui-react\/src\/.*\.(?:ts|tsx)$/u,
  /^packages\/plugin-(?:news|events|poi|waste-management)\/src\/.*\.tsx$/u,
];
```

- [x] **Step 2: Die Scope-Tests um Skip- und Relevant-Faelle erweitern**

Ergaenze `scripts/ci/pr-scope.test.ts` um:

```ts
it('runs a11y for plugin ui changes', () => {
  const decision = classifyPrScope([
    'packages/plugin-news/src/news.detail-page.tsx',
  ]);

  expect(decision.a11yMode).toBe('affected');
});

it('skips a11y for non-ui backend changes', () => {
  const decision = classifyPrScope([
    'packages/auth-runtime/src/db.ts',
  ]);

  expect(decision.a11yMode).toBe('skip');
});
```

- [x] **Step 3: Einen einzelnen schnellen Job in `quality-gates.yml` ergaenzen**

Fuege genau **einen** neuen Job hinzu, nicht mehrere:

```yaml
a11y:
  name: A11y
  runs-on: ubuntu-latest
```

Der Job soll:

```text
- immer auf PR/main starten
- bei irrelevanten PRs bewusst erfolgreich no-op beenden
- bei relevanten PRs genau `pnpm test:a11y` ausfuehren
- keinen Build, keinen E2E-Run und keinen zweiten i18n-Check ausloesen
```

- [x] **Step 4: Nur den engen Testpfad ausfuehren**

Run:

```bash
pnpm exec vitest run scripts/ci/pr-scope.test.ts --reporter=verbose
pnpm test:a11y
```

Expected: PASS. Kein zusaetzlicher `pnpm nx run sva-studio-react:build` in diesem Task, weil das A11y-Gate ein eigener Signaltyp ist.

- [x] **Step 5: Die Branch-Protection-Doku aktualisieren**

Ergaenze in `docs/development/testing-coverage.md` und `docs/architecture/10-quality-requirements.md`, dass `A11y` ein selektiver PR-Gate ist und nur fuer UI-relevante Aenderungen blockiert.

## Task 4: Das Integrationssignal ehrlich machen statt Platzhalter weiter gruen zu melden

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/runtime-gates.yml`
- Modify: `docs/development/testing-coverage.md`

- [x] **Step 1: Alle aktuell blockierenden `test:integration`-Kandidaten auf Platzhalter pruefen**

Nutze diese Schnellsuche:

```bash
rg -n "no integration tests configured" apps packages tooling/**/project.json
```

Expected: Liste der Platzhalter-Targets, die heute zwar gruen werden, aber keine echte Integrationsabsicherung liefern.

- [x] **Step 2: Den Root-Integrationspfad auf echte Targets begrenzen**

Passe `package.json` so an, dass `pnpm test:integration` nur echte Integrations-Targets ausfuehrt. Verwende eine explizite Projektliste oder ein `--exclude`, aber keine stillschweigende Mitnahme der bekannten Platzhalter.

Beispielrichtung:

```bash
env -u NO_COLOR nx run-many -t test:integration --projects=core,data,media,monitoring-client,studio-module-iam,tooling-testing
```

Die finale Liste muss vor dem Merge einmal gegen den Workspace verifiziert werden.

- [x] **Step 3: Die Runtime-Gates auf dieselbe ehrliche Definition ziehen**

`runtime-gates.yml` darf fuer `main` und PR nicht weiter suggerieren, dass Platzhalter-Integrationsziele echte Integrationsabsicherung darstellen. Der CI-Pfad muss dieselbe explizite Projektmenge oder dieselben Exclusions wie das Root-Script verwenden.

- [x] **Step 4: Nur den engeren Gate-Pfad verifizieren**

Run:

```bash
pnpm test:integration
```

Expected: Es laufen nur echte Integrationsziele. Keine weitere Testverdopplung durch zusaetzliche manuelle Paketlaeufe, ausser zur Fehlersuche.

- [x] **Step 5: Die Doku auf Signal-Ehrlichkeit nachziehen**

Dokumentiere in `docs/development/testing-coverage.md`, dass `Integration` nur fuer echte infra-abhaengige Tests steht und Platzhalter nicht laenger als blockierendes Integrationssignal gelten.

## Task 5: Einen CI-tauglichen DB-Snapshot-Gate vorbereiten, aber erst nach Laufzeit-Benchmark aktivieren

**Files:**
- Optional Create: `scripts/ci/check-db-schema-snapshot.ts`
- Optional Create: `scripts/ci/check-db-schema-snapshot.test.ts`
- Optional Modify: `scripts/ops/runtime-env.ts`
- Optional Modify: `.github/workflows/repository-hygiene.yml`
- Optional Modify: `package.json`

- [x] **Step 1: Die vorhandene Snapshot-Logik messen, nicht sofort blockierend einschalten**

Run:

```bash
time pnpm env:verify:db-schema-snapshot
```

Expected: Dokumentierte lokale Laufzeitbasis. Dieser Schritt ist ein Benchmark, kein sofortiger Gate-Einbau.

Ergebnis: `pnpm env:verify:db-schema-snapshot` lag lokal bei ca. `10.82s`, war aber an den runtime-nahen `local-keycloak`-Pfad gekoppelt und zeigte Drift gegen den migrationsbasierten Soll-Stand.

- [x] **Step 2: Nur bei Bedarf eine leichte CI-Fassung extrahieren**

Falls der bestehende Runtime-Pfad zu schwer oder zu infra-abhaengig ist, extrahiere einen dedizierten CI-Check:

```ts
// scripts/ci/check-db-schema-snapshot.ts
// compare actual migration-derived schema dump vs docs/development/studio-db-schema-final.sql
```

Der neue Check darf kein allgemeiner Remote-/Runtime-Doctor werden; er soll nur Snapshot-Governance pruefen.

- [x] **Step 3: Erst nach Benchmark einen pfadbasierten No-op-Job in `repository-hygiene.yml` aktivieren**

Trigger-Pfade:

```text
packages/data/migrations/**
docs/development/studio-db-schema-final.sql
docs/development/studio-db-schema.md
scripts/ci/check-db-schema-snapshot.ts
```

Der Job soll fuer irrelevante PRs erfolgreich no-op enden und fuer relevante PRs genau den Snapshot-Check ausfuehren.

- [x] **Step 4: Aktivierungskriterium dokumentieren**

Der Job wird nur blockierend, wenn die gemessene PR-Mehrlast akzeptabel ist. Richtwert:

```text
median <= 2 min fuer den relevanten PR-Pfad
```

Ergebnis: Der dedizierte CI-Check lag lokal gegen einen sauberen Migrationsstand bei ca. `18.07s` und bleibt damit klar unter dem Aktivierungskriterium.

## Task 6: Runtime-Artifact-Verify nur fuer kritische Pfade nachschaerfen

**Files:**
- Modify: `scripts/ci/pr-scope.ts`
- Modify: `scripts/ci/pr-scope.test.ts`
- Optional Modify: `package.json`
- Optional Modify: `.github/workflows/main-build.yml`
- Optional Modify: `docs/architecture/10-quality-requirements.md`

- [x] **Step 1: Vor Aktivierung den kritischen Scope klein halten**

Kritisch sind nur Aenderungen an:

```text
apps/sva-studio-react/src/server.ts
apps/sva-studio-react/src/lib/**/*.server.ts
apps/sva-studio-react/package.json
apps/sva-studio-react/vite.config.ts
scripts/ci/verify-runtime-artifact.sh
```

- [x] **Step 2: Einen eigenen `runtimeVerifyMode` nur dann einfuehren, wenn Phase 1-4 stabil sind**

Der neue Mode darf nicht die Default-PRs treffen. Er ist ausschliesslich fuer runtime-kritische Pfade oder den Release-Pfad gedacht.

- [x] **Step 3: Aktivierung erst nach Timing-Benchmark**

Run:

```bash
time pnpm verify:runtime-artifact
```

Expected: Dokumentierte Laufzeitbasis. Erst danach Entscheidung, ob der Check auf kritischen PRs blockieren darf oder nur im Release-Pfad bleibt.

Ergebnis: `pnpm verify:runtime-artifact` lag lokal am `2. Juni 2026` trotz `21/23` Nx-Cache-Treffern bei ca. `220.98s` (`real`) und damit oberhalb der internen Aktivierungsgrenze fuer generische PR-Gates. Der Check wurde deshalb nur als zusaetzliches Step im bestehenden Workflow `Main Build / App Build` fuer runtime-kritische Pull Requests aktiviert; `pnpm test:pr` bleibt bewusst frei von diesem Heavy-Run und der volle Release-Pfad `pnpm test:release:studio` bleibt unveraendert kanonisch.

## Success Criteria

- [x] Plugin-UI-Aenderungen triggern `App Build` und `App E2E` nicht mehr faelschlich als `skip`.
- [x] i18n fuer App und Plugin-UI wird ueber den vorhandenen Build-Vorcheck abgesichert, ohne zweiten PR-i18n-Job.
- [x] `A11y` blockiert nur fuer UI-relevante Aenderungen.
- [x] `Integration` bedeutet wieder echte Integrationsabsicherung statt Platzhalter-Gruen.
- [x] Schwere Zusatzgates werden nicht pauschal fuer jeden PR aktiviert.
- [x] Dokumentation und Branch-Protection-Empfehlungen spiegeln die neue Gate-Realitaet wider.

## Rollout Order

- [x] Phase 1: Task 1 und Task 2 zusammen umsetzen
- [x] Phase 2: Task 3 aktivieren
- [x] Phase 3: Task 4 nachziehen
- [x] Phase 4: Task 5 und Task 6 nur nach Timing-Benchmark entscheiden
