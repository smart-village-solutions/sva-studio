# Agents

Die verbindlichen Entwicklungsrichtlinien stehen in [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md). Diese Datei enthält nur die Regeln, die bei der täglichen Agentenarbeit unmittelbar präsent sein müssen. Im Zweifel gilt `DEVELOPMENT_RULES.md`.

## Code und Ownership

- TypeScript im Strict-Mode und typsicheres Routing mit Search- und Path-Params verwenden; framework-agnostische Kernlogik von React-Bindings trennen.
- Interne Abhängigkeiten mit `workspace:*` deklarieren. Bei serverseitig von Node geladenen Workspace-Packages müssen relative Runtime-Imports und Re-Exports `.js` verwenden; Runtime-Imports auf andere Workspace-Packages gehören unter `dependencies`. Reine `import type`-Pfade dürfen typbezogen bleiben.
- UI-Reihenfolge: native Browser-/HTML-Funktion, vorhandene shadcn/ui- oder Design-System-Komponente, vorhandene Workspace-Komponente, dann minimale neue Komponente.
- Vereinfachungen dürfen Testabdeckung, Typklarheit, Security, Accessibility, i18n, Fehlerbehandlung, Datenintegrität, Server-Runtime-Regeln oder Architekturgrenzen nicht schwächen.

## Anti-Ausdehnungsregel

- Standard ist die Erweiterung des bestehenden zuständigen Pfads. Vor Eigenlogik vorhandene Projekt-/Workspace-Lösungen, Plattformmittel und etablierte Dependencies prüfen. Neue Packages, Services, Provider, Factories, Gates, Workflows, Agenten, Skripte, Spezifikationen oder Konfigurationsschichten sind nur zulässig, wenn ein konkreter aktueller Bedarf im bestehenden Pfad nicht korrekt erfüllt werden kann.
- Vor einem neuen Artefakt in höchstens zwei Sätzen die belegte Lücke, den unmittelbaren Verbraucher und den Grund gegen die Erweiterung einer bestehenden Lösung benennen. Ist das nicht möglich, das Artefakt nicht anlegen.
- Ersetzt eine Änderung einen bestehenden Pfad, diesen im selben Lieferabschnitt löschen. Parallele, alternative oder Shadow-Pfade sind nur für eine unvermeidbare Migration mit expliziter Endbedingung und festgelegter Entfernung zulässig.
- Keine Kontrollschicht darf ausschließlich eine andere Kontrollschicht koordinieren. Neue CI-Gates, Wrapper, Agenten oder Governance-Dokumente benötigen einen eigenständigen, messbaren Sicherheits- oder Qualitätsgewinn.
- Spekulative Erweiterbarkeit ist kein Nutzen. Keine Hooks, Optionen, Interfaces, Adapter oder Konfigurationen für noch nicht existierende Verbraucher.
- Vor Abschluss prüfen, welche Konzepte, Dateien und Ausführungspfade hinzugefügt und entfernt wurden. Wächst die technische oder organisatorische Oberfläche stärker als die unmittelbar gelieferte Fähigkeit, den Entwurf vereinfachen oder neu zuschneiden.

## Nicht verhandelbare Produktregeln

- Keine hardcodierten UI-Texte; immer `t('key')` verwenden.
- Server-Code nutzt den Logger aus `@sva/server-runtime`, nie `console.*`. Development-Console ist zulässig; Production bleibt OTEL-first ohne Console-Ausgabe.
- Eingaben client- und serverseitig validieren und PII aus Logs fernhalten.
- Design-System statt statischem Inline-CSS verwenden. Neue UI basiert auf shadcn/ui und erfüllt WCAG 2.1 AA; parallele Basis-Komponenten benötigen eine dokumentierte Architekturentscheidung.
- Autorisierbare Actions immer als `<namespace>.<actionName>` modellieren; Plugins verwenden ausschließlich ihren eigenen Namespace.
- Vor DB-/Migrationsänderungen `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` prüfen; nach Schemaänderungen beide aktualisieren.

## Proportionaler Projektzuschnitt

- Kleine, lokal begrenzte Änderungen ohne neue systemübergreifende Invariante bleiben im Schnellpfad: keine künstlichen PR-Stacks, Zustandsmatrizen oder zusätzlichen OpenSpec-Changes.
- Vor systemübergreifenden Großvorhaben Lieferabschnitte, Trust Boundaries, Ausführungsgrenzen, Failure Modes und kritische Invarianten samt geplantem Nachweis klären. Form und Tiefe richten sich nach dem Risiko.
- Stacked PRs nur verwenden, wenn sie eigenständig build-, test- und reviewbare Zwischenstände mit geringerem Integrationsrisiko schaffen.
- Bei risikoreichen Großvorhaben die kritischen Invarianten und ihre geplanten Nachweise vor der Implementierung nachvollziehbar festhalten. `assurance.md`, stabile IDs und die bereitgestellten Templates sind empfohlene Hilfsmittel, keine Selbstzwecke; gleichwertige Darstellungen im Proposal, Design oder PR sind zulässig. Vor dem Merge muss die gewählte Evidenz für den exakten HEAD belastbar sein.
- Wenn mehrere neue Review- oder Testbefunde dieselbe Invariante oder Systemgrenze betreffen, lokale Mikrofixes stoppen und vor dem nächsten Push Zustandsraum sowie alle Verbraucher zusammenhängend prüfen.
- Einen bereits stark integrierten PR nicht allein wegen seiner Größe spät mechanisch zerlegen; ein Split benötigt weiterhin stabile, eigenständig prüfbare Zwischenstände.

## Test-Anweisungen

- Repository-interne Tests unter `apps/`, `packages/` und `scripts/` laufen über Vitest; keine neuen `node:test`- oder `node --test`-Pfade anlegen.
- Neue Codeblöcke und wesentliche Scope-Erweiterungen sofort mit dem kleinsten echten Unit-/Type-Gate absichern; auf bekannt rotem Stand nicht weiterimplementieren. Reine Text-, Kommentar- und Dokumentationsänderungen benötigen keine Tests.
- Vor einem affected-Unit-Run zuerst den Scope messen: `pnpm nx show projects --affected --withTarget=test:unit --base=origin/main`. Bei mehr als sechs Projekten, App-UI-/Routes-Matrizen oder PR-fremden Langläufern gezielte Projekt-/Dateitests verwenden und den breiten Lauf CI beziehungsweise dem finalen Gate überlassen.
- Kleine Folgefixes in bestehenden PRs nur gezielt testen, wenn ein schneller aussagekräftiger Test existiert oder ein konkretes Fehlersignal reproduziert wird; keine breiten lokalen `affected`- oder `test:pr`-Wiederholungen.
- Für serverseitige Änderungen unter `packages/{core,data,monitoring-client,sdk,auth,routing,sva-mainserver}` früh `pnpm check:server-runtime` ausführen. Für Root-TS-, Skript- oder CI-Änderungen den passenden Skript-Typecheck verwenden, etwa `pnpm exec tsc -p tsconfig.scripts.json --noEmit`.
- Dateifilter für Nx-Testtargets immer als `--testFiles=...` übergeben. Bevorzugte Gates: `pnpm nx affected --target=test:unit --base=origin/main`, `pnpm test:pr`, `pnpm test:coverage:pr`; die vollständige Suite ist `pnpm test:ci`.
- Sicherheits-, Auth-, Datenintegritäts-, Migrations- und Server-Runtime-Änderungen behalten ihre speziellen Pflicht-Gates. Details und Auswahlregeln stehen in `DEVELOPMENT_RULES.md`, Abschnitt 5.2.

## PR-Anweisungen

- **PR-Auftrag vor Beginn:** Vor der Änderung das Ziel des PRs in einem Satz, die expliziten Nicht-Ziele und die maximal betroffenen Bereiche festhalten. Diese Grenze ist während der Merge-Phase verbindlich.
- **PR-Fixing-Priorität:** Bei der Bearbeitung bestehender PRs sind die GitHub-Gates für den exakten HEAD die führende Wahrheit. Lokale Testläufe dienen nur der schnellsten gezielten Reproduktion oder Absicherung des unmittelbar geänderten Pfads und werden auf Testdatei, Testnamen oder kleinstes betroffenes Projekt begrenzt. Keine breiten lokalen `affected`-, `test:pr`- oder Vollsuite-Läufe wiederholen, wenn GitHub den unveränderten Scope bereits prüft; spezielle Pflicht-Gates für Security, Auth, Datenintegrität, Migrationen und Server-Runtime bleiben bestehen.
- **Rote Gates zuerst:** Zuerst den konkreten roten GitHub-Job und dessen Logs auswerten. Nur das belegte Fehlersignal lokal reproduzieren, minimal beheben, gezielt prüfen, pushen und anschließend die GitHub-Gates am neuen HEAD beobachten. Keine vorsorglichen Reparaturen angrenzender Bereiche.
- **Thread-Triage vor Umsetzung:** Review-Threads nur bearbeiten, wenn der Befund nach Prüfung notwendig ist, um einen realen Bug, eine Regression, ein Security-/Datenschutzproblem, Datenverlust, einen verletzten Vertrag oder ein zwingendes Akzeptanzkriterium des PRs zu vermeiden. Hypothetische Risiken, Geschmacksfragen, optionale Refactorings, zusätzliche Abstraktionen und nicht erforderliche Robustheits- oder Komfortverbesserungen gehören nicht in den laufenden PR.
- **Nicht notwendige Threads:** Nicht automatisch umsetzen. Bei eigenständigem, belegtem Nutzen sofort als nicht blockierendes Follow-up erfassen und den Thread mit Verweis darauf schließen; rein hypothetische oder geschmackliche Befunde ohne belegten Nutzen begründet schließen. Ein Follow-up darf den Abschluss des aktuellen PRs nicht blockieren.
- **Scope-Schutz in der Merge-Phase:** Ausschließlich unmittelbar blockierende Correctness-, Security- oder Datenintegritätsprobleme mit der kleinsten lokalen Änderung beheben. Keine neue Abstraktion, Generalisierung, Komponente, zentrale Infrastruktur oder systemübergreifenden Verträge einführen. Berührt ein Fix neue Komponenten oder Verträge oder erweitert er den festgehaltenen Scope, den Fix zurückschneiden und vor weiteren Änderungen stoppen. Lässt sich ein echter Blocker innerhalb dieser Grenze nicht korrekt beheben, ist der PR nicht merge-reif und benötigt einen einfacheren Entwurf oder einen neu zugeschnittenen Lieferabschnitt.
- **Circuit-Breaker nach einer Review-Fixrunde:** Weitere Findings führen entweder zu einem einfacheren Entwurf oder zu nicht blockierenden Follow-ups, nicht zu einer zusätzlichen Implementierungsschicht im laufenden PR. Mehrere Befunde an derselben Invariante oder Systemgrenze lösen weiterhin die Review- und Fix-Stop-Regel aus `DEVELOPMENT_RULES.md` aus.
- Bei roten CI-Checks zuerst `gh pr checks <nr>` und die roten Job-Logs prüfen; lokal nur das konkrete Fehlersignal oder den unmittelbar geänderten Pfad reproduzieren.
- Nach jedem Push bei aktivem PR-Fixing den Check-Status erneut prüfen und frühe rote Signale auswerten; Commit und Push dabei nie parallel starten. Die vollständigen CI-Gates nur für den exakten finalen HEAD einmal bis zum terminalen Ergebnis abwarten.
- Codeänderungen benötigen passende Tests und aktualisieren die relevante aktuelle Dokumentation, sofern sie betroffen ist. Features und Architektur-/Systemänderungen berücksichtigen zusätzlich die relevanten arc42-Abschnitte unter `docs/architecture/`.

## Verbindlicher Rollout-Prozess

- Für reguläre Rollouts nach Dev, Staging und Production ist ausschließlich `docs/guides/studio-rollout-process.md` maßgeblich.
- Der Standardpfad ist GitHub Actions `Build` → automatisches Dev → manuelles Staging → manuell freigegebenes Production mit demselben Image-Digest.
- Lokale `env:release:*`-/`env:deploy:*`-Mutationen, direkte Portainer-/Docker-Eingriffe und rohe `quantum-cli stacks deploy/update`-Aufrufe sind Diagnose beziehungsweise Incident-Recovery, aber kein konkurrierender Standardpfad.
- Rollout-Dokumentation darf keinen zweiten „kanonischen“, „offiziellen“ oder „empfohlenen“ Studio-Deploypfad definieren.
- Historische Reports, Staging-/PR-Unterlagen, Pläne und archivierte OpenSpec-Changes sind nicht normativ.

## Review-Agents

- `.github/agents/` ist die kanonische Quelle; die Trigger-Matrix steht in `docs/development/review-agent-governance.md`.
- Einstiegspunkte: `pr-review-orchestrator.agent.md` für Reviews, `pr-fixer.agent.md` für iterative PR-Fixes, `proposal-review-orchestrator.agent.md` für Proposals und `rollout-operator.agent.md` für Rollouts.
- Fachreviews stehen für Testqualität, i18n/Content, User Journey/Usability und Performance bereit.

## Dokumentation und Dateiplatzierung

- Aktuelle Dokumentation über `docs/README.md` und die Bereichsindizes unter `docs/{development,operations,reference,governance}/README.md` einordnen. Maßgebliche Dokumente sind deutsch mit korrekten Umlauten; interne Links relativ zum Ordner `docs/` schreiben.
- Neue aktuelle Dokumente gehören zweckbezogen nach `docs/{architecture,adr,development,operations,reference,api,governance}/`. `docs/guides/` enthält ausschließlich `studio-rollout-process.md`.
- Reports nach `docs/reports/`, Staging-Nachweise nach `docs/staging/YYYY-MM/` und PR-Unterlagen nach `docs/pr/<nummer>/` legen.
- Root-Level Markdown ist gesperrt (Ausnahme: `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `DEBUGGING.md`, `DEVELOPMENT_RULES.md`, `AGENTS.md`, `SECURITY.md`)
- Debug-Skripte gehören ausschließlich nach `scripts/debug/auth/` oder `scripts/debug/otel/`
- Legacy-Dateinamen wie `docs/STAGING-TODOS.md`, `docs/pr45-*.md`, `docs/pr-45-*.md` sind verboten
- Verbindlicher Check: `pnpm check:file-placement`; lokale Hooks mit `pnpm hooks:install` aktivieren.

<!-- OPENSPEC:START -->

## OpenSpec-Anweisungen

Diese Anweisungen sind für KI-Assistenten gedacht, die in diesem Projekt arbeiten.

Öffne immer `@/openspec/AGENTS.md`, wenn die Anfrage:

- Planung oder Vorschläge erwähnt (Wörter wie Vorschlag, Spezifikation, Änderung, Plan)
- Neue Funktionen, Breaking Changes, Architekturänderungen oder umfangreiche Performance-/Sicherheitsarbeiten einführt
- Mehrdeutig klingt und du die maßgebliche Spezifikation vor dem Programmieren benötigst

Nutze `@/openspec/AGENTS.md`, um Folgendes zu lernen:

- Wie man Änderungsvorschläge erstellt und anwendet
- Spezifikationsformat und Konventionen
- Projektstruktur und Richtlinien

Behalte diesen verwalteten Block bei, damit 'openspec update' die Anweisungen aktualisieren kann.

<!-- OPENSPEC:END -->

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
