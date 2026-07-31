---
name: nx-workspace-patterns
description: Konfiguriere, überprüfe und optimiere Nx-23-Workspaces mit pnpm. Verwende diesen Skill bei Änderungen an nx.json, Projekt-Targets, Caching, Inputs, Abhängigkeitsgrenzen, Vite/Vitest/Playwright-Integration oder affected-Workflows.
---

# Nx Workspace Patterns

## Vorgehen

1. Lies `nx.json`, das betroffene `project.json` bzw. `package.json` und die Root-Skripte.
2. Ermittle vor einer Änderung die vorhandenen Projekte, Targets und Abhängigkeiten:

   ```bash
   pnpm nx show projects
   pnpm nx show project <projekt>
   pnpm nx graph --file=tmp/nx-graph.html
   ```

3. Verwende die vorhandenen Plugins und Executors. Prüfe bei unbekannten Optionen zuerst `pnpm nx <befehl> --help` oder die Version-23-Dokumentation.
4. Begrenze Validierungen auf das veränderte Target. Prüfe vor breiten affected-Läufen zuerst dessen Umfang.

## Workspace-Konventionen

- Nutze `pnpm nx`, nie eine globale Nx-Installation oder `npx nx`.
- Der Workspace verwendet `apps/` und `packages/`, pnpm und Nx 23.
- Relevante Targets sind unter anderem `build`, `lint`, `test:unit`, `test:coverage`, `test:integration`, `test:types`, `typecheck` und `check:runtime`.
- Dateifilter für Vitest-Targets immer als `--testFiles=<pfad>` übergeben.
- Behalte die deklarativen `targetDefaults`, `namedInputs` und `outputs` in `nx.json` konsistent. Caching nur aktivieren, wenn der Target-Lauf vollständig deterministisch ist.
- Nutze `workspace:*` für interne Paketabhängigkeiten. Halte die Projektgraph-Grenzen über ESLint und vorhandene Repository-Checks ein.

## Affected und CI

```bash
pnpm nx show projects --affected --withTarget=test:unit --base=origin/main
pnpm nx affected --target=test:unit --base=origin/main
pnpm nx affected --target=typecheck --base=origin/main
```

- Setze in CI immer einen verlässlichen Base- und Head-SHA; ein flacher Checkout verfälscht affected-Ergebnisse.
- Nutze lokale, gezielte Tests während der Entwicklung. Einen breiten affected-Lauf nur ausführen, wenn sein gemessener Umfang klein oder explizit gewünscht ist.
- Verwende `pnpm nx reset` nur zur Fehlerdiagnose bei einem offensichtlich veralteten Nx-Daemon- oder Cache-Zustand; erkläre den Grund im Ergebnis.

## Moderne Konfiguration

- Bevorzuge Plugin-inferenzierte Targets und projektspezifische `project.json`-Konfiguration gegenüber veralteten `workspace.json`- und `tasksRunnerOptions`-Mustern.
- Für Vite, Vitest und Playwright die installierten Plugins `@nx/vite`, `@nx/vitest` und `@nx/playwright` verwenden.
- Modellieren von Task-Abhängigkeiten mit `dependsOn`; Hashing mit präzisen `inputs` und `namedInputs`.
- `cache: false` für E2E-, Coverage- und andere Läufe, deren Ergebnisse nicht sicher wiederverwendbar sind.
- Nx Cloud nur konfigurieren oder ändern, wenn die Aufgabe dies verlangt. Keine Zugangsdaten in `nx.json` eintragen.

## Prüfung

Nach Änderungen an Nx-Konfiguration mindestens das betroffene Target und eine Konfigurationsabfrage ausführen:

```bash
pnpm nx show project <projekt>
pnpm nx run <projekt>:<target>
```

Bei Änderungen an Tests oder Type-Targets zusätzlich den kleinsten passenden Test- bzw. Type-Gate ausführen. Bei serverseitigen Paketen früh `pnpm check:server-runtime` ausführen.

## Quellen

- https://nx.dev/docs/reference/nx-json
- https://nx.dev/docs/features/ci-features/affected
- https://nx.dev/docs/features/cache-task-results
