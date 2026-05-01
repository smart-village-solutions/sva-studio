# @sva/data-client

`@sva/data-client` ist ein TypeScript-Library-Package für den Aufbau eines HTTP-Clients mit optionaler Zod-Runtime-Validierung und einem in-memory GET-Cache.

## Architektur-Rolle

Das Paket exportiert seine Rollen explizit als `dataClientPackageRoles`:

- `http-client`
- `schema-validation`
- `browser-cache`

Die zentrale Factory `createDataClient` kapselt den lesenden Datenzugriff über HTTP-GET und liefert zusätzlich die aus `@sva/core` importierte `coreVersion` zurück.

## Öffentliche API

Die öffentliche API wird über [`src/index.ts`](./src/index.ts) exportiert.

- `dataClientVersion`: aktuell `0.0.1`
- `dataClientPackageRoles`: readonly Rollenliste des Pakets
- `type DataClientPackageRole`: `'http-client' | 'schema-validation' | 'browser-cache'`
- `type DataClientOptions`: Konfiguration mit `baseUrl`, optionalem `cacheTtlMs` und optionalem `logger`
- `createDataClient(options)`: erzeugt ein Objekt mit `coreVersion` und `get`

Das von `createDataClient` zurückgegebene `get`-API verhält sich laut Implementierung wie folgt:

- bildet die Request-URL aus `baseUrl` und `path`
- setzt ohne vorhandenen Header standardmäßig `accept: application/json`
- cached erfolgreiche GET-Antworten in einer prozessweiten `Map`
- scoped Cache-Einträge nach URL und normalisierten Request-Headern
- validiert Payloads optional mit einem übergebenen Zod-Schema
- protokolliert Cache-Hits, Cache-Misses, Request-Start, Request-Fehler und Schemafehler über den konfigurierbaren Logger
- wirft bei nicht erfolgreichen Responses einen Fehler im Format `DataClient GET <path> failed with <status>`
- gibt bei Aufrufen ohne Schema einmalig pro Pfad eine Prozesswarnung mit dem Code `SVA_DATA_RUNTIME_SCHEMA` aus, sofern `process.emitWarning` verfügbar ist

## Nutzung und Integration

Direkte Nutzung:

```ts
import { createDataClient } from '@sva/data-client';
import { z } from 'zod';

const client = createDataClient({
  baseUrl: 'https://example.invalid',
  cacheTtlMs: 30_000,
});

const user = await client.get(
  '/users/1',
  z.object({
    age: z.number(),
    name: z.string(),
  })
);
```

Integrationshinweise aus dem Workspace:

- Das Package erwartet eine verfügbare `fetch`-Implementierung.
- `@sva/data` re-exportiert `createDataClient` sowie den Typ `DataClientOptions` und kann damit als Kompatibilitäts-Barrel dienen.
- Die Laufzeitabhängigkeiten sind `@sva/core` und `zod`.

## Projektstruktur

```text
packages/data-client/
├── package.json
├── project.json
├── src/
│   ├── index.test.ts
│   └── index.ts
├── tsconfig.json
├── tsconfig.lib.json
└── vitest.config.ts
```

- [`src/index.ts`](./src/index.ts): öffentliche API und Implementierung
- [`src/index.test.ts`](./src/index.test.ts): Unit-Tests für Rollen, Caching, Header-Scoping und Schemafehler
- [`project.json`](./project.json): Nx-Targets
- [`vitest.config.ts`](./vitest.config.ts): Vitest-Konfiguration mit Alias auf `@sva/core`

## Nx-Konfiguration

Das Projekt ist in Nx als Library `data-client` mit `sourceRoot` `packages/data-client/src` und den Tags `scope:data-client` sowie `type:lib` registriert.

| Target | Kommando laut `project.json` | Zweck |
| --- | --- | --- |
| `build` | `tsc -p packages/data-client/tsconfig.lib.json` | Erstellt `dist` |
| `check:runtime` | `pnpm exec node --import tsx scripts/ci/check-server-package-runtime.ts --package data-client` | Prüft Runtime-Regeln für das Package |
| `lint` | ESLint über `packages/data-client/src/**/*.{ts,tsx,js,jsx}` | Linting des Source-Verzeichnisses |
| `test:unit` | `pnpm exec vitest run --reporter=verbose --config vitest.config.ts --passWithNoTests` | Führt Unit-Tests aus |
| `test:types` | `tsc -p packages/data-client/tsconfig.lib.json --noEmit` | Typprüfung |
| `test:coverage` | `pnpm exec vitest run --coverage --reporter=verbose --config vitest.config.ts --passWithNoTests` | Coverage-Lauf der Unit-Tests |

## Verwandte Dokumentation

- [`../data/README.md`](../data/README.md) beschreibt `@sva/data` als Kompatibilitäts-Barrel und verweist auf `@sva/data-client` als Zielpackage für client-sicheren HTTP-Zugriff.
- [`../../docs/monorepo.md`](../../docs/monorepo.md) führt `data-client` als Nx-Library im Workspace.
- [`../../docs/architecture/04-solution-strategy.md`](../../docs/architecture/04-solution-strategy.md) ordnet `@sva/data-client` dem Browser-Datenzugriff zu.
- [`../../docs/architecture/05-building-block-view.md`](../../docs/architecture/05-building-block-view.md) beschreibt den Baustein `Data Client und Data Repositories`.
- [`../../docs/architecture/package-zielarchitektur.md`](../../docs/architecture/package-zielarchitektur.md) dokumentiert die Zielgrenze von `@sva/data-client` innerhalb der Paketarchitektur.
