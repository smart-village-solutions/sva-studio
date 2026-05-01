# @sva/data-repositories

`@sva/data-repositories` ist eine serverseitige Library für Repository-Fassaden, DB-nahe Operationen und migrationsnahe Typen rund um IAM-, Instanz- und Medien-Persistenz.

## Architektur-Rolle

Laut Zielarchitektur bündelt das Paket serverseitige Repositories, migration-nahe Typen und DB-Zugriffe. In der Bausteinsicht ist es der DB-nahe Gegenpart zu `@sva/data-client`: client-sichere HTTP-Zugriffe bleiben dort, serverseitige Repository-Fassaden liegen hier.

Im Quellcode ist diese Rolle zusätzlich über `dataRepositoriesPackageRoles` beschrieben:

- `postgres-repositories`
- `migration-adjacent-types`
- `server-data-access`

## Öffentliche API

Das Paket veröffentlicht zwei Entry-Points:

- `@sva/data-repositories`
  - `createIamSeedRepository`
  - `createInstanceIntegrationRepository`
  - `createInstanceRegistryRepository`
  - `createMediaRepository`
  - `iamSeedPlan`
  - `iamSeedStatements`
  - `instanceIntegrationStatements`
  - `mediaStatements`
  - zugehörige Typen für SQL-Ausführung, IAM-Seeding, Instance-Integrationen, Instance-Registry und Medien
- `@sva/data-repositories/server`
  - `loadInstanceIntegrationRecord`
  - `saveInstanceIntegrationRecord`
  - `resetInstanceIntegrationServerState`
  - `loadInstanceByHostname`
  - `loadInstanceById`
  - `loadInstanceAuthClientSecretCiphertext`
  - `loadTenantAdminClientSecretCiphertext`
  - `invalidateInstanceRegistryHost`
  - `resetInstanceRegistryCache`
  - `resetInstanceRegistryServerState`

Die Server-API verwendet `pg`-Pools und den Logger aus `@sva/server-runtime`.

## Nutzung und Integration

Die Library ist als reines Server-Paket angelegt (`type: module`) und exportiert `.` sowie `./server`. Laufzeitabhängigkeiten sind `@sva/core`, `@sva/server-runtime` und `pg`.

Direkt im Workspace wird das Paket unter anderem von folgenden Paketen konsumiert:

- `@sva/auth-runtime` für Host-Auflösung und Secret-Lookups über `@sva/data-repositories/server`
- `@sva/instance-registry` für den typisierten `InstanceRegistryRepository`-Vertrag
- `@sva/sva-mainserver` für instanzgebundene Integrationskonfigurationen
- `@sva/data` als Kompatibilitäts-/Weiterleitungs-Paket, das `@sva/data-repositories` und `@sva/data-repositories/server` re-exportiert

Die Tags `pii:yes` und `credentials:yes` im Nx-Projekt zeigen, dass das Paket mit sensiblen Daten und verschlüsselten Credentials arbeitet.

## Projektstruktur

```text
packages/data-repositories/
├── src/
│   ├── iam/
│   │   ├── repositories/
│   │   ├── seed-plan.ts
│   │   └── types.ts
│   ├── instance-registry/
│   │   ├── index.ts
│   │   └── server.ts
│   ├── integrations/
│   │   ├── instance-integrations.ts
│   │   └── instance-integrations.server.ts
│   ├── media/
│   │   └── index.ts
│   ├── public-api.ts
│   ├── index.ts
│   └── server.ts
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
└── vitest.config.ts
```

Tests liegen quellnah unter `src/**/**/*.test.ts`.

## Nx-Konfiguration

- Projektname: `data-repositories`
- Typ: `library`
- Source-Root: `packages/data-repositories/src`
- Tags: `scope:data-repositories`, `type:lib`, `pii:yes`, `credentials:yes`

Verfügbare Targets:

- `pnpm nx run data-repositories:build`
- `pnpm nx run data-repositories:check:runtime`
- `pnpm nx run data-repositories:lint`
- `pnpm nx run data-repositories:test:unit`
- `pnpm nx run data-repositories:test:types`
- `pnpm nx run data-repositories:test:coverage`

Der Build läuft über `tsc -p packages/data-repositories/tsconfig.lib.json`. `check:runtime` prüft zusätzlich die Server-Package-Runtime-Regeln für das Paket.

## Verwandte Dokumentation

- [Package-Zielarchitektur](../../docs/architecture/package-zielarchitektur.md)
- [Bausteinsicht (arc42 §5)](../../docs/architecture/05-building-block-view.md)
- [Laufzeitsicht (arc42 §6)](../../docs/architecture/06-runtime-view.md)
- [Monorepo-Übersicht](../../docs/monorepo.md)
- [README von `@sva/data`](../data/README.md)
