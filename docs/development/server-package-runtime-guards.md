# Server-Package-Runtime-Guards

Für Workspace-Packages, deren `dist/*.js` direkt von Node als ESM geladen wird, gelten im Repository zusätzliche Laufzeitregeln.

## Problemkontext

Im Monorepo treffen zwei Welten aufeinander:

- **Entwicklungs- und Tooling-Pfade** mit TypeScript, Vite, `tsx`, Vitest und `moduleResolution: "Bundler"`
- **Runtime-Pfade** mit Node, das gebaute `dist/*.js` als echtes ESM lädt

Diese Welten verhalten sich nicht identisch. Ein Import, der in Vite oder `tsx` problemlos funktioniert, kann in Node-ESM für ein gebautes Package trotzdem scheitern.

Wichtig ist daher:

- TypeScript ist hier die **Quellsprache**
- Node ist die **Laufzeit**
- für relative Runtime-Imports entscheidet deshalb Node-ESM, nicht das bequemere Bundler-Verhalten

## Regeln

- Relative Runtime-Imports und Re-Exports in `src/` müssen eine explizite Laufzeitendung tragen, in der Regel `.js`.
- Runtime-Imports auf andere Workspace-Packages müssen im jeweiligen `package.json` unter `dependencies` deklariert sein.
- Die gebauten `dist`-Entrypoints müssen sich per Node-Import tatsächlich laden lassen.

## Was als Runtime-Import zählt

Als Runtime-Import gelten insbesondere:

- `import { foo } from './foo.js'`
- `export * from './bar.js'`
- `await import('./baz.js')`

Nicht darunter fallen reine Typimporte:

```ts
import type { Foo } from './types.js';
```

Der Guard ignoriert `import type` bewusst, weil diese Pfade nicht zur Node-Runtime gehören.

## Was wir künftig vermeiden wollen

Typische Fehlmuster:

```ts
// falsch
export * from './server';
import { config } from '../config';
import { toJsonErrorResponse } from '@sva/server-runtime';
```

Wenn `@sva/server-runtime` hier zur Laufzeit gebraucht wird, muss zusätzlich das lokale `package.json` diese Dependency deklarieren.

Korrektes Muster:

```ts
export * from './server.js';
import { config } from '../config.js';
import { toJsonErrorResponse } from '@sva/server-runtime';
```

und im `package.json`:

```json
{
  "dependencies": {
    "@sva/server-runtime": "workspace:*"
  }
}
```

`@sva/sdk` ist aus dem aktiven Workspace entfernt; bestehende Runtime-Vertraege verwenden direkt `@sva/server-runtime`, `@sva/core` oder `@sva/monitoring-client`.

## Warum diese Guards nötig sind

Das Monorepo nutzt in [`tsconfig.base.json`](../../tsconfig.base.json) `moduleResolution: "Bundler"`. Diese Einstellung ist für Vite, `tsx` und ähnliche Tooling-Pfade bequem, sie erzwingt aber nicht automatisch die strengeren Node-ESM-Regeln für gebaute `dist/*.js`-Dateien.

Ohne zusätzliche Guards können deshalb Fehler erst spät auffallen:

- relative Imports ohne `.js` funktionieren im Dev-Tooling, brechen aber in Node-ESM zur Laufzeit,
- Workspace-Imports funktionieren über Pfad-Aliases im Source-Code, scheitern aber im gebauten Package ohne deklarierte Dependency.

## Betroffene Packages

Der Guard ist aktuell für diese serverseitig relevanten Workspace-Packages verbindlich:

- `packages/core`
- `packages/data`
- `packages/monitoring-client`
- `packages/auth-runtime`
- `packages/iam-admin`
- `packages/iam-governance`
- `packages/instance-registry`
- `packages/routing`
- `packages/sva-mainserver`

## Technische Umsetzung

Der Guard liegt in [`scripts/ci/check-server-package-runtime.ts`](../../scripts/ci/check-server-package-runtime.ts).

Er prüft pro Package:

- statisch die Runtime-Imports in `src/`,
- sowie per Smoke-Test die exportierten `dist`-Entrypoints aus `package.json`.

Betroffene Packages haben dafür ein Nx-Target `check:runtime`.

Zentral ausführen:

```bash
pnpm check:server-runtime
```

Im regulären Typ-/Build-Gate läuft der Guard zusätzlich über `pnpm test:types`.

## Erwartung an Menschen und Agenten

- Bei Änderungen an serverseitigen Packages muss das Thema aktiv mitgedacht werden, nicht erst nach einem Laufzeitfehler.
- Reviews müssen Imports, Re-Exports und `package.json`-Dependencies gemeinsam betrachten.
- Agenten und KI-gestützte Änderungen dürfen keine endungslosen relativen Runtime-Imports einführen.

## Wenn der Guard fehlschlägt

1. Prüfen, ob der gemeldete Pfad ein echter Runtime-Import ist.
2. Relative Pfade auf `.js` umstellen.
3. Fehlende Workspace-Dependencies im lokalen `package.json` ergänzen.
4. Package neu bauen.
5. Guard erneut ausführen.

Empfohlene Reihenfolge:

```bash
pnpm nx run <projekt>:build
pnpm nx run <projekt>:check:runtime
pnpm check:server-runtime
```
