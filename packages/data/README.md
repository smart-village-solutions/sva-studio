# @sva/data

Kleiner, framework-agnostischer HTTP-DataClient fuer die Anbindung an externe Backends.
Aktuell stellt das Paket einen `GET`-Client mit In-Memory-Cache bereit.

## Lokale DB-Targets (Nx)

- `pnpm nx run data:db:up` startet Postgres lokal via Docker Compose
- `pnpm nx run data:db:status` zeigt den Service-Status
- `pnpm nx run data:db:migrate` führt SQL-Up-Migrationen aus `packages/data/migrations/up/*.sql` aus
- `pnpm nx run data:db:migrate:down` führt SQL-Down-Migrationen aus `packages/data/migrations/down/*.sql` aus
- `pnpm nx run data:db:migrate:validate` prüft den Zyklus `up -> down -> up`
- `pnpm nx run data:db:seed` führt idempotente IAM-Seeds aus `packages/data/seeds/*.sql` aus
- `pnpm nx run data:db:test:seeds` prüft Seed-Idempotenz (zweifache Ausführung + Erwartungswerte)
- `pnpm nx run data:db:test:encryption` prüft PII-At-Rest-Verschlüsselung via direkter SQL-Sicht
- `pnpm nx run data:db:test:rls` validiert Instanzisolation und Fail-Closed-Verhalten der RLS-Baseline
- `pnpm nx run data:db:reset` entfernt lokalen Postgres-Container und Volume

## Tests

- `pnpm nx run data:test:unit` führt Strict-TS Unit-Tests für `src/iam/*` aus
- `pnpm nx run data:test:integration` führt den Seed-Integrationscheck gegen lokale Postgres-DB aus

## API

- `createDataClient({ baseUrl, cacheTtlMs? })`
	- `baseUrl`: Basis-URL des Zielsystems
	- `cacheTtlMs`: Optional, Default `30_000`

Rueckgabe:

- `get<T>(path, init?)` -> `Promise<T>`

## Beispiel

```ts
import { createDataClient } from '@sva/data';

const client = createDataClient({ baseUrl: 'https://example.invalid' });

type Health = { ok: boolean };
const health = await client.get<Health>('/health');
```
