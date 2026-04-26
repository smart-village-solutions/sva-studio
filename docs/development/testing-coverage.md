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

### GitHub-PR-Gates lokal vorprüfen

```bash
pnpm test:pr
```

Das Kommando bildet den blockierenden GitHub-PR-Workflow für lokale Vorprüfung nach:

- `check:file-placement`
- `nx affected --target=test:coverage --base=origin/main`
- `patch-coverage-gate --base=origin/main` für geänderte, ausführbare Zeilen im PR-Diff
- `coverage-gate` im PR-Modus mit optionalen Summary-Dateien
- `complexity-gate`
- `test:integration`
- React-App-Build für denselben Build-Pfad wie im Coverage-Workflow

Nicht Bestandteil von `pnpm test:pr` sind externe Plattform-Auswertungen wie SonarCloud, Codecov oder CodeQL. Die lokale New-Code-/Patch-Coverage wird aber jetzt bereits vor dem Push geprüft, sodass die häufigste Abweichung zwischen lokalem PR-Gate und Sonar früher sichtbar wird.

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
- Floors werden an der zuletzt stabil gemessenen Coverage ausgerichtet und danach per Ratcheting nachgezogen
- Abfälle gegen Baseline über der erlaubten Schwelle schlagen fehl
- Exempt-Projekte sind in der Policy explizit dokumentiert
- Kritische Projekte können strengere `minimumFloors` erhalten als normale Projekt-Floors
- Kritische Hotspots können über `hotspotFloors` auf Datei-Ebene aus `lcov.info` abgesichert werden
- Dateien dürfen nur in gut begründbaren Ausnahmefällen aus Coverage- oder New-Code-Gates ausgenommen werden.
- Zulässige Ausnahmefälle sind insbesondere generierte Artefakte oder ressourcenartige Dateien, bei denen Coverage- oder CPD-Metriken systematisch kein sinnvolles Qualitätssignal liefern.
- „schwer testbar“, „zu groß“ oder „orchestriert nur andere Funktionen“ sind für sich allein keine ausreichenden Gründe für eine Exclusion; in diesen Fällen sind stattdessen Tests zu ergänzen oder die Datei gezielt zu refactoren.

## Kritische Module und Hotspots

Kritische Coverage-Regeln liegen in `criticalProjects` der Policy.

Beispiele:

- IAM-Zielpackages: projektweite Mindest-Floors liegen direkt auf `auth-runtime`, `iam-admin`, `iam-governance` und `instance-registry`; historische `auth`-Hotspots sind entfernt.
- `routing`: Hotspot-Floor für `auth.routes.server.ts`
- `core`: Security- und IAM-Hotspots für `field-encryption.ts` und `authorization-engine.ts`
- `sdk`: Hotspots für `request-context.server.ts` und `monitoring-client.bridge.server.ts`
- `sva-studio-react`: Hotspots für `iam-user-events.ts` und `-iam.models.ts`

Hinweis: In `tooling/testing/coverage-policy.json` werden Hotspots immer auf TypeScript-Quelldateien definiert. Das Coverage-Gate mappt `lcov`-`SF:`-Einträge bei Bedarf auf diese Quellpfade zurück.

Empfohlener Testzuschnitt für große Handlerdateien:

- Request-Parsing, Filterlogik, Mapper und Konfliktentscheidungen als reine Helfer absichern
- Handler-Orchestrierung mit wenigen gezielten Server-Tests auf Rollen, CSRF, Idempotency und Seiteneffekte prüfen
- Große Mock-Setups nur für die eigentliche Integrationskante einsetzen, nicht für jede einzelne Branch
- Kleine verhaltensneutrale Extraktionen oder package-interne Helper-Exports sind zulässig, wenn sie die Absicherung vereinfachen

Wenn die Komplexität eines kritischen Hotspots steigt, darf der bestehende Floor nicht abgesenkt werden. Stattdessen muss die Absicherung gleich bleiben oder feiner/höher nachgezogen werden.

## CI-Verhalten

Workflow: `.github/workflows/test-coverage.yml`

- Pull Requests:
  - Job `Coverage Gate`: `nx affected --target=test:coverage` gegen den PR-Base-Branch
  - Job `Complexity Gate`: separates, blockierendes Komplexitäts-Gate
  - Job `PR Integration Gate`: `nx affected --target=test:integration`, exklusive `monitoring-client`
  - Reine Doku-/Meta-PRs starten die Workflows weiterhin, beenden die betroffenen Jobs aber bewusst früh als erfolgreicher No-op, damit Required Checks nicht im Status `expected` hängen bleiben
- Main + Nightly:
  - Job `Coverage Gate`: `test:coverage` (voll)
  - Job `Complexity Gate`: blockierend
  - Job `Integration Gate`: voller, verpflichtender Integrationslauf

### PR-Workflow-Matrix

| Workflow / Jobname in GitHub | Zweck | Trigger-Modell |
| --- | --- | --- |
| `Coverage Gate` | Coverage für affected/full + internes Coverage-Gate | alle PRs, `main`, nightly |
| `Complexity Gate` | Repository-weites Komplexitäts-Gate | alle PRs, `main`, nightly |
| `PR Integration Gate` | affected `test:integration` außer Monitoring-Stack | Pull Requests |
| `Integration Gate` | voller Integrationslauf | `main`, nightly |
| `App E2E Smoke` | Browser-Smoke für App-Routen | pfadbasiert |
| `monitoring-stack` | Monitoring-spezifische Docker-/Stack-Checks | pfadbasiert |
| `Schema Diff Gate` | Schema-Diff gegen Staging | pfadbasiert |
| `check-file-placement` | Dateiplatzierungs-Regeln | alle PRs und `main` |

### Recommended Branch-Protection-Checks

Empfehlung für `main`:

- immer required:
  - `Lint / lint`
  - `Unit / unit`
  - `Types / types`
  - `Coverage Gate`
  - `Complexity Gate`
  - `PR Integration Gate` für Pull Requests
  - `Integration Gate` für `main`
  - `check-file-placement`
- pfadabhängig required:
  - `App E2E Smoke`
  - `monitoring-stack`
  - `Schema Diff Gate`

### CI-Summaries und Artefakte

Die wichtigsten Workflows schreiben eine kurze `GITHUB_STEP_SUMMARY` mit Scope, Ergebnis und Artefaktname. Ziel ist, dass Reviews die relevanten Nachweise direkt im PR-UI finden, ohne zuerst in die kompletten Logs zu wechseln.

## Nx-Remote-Cache: sichere Aktivierung vorbereiten

Für Team- und CI-weite Wiederverwendung von Nx-Artefakten ist Nx Cloud der vorgesehene Standard. Laut offizieller Nx-Dokumentation wird ein bestehendes Workspace-Repo per `nx connect` angebunden; dabei wird ein `nxCloudId` in `nx.json` hinterlegt und im Repository committed. Für produktive Setups empfiehlt Nx außerdem eine Ende-zu-Ende-Verschlüsselung über `NX_CLOUD_ENCRYPTION_KEY`.

Empfohlene Reihenfolge:

1. Workspace mit Nx Cloud verbinden:
   ```bash
   pnpm nx connect
   ```
2. Den erzeugten `nxCloudId`-Patch nach `nx.json` uebernehmen.
3. In GitHub Actions ein Secret `NX_CLOUD_ENCRYPTION_KEY` anlegen.
4. Das Secret in den relevanten Workflows als Environment-Variable durchreichen.
5. Fuer echte Deploy-Artefakte den Cache bewusst umgehen, wenn ein Lauf ein produktiv ausgerolltes Artefakt erzeugt.

Wichtig:

- Keine DIY-Bucket- oder Shared-FS-Remote-Caches fuer PR-Schreibzugriffe einfuehren. Nx weist aktuell explizit auf Cache-Poisoning-Risiken bei self-hosted Bucket-Loesungen hin.
- Solange kein `nxCloudId` vorliegt, bleibt das Repository absichtlich bei lokalem Cache plus `affected`.
- Die Aktivierung ist ein kleiner, separater Follow-up, weil dafuer ein echter Nx-Cloud-Workspace benoetigt wird.

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
- Lokale `src/*.js`, `src/*.d.ts` oder `src/*.d.ts.map` in Paketen verfälschen Import-Auflösung und `lcov`-Pfadzuordnung. Vor Coverage-Debugging deshalb `pnpm clean:generated-source-artifacts` und `pnpm check:file-placement` ausführen.

## Exemptions

Aktuell als coverage-exempt markiert:

- keine Projekte

Neue Exemptions sind nur in begründeten Ausnahmefällen zulässig und müssen in `tooling/testing/coverage-policy.json` dokumentiert werden.

### Reviewer-Workflow für Exemptions

- Prüfen, ob Änderungen ein exemptes Projekt betreffen.
- Prüfen, ob mindestens `lint` im betroffenen Projekt erfolgreich war.
- Prüfen, ob angrenzende nicht-exempte Projekte (z. B. `auth-runtime`, `sdk`, `monitoring-client`) grüne `test:unit`-Runs haben.
- Bei funktionalen Änderungen in exempten Projekten: expliziten Test-Nachweis im PR verlangen (mindestens Smoke/Contract-Run), bis die Exemption entfernt ist.

### Aktueller Status nicht-exempter Unit-Targets

- `auth-runtime`: echter `test:unit`-Run via Vitest
- `sdk`: echter `test:unit`-Run via Vitest
- `monitoring-client`: echter `test:unit`-Run via Vitest
- `sva-studio-react`: echter `test:unit`-Run via Vitest (`--passWithNoTests`)

### Aktueller Status nicht-exempter Coverage-Targets

- `auth-runtime`: `test:coverage` via Vitest (`--coverage`)
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
pnpm nx affected --target=test:coverage --base=origin/main --head=HEAD --verbose
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
   pnpm nx run <project>:test:coverage
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
   pnpm nx run <project>:test:coverage
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
