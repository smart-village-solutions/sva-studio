# Testing-Strategie

Dieses Dokument beschreibt die übergeordnete Teststrategie für das Nx-Monorepo. Es ergänzt die detaillierten Governance- und E2E-Dokumente, ersetzt sie aber nicht.

## Ziele

- schnelle Rückmeldung bei lokalen Änderungen
- hohe Typsicherheit im Strict-Mode
- reproduzierbare Qualitätsgates vor Merge und Release
- klare Trennung zwischen schnellen lokalen Checks und teureren End-to-End-Läufen

## Testportfolio

| Ebene | Zweck | Primäre Kommandos |
| --- | --- | --- |
| Datei- und Strukturchecks | Repo-Regeln und Ablage absichern | `pnpm check:file-placement` |
| Type-Checks | Typkonsistenz über App und Libraries | `pnpm test:types` |
| Unit-Tests | schnelles Verhalten einzelner Module prüfen | `pnpm test:unit` |
| Linting | Code- und Regelkonformität absichern | `pnpm test:eslint` |
| E2E- und Smoke-Tests | reale Flows gegen laufende App prüfen | `pnpm test:e2e` |
| Coverage- und Quality-Gates | Testabdeckung und Governance bewerten | `pnpm test:coverage`, `pnpm coverage-gate` |

## Grundregeln

- Nach jedem abgeschlossenen Änderungsblock laufen die betroffenen Tests sofort.
- Es wird nicht auf bekannt rotem Teststand weiterimplementiert.
- Nx-Targets sind der Standardweg für projektbezogene Läufe.
- Bei Typänderungen sind Type- und Unit-Checks obligatorisch.
- Vor größeren Test- oder Coverage-Läufen werden versehentlich erzeugte Source-Artefakte mit `pnpm clean:generated-source-artifacts` bereinigt.

## Empfohlener lokaler Workflow

### Kleine oder klar eingegrenzte Änderung

1. Betroffenes Projekt oder Paket identifizieren.
2. `pnpm nx run <projekt>:test:unit` oder affected-Targets ausführen.
3. Bei Typbezug zusätzlich `pnpm nx run <projekt>:typecheck` oder `pnpm test:types`.

### Größerer Änderungsblock

1. `pnpm check:file-placement`
2. `pnpm test:types`
3. `pnpm test:unit`
4. `pnpm test:eslint`
5. bei UI-, Routing- oder Integrationswirkung zusätzlich `pnpm test:e2e`

### Vor Push

- `pnpm test:unit:affected`
- bei Typänderungen zusätzlich `pnpm test:types:affected`
- bei PR-relevanten Quality-Gate-, Coverage-, Logging-, Auth-, Routing- oder Build-Änderungen zusätzlich `pnpm test:pr`

### Vor PR-Update

- `pnpm test:pr`

`pnpm test:pr` spiegelt den blockierenden GitHub-PR-Pfad so nah wie lokal sinnvoll möglich:

- `pnpm check:file-placement`
- `affected` oder `full` für `lint`, `test:unit`, `test:types`, `test:coverage` abhängig vom PR-Scope
- `pnpm patch-coverage-gate --base=origin/main` für New-Code-/Patch-Coverage
- `pnpm coverage-gate` im PR-Modus
- `pnpm complexity-gate`
- `affected`, `full` oder No-op für `test:integration` abhängig von Laufzeit-/Routing-/Transportwirkung
- relevanter App-Build und relevanter App-E2E-Smoke nach derselben Scope-Logik wie GitHub

Die PR-Selektion folgt einem einheitlichen `affected-first`-Modell:

- Reine Doku-/Meta-Änderungen enden als erfolgreicher No-op.
- Normale Paketänderungen laufen affected.
- Globale Tooling-Dateien wie `pnpm-lock.yaml`, `nx.json`, `tsconfig.base.json`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.workspace.ts`, Root-`package.json`, `.github/workflows/**` und `scripts/ci/**` eskalieren `lint`, `unit`, `types` und `coverage` bewusst auf volle Läufe.
- `integration` und `e2e` eskalieren nur bei tatsächlicher Laufzeit-, Routing-, Auth-, Transport-, Build- oder App-Flow-Wirkung.

Nicht vollständig lokal abbildbar bleiben externe PR-Dienste wie SonarCloud, Codecov und CodeQL. `pnpm test:pr` deckt jetzt aber neben der Repo-Coverage auch die lokale Patch-Coverage ab und reduziert damit die häufigsten Abweichungen zwischen lokalem Stand und GitHub-Checks deutlicher.

### Vor Merge oder Release

- `pnpm test:unit`
- `pnpm test:types`
- `pnpm test:eslint`
- `pnpm test:e2e`

## Strategie nach Risiko

| Änderungstyp | Mindestnachweis |
| --- | --- |
| reine Doku oder nicht-funktionale Repo-Anpassung | `pnpm check:file-placement` |
| Library- oder Kernlogik | Type-Checks und Unit-Tests |
| Routing, UI oder Request-Flows | Type-Checks, Unit-Tests, relevante E2E-Smokes |
| Deployment- oder Betriebsänderung | File-Placement, relevante Tests, Rendern der Compose-Konfiguration |
| Architektur- oder Governance-Änderung | Doku-Update plus passende technische Nachweise |

## Risikoklassen nach Projektfamilie

Die konkrete Testtiefe wird zusätzlich über die Risikoklasse des betroffenen Projekts oder Packages gesteuert. Der QS-Mindeststandard unter `./qs-mindeststandard-sva-studio.md` bleibt die maßgebliche Quelle; die folgende Tabelle ist bewusst nur ein Kurz-Auszug für die Testing-Perspektive.

| Risikoklasse | Typische Projekte | Erwartete Testtiefe |
| --- | --- | --- |
| hoch | `sva-mainserver`, `auth-runtime`, `iam-admin`, `iam-core`, `iam-governance`, `instance-registry`, `data`, `routing` | Type-, Unit- und bei Flow- oder Vertragswirkung zusätzliche Integrations- oder E2E-Nachweise |
| mittel | `data-client`, `monitoring-client`, `plugin-sdk`, `server-runtime`, `studio-module-iam` | Type- und Unit-Tests; Integrationstests bei Schnittstellen- oder Runtime-Wirkung |
| normal | `studio-ui-react`, fachliche Plugin-Packages, Doku- und Governance-Pfade | gezielte Nachweise für den betroffenen Scope; bei UI mindestens Accessibility-Selbstprüfung |

Wenn eine Änderung mehrere Projektfamilien berührt, gilt die höchste betroffene Risikoklasse.

## E2E-Strategie

E2E-Läufe sichern die kritischen Browser- und Integrationspfade ab. Das Detailsetup, die Pflichtdienste und der CI-Workflow stehen in `./app-e2e-integration-testing.md`.

E2E ist besonders wichtig bei:

- Shell-, Routing- oder Auth-Änderungen
- Änderungen an Server-Funktionen oder Transportpfaden
- Releases mit Deployment- oder Infrastrukturwirkung

## Coverage und Governance

Die detaillierten Floors, Hotspots und CI-Regeln bleiben in `./testing-coverage.md` dokumentiert.

Diese Strategie definiert nur die Leitplanken:

- Coverage-Gates werden nicht durch Ausnahmeregeln umgangen.
- Exemptions sind temporär und müssen aktiv zurückgebaut werden.
- Kritische Hotspots brauchen gezielte Tests statt bloß global höherer Zahlen.
- Dateien dürfen nur in gut begründbaren Ausnahmefällen von Coverage-, New-Code- oder CPD-Gates ausgenommen werden.
- Zulässige Ausnahmefälle sind vor allem generierte Artefakte oder ressourcenartige Dateien ohne sinnvolles Qualitätssignal aus Coverage oder Duplikationsmessung.
- Fehlende Testbarkeit ist kein Freifahrtschein für Exclusions; in solchen Fällen sind Tests nachzuziehen oder die betroffene Datei strukturell testbarer zu schneiden.

## Umgang mit Fehlern und Flakes

- Erst den Scope eingrenzen: Projekt, Target, betroffene Datei.
- Reproduzierbarkeit lokal herstellen, bevor Workarounds dokumentiert werden.
- Flaky Tests werden entweder stabilisiert oder vorübergehend explizit aus dem Pflichtpfad herausgenommen, aber nicht stillschweigend ignoriert.
- Flake-anfällige Vitest-Targets im Pflichtpfad laufen bevorzugt seriell, wenn Parallelisierung nachweislich Race- oder Timing-Probleme erzeugt.
- Jede bewusste Testlücke braucht dokumentierte Folgearbeit.

## Dokumentationspflicht

Neue Features, Architekturänderungen oder neue Betriebswege müssen die betroffenen Doku-Einstiege unter `docs/` aktualisieren. Testing-Nachweise allein ersetzen keine aktualisierte Betriebs- oder Architekturdokumentation.

## Verweise

- Coverage-Governance: `./testing-coverage.md`
- App-E2E-Integration: `./app-e2e-integration-testing.md`
- Review-Governance: `./review-agent-governance.md`
- QS-Mindeststandard: `./qs-mindeststandard-sva-studio.md`
- Architekturüberblick: `../architecture/README.md`
