# Testing & Coverage Governance

## Ziel

Dieses Dokument beschreibt den standardisierten Coverage-Workflow im Nx Monorepo:

- einheitliche Testtargets (`test:unit`, `test:coverage`, `test:integration`)
- Coverage-Gates pro Paket und global
- Mindest-Floors und Hotspot-Floors für kritische Module
- PR-Transparenz via CI Summary + Artefakte
- stufenweiser Rollout mit Baseline und Ratcheting

## Target-Konvention

Jedes Projekt soll folgende Targets bereitstellen:

- `lint`: ausführbarer Qualitäts-Check (kein Platzhalter)
- `typecheck`: TypeScript-Strict-Check für den produktiven Projekt-Scope
- `test:unit`: schnelle, stabile Unit-Tests
- `test:coverage`: Unit-Tests mit Coverage-Reporting
- `test:integration`: infra-abhängige Tests (z. B. Redis, echte Services)

## Lokaler Workflow

### Gesamtes Workspace

```bash
pnpm test:types
pnpm test:unit
pnpm test:coverage
pnpm test:integration
```

`pnpm test:types` ist bindend und umfasst neben den Core-/Library-Builds auch den dedizierten Nx-Typecheck der React-App (`sva-studio-react:typecheck`). Debug-Routen unter `src/routes/__debug/` sind dabei bewusst ausgeschlossen, damit optionale Diagnose-Abhängigkeiten den regulären App-Typecheck nicht verfälschen.

### Nur betroffene Projekte

```bash
pnpm test:coverage:affected
```

### Pull-Request-Patch lokal vorprüfen

```bash
pnpm test:coverage:pr
```

Das Kommando führt dieselben betroffenen Coverage-Targets wie der PR-Workflow aus und prüft danach die Patch-Coverage lokal gegen den Zielwert von `80%`.

### Baseline aktualisieren

Nur nach bewusstem Team-Entscheid:

```bash
pnpm coverage-gate --update-baseline
```

## Coverage-Gates

Policy-Dateien:

- `tooling/testing/coverage-policy.json`
- `tooling/testing/coverage-baseline.json`

Regeln:

- Gates werden pro Projekt und global ausgewertet
- Initiale Floors sind konservativ, danach Ratcheting
- Abfälle gegen Baseline über der erlaubten Schwelle schlagen fehl
- Exempt-Projekte sind in der Policy explizit dokumentiert
- Kritische Projekte können strengere `minimumFloors` erhalten als normale Projekt-Floors
- Kritische Hotspots können über `hotspotFloors` auf Datei-Ebene aus `lcov.info` abgesichert werden

## Kritische Module und Hotspots

Kritische Coverage-Regeln liegen in `criticalProjects` der Policy.

Beispiele:

- `auth`: projektweite Mindest-Floors plus Hotspots für `iam-account-management.server.ts` und `iam-governance.server.ts`
- `routing`: Hotspot-Floor für `auth.routes.server.ts`
- `core`: Security-Hotspot-Floor für `field-encryption.ts`

Wenn die Komplexität eines kritischen Hotspots steigt, darf der bestehende Floor nicht abgesenkt werden. Stattdessen muss die Absicherung gleich bleiben oder feiner/höher nachgezogen werden.

## CI-Verhalten

Workflow: `.github/workflows/test-coverage.yml`

- Pull Requests:
  - `test:coverage:affected`
  - Coverage-Gate (blockierend)
  - Integrationstests separat, optional (`continue-on-error`)
- Main + Nightly:
  - `test:coverage` (voll)
  - Coverage-Gate (blockierend)
  - Integrationstests separat und verpflichtend

### Codecov-Schwellenwerte

Codecov bewertet im Pull-Request zwei getrennte Sichten:

- `project`: Gesamt-Coverage des gemessenen Codebestands mit Zielwert `75%`
- `patch`: Coverage des neu geänderten Codes mit Zielwert `80%`

Beide Codecov-Statuschecks sind im Projekt **informational**.
Bindend bleibt die interne Governance:

- für Pull Requests `pnpm test:coverage:pr`
- für die allgemeine Coverage-Governance `pnpm coverage-gate`

Wichtig:

- Codecov berücksichtigt nur Projekte, für die im PR-Lauf auch tatsächlich `lcov.info` hochgeladen wird.
- Projekte aus `exemptProjects` in `tooling/testing/coverage-policy.json` dürfen deshalb nicht im Codecov-Flag `unittests` auftauchen.
- Der lokale Preview-Check `pnpm patch-coverage-gate --base=origin/main` nutzt denselben Workspace-Scope wie unsere interne Coverage-Governance, damit Abweichungen vor dem Push sichtbar werden.

## Exemptions

Aktuell als coverage-exempt markiert:

- `core`
- `data`
- `plugin-example`

Diese Liste wird schrittweise reduziert, sobald echte Unit-Tests vorhanden sind.

### Reviewer-Workflow für Exemptions

- Prüfen, ob Änderungen ein exemptes Projekt betreffen.
- Prüfen, ob mindestens `lint` im betroffenen Projekt erfolgreich war.
- Prüfen, ob angrenzende nicht-exempte Projekte (z. B. `auth`, `sdk`, `monitoring-client`) grüne `test:unit`-Runs haben.
- Bei funktionalen Änderungen in exempten Projekten: expliziten Test-Nachweis im PR verlangen (mindestens Smoke/Contract-Run), bis die Exemption entfernt ist.

### Aktueller Status nicht-exempter Unit-Targets

- `auth`: echter `test:unit`-Run via Vitest
- `sdk`: echter `test:unit`-Run via Vitest
- `monitoring-client`: echter `test:unit`-Run via Vitest
- `sva-studio-react`: echter `test:unit`-Run via Vitest (`--passWithNoTests`)

### Aktueller Status nicht-exempter Coverage-Targets

- `auth`: `test:coverage` via Vitest (`--coverage`)
- `routing`: `test:coverage` via Vitest (`--coverage`)
- `sdk`: `test:coverage` via Vitest (`--coverage`)
- `monitoring-client`: `test:coverage` via Vitest (`--coverage`)
- `sva-studio-react`: `test:coverage` via Vitest (`--coverage`)

## PR-Checkliste

Die Merge-Checkliste für Coverage-Nachweise steht unter `../reports/PR_CHECKLIST.md`.
Policy und Floors liegen in `../../tooling/testing/coverage-policy.json`.
Die ergänzende Komplexitäts-Governance steht unter `./complexity-quality-governance.md`.

## Troubleshooting

### `affected` ist leer (PR) / es laufen keine Coverage-Targets

**Symptom:** `pnpm test:coverage:affected` läuft durch, aber es wird keine Coverage generiert (keine `coverage/coverage-summary.json`).

**Häufige Ursachen:**
- Es gibt tatsächlich keine betroffenen Projekte mit `test:coverage` Target.
- `origin/main` ist lokal nicht aktuell (falsche `--base` Referenz).

**Vorgehen:**
```bash
git fetch origin main
pnpm test:coverage:affected
```

**Debugging:**
```bash
npx nx affected --target=test:coverage --base=origin/main --head=HEAD --verbose
```

Wenn der PR Änderungen enthält, aber kein Projekt als betroffen erkannt wird, prüfe:
- ob die Änderung in einem Nx-Projekt liegt (nicht z. B. nur in nicht-erfassten Ordnern)
- ob das betroffene Projekt überhaupt ein `test:coverage` Target definiert

---

### „missing coverage-summary.json“ / Coverage-Artefakte fehlen

**Symptom:** Das Coverage-Gate meldet, dass `coverage-summary.json` fehlt.

**Häufige Ursachen:**
- Coverage ist im Projekt nicht konfiguriert (z. B. `@vitest/coverage-v8` fehlt).
- `test:coverage` wird ohne Coverage-Flag/Reporter ausgeführt.
- Es existieren keine Tests (siehe „No tests configured“).

**Vorgehen:**
1. Sicherstellen, dass Coverage-Dependency installiert ist (pro Projekt):
   ```bash
   pnpm --filter <project> add -D @vitest/coverage-v8
   ```
2. `test:coverage` lokal laufen lassen:
   ```bash
   npx nx run <project>:test:coverage
   ```
3. Prüfen, ob im Projektverzeichnis `coverage/coverage-summary.json` und `coverage/lcov.info` erzeugt werden.

---

### Baseline-Drop („dropped by X pp“)

**Symptom:** Das Gate schlägt fehl, weil eine Metrik im Vergleich zur Baseline um mehr als die erlaubten Prozentpunkte gefallen ist.

**Vorgehen:**
- Primär: Tests ergänzen oder bestehende Tests reparieren, bis die Regression behoben ist.
- Falls die Baseline bewusst angepasst werden soll (z. B. Refactor mit geänderter Messbasis): Baseline nur nach Team-Entscheid aktualisieren:
  ```bash
  pnpm coverage-gate --update-baseline
  ```

**Hinweis:** Baseline-Updates sind kein Ersatz für fehlende Tests.

---

### Hotspot-Floor verletzt

**Symptom:** Das Gate meldet `hotspot <datei> <metrik> below floor`.

**Ursache:** Eine in `criticalProjects.<projekt>.hotspotFloors` definierte kritische Datei liegt unter dem Mindestwert für `lines`, `functions` oder `branches`.

**Vorgehen:**
- Tests gezielt für den betroffenen Hotspot ergänzen
- Falls der Hotspot durch neue Komplexität entstanden ist: Komplexitäts-Review und ggf. neue Refactoring-Aufgabe ergänzen
- Floors nur anheben oder feiner zuschneiden, nie wegen steigender Komplexität absenken

---

### Exemptions (Projekt ist coverage-exempt)

**Symptom:** Ein Projekt taucht nicht im Gate-Report auf oder beeinflusst die „global“ Auswertung nicht.

**Ursache:** Das Projekt ist in `tooling/testing/coverage-policy.json` unter `exemptProjects` gelistet.

**Vorgehen:**
- Exemption nur temporär nutzen.
- Sobald Unit-Tests vorhanden sind:
  1. Projekt aus `exemptProjects` entfernen
  2. Floors (z. B. unter `perProjectFloors`) setzen
  3. Baseline aktualisieren (Team-Entscheid)

---

### „No tests configured“ / keine Tests vorhanden

**Symptom:** Test-Run ist „grün“, aber es werden keine Coverage-Artefakte erzeugt.

**Häufige Ursache:** Es gibt keine Testdateien im Projekt; je nach Konfiguration kann `--passWithNoTests` den Run trotzdem erfolgreich beenden.

**Vorgehen:**
- Mindestens einen Unit-Test hinzufügen (damit Coverage erzeugt wird).
- Optional (je nach Governance-Entscheid): `--passWithNoTests` entfernen, damit fehlende Tests früh sichtbar werden.

## Migration Guide

### Neues Package zur Coverage hinzufügen

1. Dependencies für Tests und Coverage installieren:
   ```bash
   pnpm --filter <package-name> add -D vitest @vitest/coverage-v8
   ```
2. Nx Targets im `project.json` ergänzen:
   - `test:unit`
   - `test:coverage`
3. Mindestens einen Unit-Test anlegen:
   ```bash
   mkdir -p packages/<package-dir>/tests
   ```
4. Policy aktualisieren:
   - Projekt aus `exemptProjects` in `tooling/testing/coverage-policy.json` entfernen
   - Optional `perProjectFloors.<project>` setzen
5. Baseline neu erzeugen:
   ```bash
   pnpm test:coverage
   pnpm coverage-gate --update-baseline
   ```
6. Validierung lokal ausführen:
   ```bash
   npx nx run <project>:test:coverage
   COVERAGE_GATE_REQUIRE_SUMMARIES=1 pnpm coverage-gate
   ```

### Quick Reference

```bash
# Alle Coverage-Targets
pnpm test:coverage

# Nur betroffene Coverage-Targets
pnpm test:coverage:affected

# Gate lokal prüfen
pnpm coverage-gate
```

### Relevante Links

- Coverage Policy: `../../tooling/testing/coverage-policy.json`
- Coverage Baseline: `../../tooling/testing/coverage-baseline.json`
- Komplexitäts-Policy: `../../tooling/quality/complexity-policy.json`
- Komplexitäts-Baseline: `../../tooling/quality/complexity-baseline.json`
- Komplexitäts-Governance: `./complexity-quality-governance.md`
- PR-Checklist: `../reports/PR_CHECKLIST.md`
