# Agents

## Code-Stil

- TypeScript Strict-Mode mit hoher Typsicherheit
- Framework-agnostische Kernlogik, getrennt von React-Bindings
- Typsicheres Routing mit Search-Params und Path-Params
- Workspace-Protokoll für interne Abhängigkeiten verwenden (`workspace:*`)

## Tipps zur Entwicklungsumgebung

- Dies ist ein pnpm-Workspace-Monorepo; Packages sind nach Funktionalität organisiert
- Nx bietet Caching, affected-Testing, Targeting und parallele Ausführung für mehr Effizienz
- Alle verfügbaren Packages anzeigen: `npx nx show projects`
- Ein einzelnes Projekt gezielt starten: `npx nx run sva-studio-react:serve`
- Nur betroffene Tests ausführen: `npx nx affected --target=test:unit`
- Ausschlussmuster verwenden: `npx nx run-many --target=test:unit --exclude="examples/**,e2e/**"`

## Test-Anweisungen

- **Kritisch:** Während der Entwicklung immer Unit- und Type-Tests ausführen – bei Fehlschlägen nicht weitermachen
- **Testarten:** `pnpm test:unit`, `pnpm test:types`, `pnpm test:eslint`, `pnpm test:e2e`, `pnpm test:build`
- **Komplette CI-Suite:** `pnpm test:ci`
- **Formatierung beheben:** `pnpm format`
- **Effizienter, zielgerichteter Test-Workflow:**
  1. **Nur affected:** `npx nx affected --target=test:unit` (vergleicht mit `main`-Branch)
  2. **Spezifische Packages:** `npx nx run sva-studio-react:test:unit`
  3. **Spezifische Dateien:** `cd packages/data && npx vitest run tests/xyz.test.tsx`
- **Pro-Tipps:**
  - Mit `npx vitest list` verfügbare Tests vorab ansehen
  - Mit `-t "pattern"` gezielt auf Funktionalität fokussieren
  - Mit `--exclude`-Mustern Unrelevantes überspringen
  - Nx-Package-Targeting mit Vitest-File-Targeting kombinieren (maximale Präzision)

## PR-Anweisungen

- Vor dem Commit immer `pnpm test:eslint`, `pnpm test:types` und `pnpm test:unit` ausführen
- Änderungen an den relevanten Stellen testen
- Bei neuen Features die passende Doku im Verzeichnis `docs/` aktualisieren
- Bei Architektur-/Systemänderungen die relevanten arc42-Abschnitte unter `docs/architecture/` aktualisieren und im PR verlinken
- Einstiegspunkt fuer Architekturdoku ist `docs/architecture/README.md` (Abschnitte 1-12)
- Für jede Code-Änderung Tests hinzufügen oder anpassen
- Interne Doku-Links relativ zum Ordner `docs/` schreiben (z. B. `./guide/data-loading`)

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

## Development Rules

Die verbindlichen Entwicklungsrichtlinien liegen unter [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md). Alle Agenten-Reviews sind im Zweifel an diesen Regeln auszurichten.

### Kritische Regeln (Non-Negotiable)

1. **Texte & Übersetzungen**: Keine hardcoded Strings, immer `t('key')` verwenden
2. **Logging**: Server-Code nutzt SDK Logger (`@sva/sdk`), nie `console.*`
3. **Security**: Input-Validation client+server, PII-Schutz in Logs
4. **CSS**: Design-System verwenden, keine inline-styles (außer dynamische Daten)
5. **Accessibility**: WCAG 2.1 AA compliant

**Details:** Siehe [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)

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

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->
