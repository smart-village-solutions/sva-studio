# Testing & Coverage Governance

## Ziel

Dieses Dokument beschreibt den standardisierten Coverage-Workflow im Nx Monorepo:

- einheitliche Testtargets (`test:unit`, `test:coverage`, `test:integration`)
- Coverage-Gates pro Paket und global
- PR-Transparenz via CI Summary + Artefakte
- stufenweiser Rollout mit Baseline und Ratcheting

## Target-Konvention

Jedes Projekt soll folgende Targets bereitstellen:

- `test:unit`: schnelle, stabile Unit-Tests
- `test:coverage`: Unit-Tests mit Coverage-Reporting
- `test:integration`: infra-abhängige Tests (z. B. Redis, echte Services)

## Lokaler Workflow

### Gesamtes Workspace

```bash
pnpm test:unit
pnpm test:coverage
pnpm test:integration
```

### Nur betroffene Projekte

```bash
pnpm test:coverage:affected
```

### Baseline aktualisieren

Nur nach bewusstem Team-Entscheid:

```bash
node scripts/ci/coverage-gate.mjs --update-baseline
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

## Exemptions

Aktuell als coverage-exempt markiert:

- `core`
- `data`
- `plugin-example`

Diese Liste wird schrittweise reduziert, sobald echte Unit-Tests vorhanden sind.

## PR-Checkliste

Die Merge-Checkliste für Coverage-Nachweise steht unter `../reports/PR_CHECKLIST.md`.

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
  node scripts/ci/coverage-gate.mjs --update-baseline
  ```

**Hinweis:** Baseline-Updates sind kein Ersatz für fehlende Tests.

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
