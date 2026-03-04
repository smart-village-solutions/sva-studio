# @sva/data

Data-Layer für SVA Studio – stellt einen framework-agnostischen HTTP-DataClient mit In-Memory-Cache sowie SQL-basierte IAM-Repositories bereit.

## Architektur-Rolle

`@sva/data` bildet die Datenschicht zwischen Kernlogik und persistenten Backends. Das Paket enthält:

- Einen generischen **HTTP-DataClient** für REST-Anbindungen
- **IAM-Repositories** mit SQL-Operationen für Identity & Access Management
- **Seed-Pläne** für reproduzierbare IAM-Testdaten (7 Personas, 13 Permissions)

```
@sva/core
  ↑
  @sva/data
```

**Abhängigkeit:** `@sva/core` (workspace) – für IAM-Typen und Core-Version.

## Export

| Pfad | Beschreibung |
| --- | --- |
| `@sva/data` | DataClient, IAM-Repositories, Seed-Pläne, IAM-Typen |

## API

### DataClient

Leichtgewichtiger HTTP-Client mit TTL-basiertem In-Memory-Cache.

```ts
import { createDataClient } from '@sva/data';

const client = createDataClient({
  baseUrl: 'https://api.example.invalid',
  cacheTtlMs: 30_000, // Optional, Default: 30 Sekunden
});

type Health = { ok: boolean };
const health = await client.get<Health>('/health');
```

**Optionen:**
- `baseUrl` – Basis-URL des Zielsystems
- `cacheTtlMs` – Cache-TTL in Millisekunden (Default: `30_000`)

**Methoden:**
- `get<T>(path, init?)` → `Promise<T>` – GET-Request mit automatischem Caching

### IAM-Repositories

SQL-basierte Repositories für IAM-Entitäten. Alle Operationen nutzen `ON CONFLICT ... DO UPDATE` (idempotent).

```ts
import { IamSeedRepository } from '@sva/data';

// SqlExecutor-Abstraktion für flexible DB-Anbindung
const repo = new IamSeedRepository(sqlExecutor);
```

**Operationen:** Upsert für Instances, Organizations, Roles, Permissions, Accounts, Memberships, Role-Assignments.

### Seed-Plan

Vorkonfigurierter Seed-Plan mit 7 Personas und vollständiger Rollenzuordnung.

```ts
import { getPersonaSeed } from '@sva/data';

const admin = getPersonaSeed('system_admin');
```

**Personas:** `system_admin`, `app_manager`, `feature_manager`, `interface_manager`, `designer`, `editor`, `moderator`

**Permissions (13):** `iam.*`, `content.*`, `integration.manage`, `feature.toggle`

### IAM-Typen

```ts
import type {
  PersonaKey,        // 7 Persona-Schlüssel
  PermissionKey,     // 13 Permission-Schlüssel
  PersonaSeed,       // Persona-Seed-Datenstruktur
  IamSeedContext,    // Seed-Kontext
  IamSeedPlan,       // Vollständiger Seed-Plan
  PersonaScope,      // 'instance' | 'org'
  MfaPolicy,         // 'required' | 'recommended' | 'optional'
} from '@sva/data';
```

## Projektstruktur

```
src/
├── index.ts                   # Haupt-Export (DataClient + IAM Re-Exports)
└── iam/
    ├── repositories.ts        # SQL-basierte IAM-Repositories (225 Zeilen)
    ├── repositories.test.ts   # Repository-Tests
    ├── seed-plan.ts           # 7 Personas mit Rollenzuordnung
    ├── seed-plan.test.ts      # Seed-Plan-Tests
    └── types.ts               # IAM-Datenmodell
```

## Nx-Targets

### Datenbank-Verwaltung

| Target | Beschreibung |
| --- | --- |
| `pnpm nx run data:db:up` | Startet Postgres lokal via Docker Compose |
| `pnpm nx run data:db:status` | Zeigt den Service-Status |
| `pnpm nx run data:db:migrate` | Führt SQL-Up-Migrationen aus `migrations/up/*.sql` aus |
| `pnpm nx run data:db:migrate:down` | Führt SQL-Down-Migrationen aus `migrations/down/*.sql` aus |
| `pnpm nx run data:db:migrate:validate` | Prüft den Zyklus `up → down → up` |
| `pnpm nx run data:db:seed` | Führt idempotente IAM-Seeds aus `seeds/*.sql` aus |
| `pnpm nx run data:db:reset` | Entfernt lokalen Postgres-Container und Volume |

### Tests

| Target | Beschreibung |
| --- | --- |
| `pnpm nx run data:test:unit` | Strict-TS Unit-Tests für `src/iam/*` |
| `pnpm nx run data:test:integration` | Seed-Integrationscheck gegen lokale Postgres-DB |
| `pnpm nx run data:db:test:seeds` | Prüft Seed-Idempotenz (zweifache Ausführung) |
| `pnpm nx run data:db:test:encryption` | Prüft PII-At-Rest-Verschlüsselung via SQL |
| `pnpm nx run data:db:test:rls` | Validiert Instanzisolation (RLS Fail-Closed) |

## Verwandte Dokumentation

- [Bausteinsicht (arc42 §5)](../../docs/architecture/05-building-block-view.md)
- [IAM-Datenklassifizierung](../../docs/architecture/iam-datenklassifizierung.md)
- [ADR-014: Postgres NOTIFY Cache-Invalidierung](../../docs/adr/ADR-014-postgres-notify-cache-invalidierung.md)
- [Postgres-Setup](../../docs/development/postgres-setup.md)
