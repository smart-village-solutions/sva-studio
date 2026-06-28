# Agents

## Code-Stil

- TypeScript Strict-Mode mit hoher Typsicherheit
- Framework-agnostische Kernlogik, getrennt von React-Bindings
- Typsicheres Routing mit Search-Params und Path-Params
- Workspace-Protokoll für interne Abhängigkeiten verwenden (`workspace:*`)
- Für serverseitig von Node geladene Workspace-Packages gilt ESM-strikte Schreibweise:
  - relative Runtime-Imports und Re-Exports immer mit expliziter Laufzeitendung (`.js`)
  - reine `import type`-Pfade dürfen typbezogen bleiben, Runtime-Pfade nicht
  - Runtime-Imports auf andere Workspace-Packages müssen im lokalen `package.json` unter `dependencies` stehen

## Komplexitäts- und Ownership-Disziplin

- Ziel ist nicht minimale LOC, sondern minimale langfristige Ownership bei voller Qualität.
- Vor neuer Eigenlogik prüfen:
  - Gibt es bereits eine robuste Lösung im Projekt oder Workspace?
  - Deckt TypeScript/Stdlib, Browser-/Node-Plattform oder Datenbank die Anforderung korrekt ab?
  - Reduziert ein etabliertes externes Package die Ownership gegenüber einer Eigenentwicklung?
  - Erst danach minimale Eigenimplementierung schreiben.
- Neue Dependencies sind zulässig, wenn sie komplexe oder riskante Domänen besser abdecken als lokale Eigenlogik, z. B. Auth, Crypto, Parser, Datums-/Zeitzonenlogik, Accessibility-Primitives, Virtualisierung, i18n, Validierung oder Security-Middleware.
- Keine neue Dependency für triviale Hilfslogik, wenn vorhandene Plattform-, Workspace- oder Design-System-Mittel die Edge Cases ausreichend abdecken.
- Keine Abstraktion ohne belegten Bedarf: keine Interfaces mit einer Implementierung, Factories mit einem Produkt, Provider/Services/Hooks ohne klaren Mehrwert oder Config für Werte, die nicht variieren.
- Vereinfachungen dürfen niemals Testabdeckung, Typklarheit, Security, Accessibility, i18n, Fehlerbehandlung, Datenintegrität, Server-Runtime-Regeln oder bestehende Architekturgrenzen unterlaufen.
- UI-Implementierungen folgen der Reihenfolge: native Browser-/HTML-Funktion, vorhandene shadcn/ui- oder Design-System-Komponente, vorhandene Workspace-Komponente, dann minimale neue Komponente.
- Bei Review und Refactoring gezielt nach entfernbarer Komplexität suchen: handgerollte Standardfunktionen, tote Flexibilität, ungenutzte Layer, vermeidbare Dependencies und spekulative Erweiterbarkeit. Solche Funde sind Ergänzungen zu normalen Correctness-, Security-, Test- und UX-Reviews, kein Ersatz.

## Tipps zur Entwicklungsumgebung

- Dies ist ein pnpm-Workspace-Monorepo; Packages sind nach Funktionalität organisiert
- Nx bietet Caching, affected-Testing, Targeting und parallele Ausführung für mehr Effizienz
- Alle verfügbaren Packages anzeigen: `pnpm nx show projects`
- Ein einzelnes Projekt gezielt starten: `pnpm nx run sva-studio-react:serve`
- Nur betroffene Tests ausführen: `pnpm nx affected --target=test:unit`
- Ausschlussmuster verwenden: `pnpm nx run-many --target=test:unit --exclude="examples/**,e2e/**"`

## Test-Anweisungen

- **Kritisch:** Während der Entwicklung immer Unit- und Type-Tests ausführen – bei Fehlschlägen nicht weitermachen
- **Testarten:** `pnpm test:unit`, `pnpm test:types`, `pnpm test:eslint`, `pnpm test:e2e`
- **Test-Runner-Standard:** Repository-interne Testdateien unter `apps/`, `packages/` und `scripts/` laufen einheitlich über Vitest; neue `node:test`-Fragmente oder `node --test`-Scriptpfade sind nicht zulässig
- **Server-Runtime-Gate:** Für serverseitige Packages zusätzlich `pnpm check:server-runtime` beachten; der Check steckt auch in `pnpm test:types`, soll aber bei Änderungen an `packages/{core,data,monitoring-client,sdk,auth,routing,sva-mainserver}` gezielt früh ausgeführt werden
- **PR-Standard-Gate (bevorzugt):** Vor PR-Erstellung und vor Push nach Möglichkeit `pnpm test:pr` ausführen; dieser Workflow deckt affected Coverage, Coverage-Gate, Complexity-Gate, Integrationstests und den Frontend-Build ab
- **Coverage-PR-Gate:** Wenn gezielt Coverage für einen PR geprüft werden soll, `pnpm test:coverage:pr` verwenden
- **Komplette CI-Suite:** `pnpm test:ci`
- **ESLint ausführen:** `pnpm lint`
- **Shift-left (verbindlich):** Nach jedem abgeschlossenen Änderungsblock sofort die betroffenen Tests ausführen (nicht erst am Ende der Umsetzung)
- **Schnelliterationsphase:** Details, Grenzen und Transparenzpflichten stehen kanonisch in [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md); hier nur anwenden, nicht doppelt ausdefinieren
- **Push-Gate (Mindestanforderung):** Wenn `pnpm test:pr` aus Zeit- oder Ressourcen-Gründen nicht läuft, vor jedem Push mindestens den kleinsten relevanten Gate-Pfad ausführen; `pnpm nx affected --target=test:unit --base=origin/main` ist nur dann der Standard, wenn der gemessene affected-Scope lokal klein und handhabbar ist. Bei Typänderungen zusätzlich den passenden Type-Gate-Pfad ausführen.
- **Arbeitsregel:** Keine weitere Implementierung auf bekannt rotem Teststand
- **Kleinster echte Gate-Pfad zuerst:** Vor Commit oder Push immer den kleinsten tatsächlich relevanten Gate-Pfad ausführen, nicht reflexartig die Vollsuite. Beispiele:
  - UI-/Hook-Fix: betroffener Unit-Run plus Scope-Prüfung für `pnpm nx affected --target=test:unit --base=origin/main`
  - Typänderung: betroffener Type-Run oder `pnpm nx affected --target=test:types --base=origin/main`, wenn der affected-Scope klein ist
  - Skript-/CI-Datei unter `scripts/ci/` oder Root-TS-Skripten: zusätzlich `pnpm exec tsc -p tsconfig.scripts.json --noEmit` oder den passenden Wrapper wie `NX_BASE=origin/main pnpm test:types:affected`
  - Server-Runtime-relevante Änderung: früh `pnpm check:server-runtime`
- **Affected-Scope vor breiten Runs messen:** Vor lokalen `affected`-Unit-Runs gegen `origin/main` zuerst `pnpm nx show projects --affected --withTarget=test:unit --base=origin/main` ausführen. Wenn der Lauf mehr als 6 Projekte, App-UI-/Routes-Matrizen oder offensichtlich PR-fremde Langläufer zieht, gilt er lokal als breiter PR-Gate-Lauf und nicht als Standard-Shift-left-Run.
- **Große/langlaufende PR-Branches:** Bei PR-Fixes auf Branches mit großem Alt-Scope den Fixblock gezielt validieren (Package-Targets, `--testFiles`, relevante Type-/Runtime-/Complexity-Gates) und den ausgelassenen breiten affected-Run transparent benennen. Breite affected-Runs gegen `origin/main` nur vor finaler PR-Freigabe, auf explizite Anforderung oder wenn der gemessene Scope klein ist.
- **Timeouts in PR-fremden Tests:** Wenn ein breiter affected-Run in einem nicht direkt geänderten Bereich timeoutet, den Lauf abbrechen und den einzelnen Test separat reproduzieren. Nur wenn der Einzeltest reproduzierbar rot ist oder der Bereich vom Fix betroffen ist, wird er Teil des aktuellen Fixblocks.
- **Effizienter, zielgerichteter Test-Workflow:**
  1. **Nur affected:** `pnpm nx affected --target=test:unit` (vergleicht mit `main`-Branch)
  2. **Spezifische Packages:** `pnpm nx run sva-studio-react:test:unit`
  3. **Spezifische Dateien via Nx-Target:** `pnpm nx run sva-studio-react:test:unit --testFiles=src/foo.test.tsx --testFiles=src/bar.test.tsx`
  4. **Direkter Vitest-Fallback:** `cd packages/data && npx vitest run tests/xyz.test.tsx`
- **Pro-Tipps:**
  - Mit `npx vitest list` verfügbare Tests vorab ansehen
  - Mit `-t "pattern"` gezielt auf Funktionalität fokussieren
  - Mit `--exclude`-Mustern Unrelevantes überspringen
  - Nx-Package-Targeting mit Vitest-File-Targeting kombinieren (maximale Präzision)
  - Dateifilter für Nx-Testtargets immer explizit per `--testFiles=...` übergeben; `@nx/vitest:test` und die Vitest-Wrapper unter `scripts/ci/run-vitest-target.ts` unterstützen dieses Format

## PR-Anweisungen

- Für die PR-Vorbereitung bevorzugt immer `pnpm test:pr` statt nur einzelner Teilchecks ausführen
- Wenn nur Coverage/Change-Risk für den PR geprüft werden soll, `pnpm test:coverage:pr` verwenden
- Vor Commit und Push den kleinsten relevanten Gate-Pfad gemäß Test-Anweisungen ausführen; `pnpm test:pr` ist der bevorzugte breite Lauf vor PR oder bei unsicherem Änderungsbild
- Bei PR-Fixing und roten CI-Checks ist GitHub die führende Wahrheit: zuerst `gh pr checks <nr>` bzw. die roten Job-Logs prüfen, dann lokal gezielt reproduzieren und nur den kleinsten relevanten Gate-Pfad nachziehen
- Nach jedem Push bei aktivem PR-Fixing den Check-Status erneut prüfen und den nächsten Blocker selbstständig ableiten; Commit und Push dabei nie parallel starten
- Änderungen an den relevanten Stellen testen
- Bei neuen Features die passende Doku im Verzeichnis `docs/` aktualisieren
- Bei Architektur-/Systemänderungen die relevanten arc42-Abschnitte unter `docs/architecture/` aktualisieren und im PR verlinken
- Einstiegspunkt für Architekturdoku ist `docs/architecture/README.md` (Abschnitte 1-12)
- Für Doku-Qualität und Doku-Abdeckung bei Proposals/PRs steht der Agent `documentation.agent.md` unter `.github/agents/` bereit
- Für jede Code-Änderung Tests hinzufügen oder anpassen
- Interne Doku-Links relativ zum Ordner `docs/` schreiben (z. B. `./guide/data-loading`)

## Review-Agents

- Die Agent-Definitionen unter `.github/agents/` bleiben die kanonische Quelle und sind zusätzlich als Codex-Agents über `.codex/config.toml` registriert.
- Für normale PRs und Code-Reviews steht `pr-review-orchestrator.agent.md` unter `.github/agents/` bereit.
- Für das iterative Fixen von PRs (Threads, Tests, Quality Gates) steht `pr-fixer.agent.md` unter `.github/agents/` bereit.
- Für Proposal-Reviews bleibt `proposal-review-orchestrator.agent.md` der Einstiegspunkt.
- Für Rollouts (Image-Build, quantum-cli Deploy, Keycloak-IAM, Smoke-Tests) steht `rollout-operator.agent.md` unter `.github/agents/` bereit.
- Spezialisierte Reviewer ergänzen die bestehende Matrix für:
  - Testqualität (`test-quality.agent.md`)
  - i18n & Content (`i18n-content.agent.md`)
  - User Journey & Usability (`user-journey-usability.agent.md`)
  - Performance (`performance.agent.md`)
- Die zentrale Trigger-Matrix und Abgrenzung liegt unter `docs/development/review-agent-governance.md`.

## Repository File Placement (Enforced)

- Root-Level Markdown ist gesperrt (Ausnahme: `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `DEBUGGING.md`, `DEVELOPMENT_RULES.md`, `AGENTS.md`)
- Debug-Skripte gehören ausschließlich nach `scripts/debug/auth/` oder `scripts/debug/otel/`
- Operative Reports gehören nach `docs/reports/`
- Staging-Dokumente gehören nach `docs/staging/YYYY-MM/`
- PR-Dokumente gehören nach `docs/pr/<nummer>/`
- Legacy-Dateinamen wie `docs/STAGING-TODOS.md`, `docs/pr45-*.md`, `docs/pr-45-*.md` sind verboten
- Verbindlicher Check: `pnpm check:file-placement`
- Für lokale Hook-Aktivierung: `pnpm hooks:install`

## Package-Struktur

**Core packages:**

- `packages/core/` - Framework-agnostische Kernlogik
- `packages/data/` - Data-Loading und State-Management

**Tooling:**

- `packages/.../` - ...

**Dependencies:**

- Verwendet Workspace-Protokoll (`workspace:*`) - core → framework → start packages

## Anforderungen an die Umgebung

- **Node.js** - Erforderlich für die Entwicklung
- **pnpm** - Package-Manager (erforderlich für Workspace-Features)

## Wichtige Architektur-Patterns

- **Typsicherheit**: Umfangreiches TypeScript für typsicheres Routing
- **Framework-agnostisch**: Kernlogik getrennt von Framework-Bindings
- **Code-basiertes Routing**: Unterstützung für code-basiertes Routing (dynamische Routen aus Plugins)
- **Bundler vs. Node-ESM**: `moduleResolution: "Bundler"` ist für das Dev-Tooling bequem, ersetzt aber nicht die strengeren Node-ESM-Regeln für gebaute `dist/*.js`-Packages

## Development Rules

Die verbindlichen Entwicklungsrichtlinien liegen unter [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md). Alle Agenten-Reviews sind im Zweifel an diesen Regeln auszurichten.

### Kritische Regeln (Non-Negotiable)

1. **Texte & Übersetzungen**: Keine hardcoded Strings, immer `t('key')` verwenden
2. **Logging**: Server-Code nutzt den Server-Runtime-Logger (`@sva/server-runtime`), nie `console.*`
   Development: Console + lokale Dev-Konsole sind erlaubt; Production bleibt OTEL-first ohne Console-Ausgabe
3. **Security**: Input-Validation client+server, PII-Schutz in Logs
4. **CSS**: Design-System verwenden, keine inline-styles (außer dynamische Daten)
5. **UI-Standard**: Neue UI mit `shadcn/ui` bauen; keine parallelen Basis-Komponenten ohne dokumentierte Architekturentscheidung
6. **Accessibility**: WCAG 2.1 AA compliant
7. **Docs**: Alle Änderungen müssen relevante Dokumentation aktualisieren (Code, Architektur, Guides)
8. **Server-Package-Runtime**: Bei serverseitigen Workspace-Packages keine endungslosen relativen Runtime-Imports; `pnpm check:server-runtime` muss für entsprechende Änderungen grün bleiben
9. **Action-IDs**: Autorisierbare Actions immer fully-qualified als `<namespace>.<actionName>` modellieren; keine neuen Kurzformen ohne Namespace, Plugins nur im eigenen Namespace
10. **DB-Schema präsent halten**: Vor DB-/Migrationsänderungen `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` prüfen; nach jeder Schemaänderung den Snapshot und die Doku fortschreiben

**Details:** Siehe [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)

### Docs Regeln

- **Ordner**: Alle Dokumente müssen in den entsprechenden Unterordnern von `docs/` liegen (z.B. `docs/architecture/`, `docs/guides/`, `docs/reports/`, `docs/staging/`, `docs/pr/`)
- **Namenskonvention**: Dokumente müssen beschreibende Namen haben, die den Inhalt klar widerspiegeln (z.B. `docs/development/monitoring-stack.md`)
- **Sprache**: Alle Dokumente müssen auf Deutsch verfasst sein und Umlaute korrekt verwenden (ä, ö, ü, ß statt ae, oe, ue, ss)
- **Formatierung**: Markdown-Formatierung muss konsistent sein (z.B. Überschriften, Listen, Codeblöcke) und den Inhalt klar strukturieren
- **Aktualität**: Alle Dokumente müssen aktuell gehalten werden; veraltete Informationen müssen entfernt oder aktualisiert werden
- **DB-Schema-Snapshot**: Änderungen an Tabellen, Spalten, Constraints, Indizes, RLS, Triggern oder DB-Funktionen müssen immer auch `docs/development/studio-db-schema-final.sql` und bei Bedarf `docs/development/studio-db-schema.md` aktualisieren

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
- Pass file filters for Nx test targets with `--testFiles=...` instead of positional arguments after `--`; this applies to both `@nx/vitest:test` and the Vitest run-command wrappers backed by `scripts/ci/run-vitest-target.ts`
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
