# Contributing

Wir freuen uns über Pull Requests von allen. Wir erwarten von Beitragenden, dass sie bei der Einreichung von Code oder Kommentaren unseren
[Code of Conduct](./CODE_OF_CONDUCT.md) befolgen.

## Lokales Setup

### Voraussetzungen

- Node.js in der aktuellen LTS-Linie, empfohlen über [`.nvmrc`](./.nvmrc) oder [`.node-version`](./.node-version)
- `pnpm` gemäß `packageManager` in [package.json](./package.json)

### Installation

Mit `nvm`:

```bash
nvm use
corepack enable
pnpm install
```

Alternativ mit einem Tool, das `.node-version` unterstützt:

```bash
corepack enable
pnpm install
```

### Nützliche Workspace-Kommandos

```bash
pnpm nx show projects
pnpm nx run sva-studio-react:serve
pnpm nx affected --target=test:unit
pnpm nx affected --target=test:types
```

## Commits

Bitte achte auf detaillierte und aussagekräftige Commit-Messages und folge bestehenden Commit-Konventionen, z. B.: https://www.conventionalcommits.org/de/v1.0.0/

## Branching & PR-Target

Vor dem Erstellen eines Branches muss entschieden werden, ob die Arbeit von `main` oder von einem bestehenden (noch nicht gemergten) Branch abzweigt.
Das PR-Target muss immer dem Basis-Branch entsprechen (bei gestapelten Branches also auf den direkten Vorgänger).

Die verbindliche Entscheidungslogik inkl. Beispiele und Stack-Workflow steht unter
[DEVELOPMENT_RULES.md - 7. Branching & PR Workflow](./DEVELOPMENT_RULES.md#7-branching--pr-workflow).

## Entwicklungs- und Qualitätsregeln

- Verbindliche Projektregeln stehen in [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md).
- TypeScript läuft im Strict Mode; neue Logik soll typsicher und nachvollziehbar bleiben.
- Keine weiteren Implementierungsschritte auf bekannt rotem Teststand.
- Bei Texten keine Hardcodes, sondern i18n-Keys verwenden.
- Server-Code nutzt den SDK-Logger statt `console.*`.

## Test-Workflow

Vor einem Pull Request mindestens die für deine Änderung relevanten Checks lokal ausführen.

Typische Kommandos:

```bash
pnpm test:types
pnpm test:unit
pnpm test:eslint
pnpm test:e2e
```

Für präzisere Läufe im Nx-Workspace:

```bash
pnpm nx affected --target=test:unit --base=origin/main
pnpm nx affected --target=test:types --base=origin/main
pnpm nx run sva-studio-react:test:unit
```

Weiterführende Hinweise:

- Testing/Coverage: [docs/development/testing-coverage.md](./docs/development/testing-coverage.md)
- App-E2E/Integration: [docs/development/app-e2e-integration-testing.md](./docs/development/app-e2e-integration-testing.md)

## Pull Requests

Vor dem Öffnen eines PRs prüfen:

- Relevante Tests und Typechecks sind grün.
- Dokumentation unter `docs/` wurde aktualisiert, wenn Verhalten, Architektur oder Betrieb betroffen sind.
- Breaking Changes sind im PR klar benannt.
- Sicherheitsrelevante Änderungen dokumentieren Validierung, Risiko und ggf. Folgemaßnahmen.

## Issues und Vorschläge

- Für Bugs und Feature-Wünsche bitte die vorhandenen GitHub-Issue-Templates verwenden.
- Reproduzierbare Beispiele, betroffene Umgebungen und relevante Logs verkürzen Rückfragen deutlich.
- Sicherheitslücken bitte nicht öffentlich melden, sondern gemäß Security-Policy.

## Optionale VS-Code-Erweiterungen

Für ein konsistenteres lokales Setup gibt es optionale Empfehlungen in [`.vscode/extensions.json`](./.vscode/extensions.json).
Die Empfehlungen sind ausdrücklich freiwillig und keine Voraussetzung für Beiträge.
