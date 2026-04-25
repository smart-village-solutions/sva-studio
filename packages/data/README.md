# @sva/data

`@sva/data` ist nach dem Package-Hard-Cut kein Zielpackage für neue Datenzugriffe mehr. Die vorher gebündelten Rollen sind getrennt:

| Aufgabe | Zielpackage |
| --- | --- |
| Client-sicherer HTTP-Client, Cache und Runtime-Schema-Validierung | `@sva/data-client` |
| Serverseitige Postgres-Repositories, DB-Operationen und migrationsnahe Typen | `@sva/data-repositories` |

Neue Consumer importieren die passende Zielrolle direkt. `@sva/data` bleibt nur für Altpfade und ausdrücklich erhaltene Kompatibilität relevant.

## Betrieb

- **Name:** `data`
- **Tags:** `scope:data`, `type:lib`
- **Build:** `pnpm nx run data:build`
- **Lint:** `pnpm nx run data:lint`
- **Unit-Tests:** `pnpm nx run data:test:unit`

## Datenbank-Verwaltung

Die Migrations- und Seed-Targets bleiben am historischen `data`-Projekt gebunden, solange die Workspace-Tooling-Verträge dort liegen:

| Target | Beschreibung |
| --- | --- |
| `pnpm nx run data:db:up` | Startet Postgres lokal via Docker Compose |
| `pnpm nx run data:db:migrate` | Führt kanonische `goose`-Up-Migrationen aus `migrations/*.sql` aus |
| `pnpm nx run data:db:migrate:down` | Führt den Rollback bis Version `0` über `goose` aus |
| `pnpm nx run data:db:migrate:status` | Zeigt den `goose`-Migrationsstatus der lokalen Datenbank |
| `pnpm nx run data:db:migrate:validate` | Prüft den Zyklus `up -> down -> up` auf einer separaten temporären Datenbank |
| `pnpm nx run data:db:seed` | Führt idempotente IAM-Seeds aus `seeds/*.sql` aus |

## Verwandte Dokumentation

- [Package-Zielarchitektur](../../docs/architecture/package-zielarchitektur.md)
- [Bausteinsicht (arc42 §5)](../../docs/architecture/05-building-block-view.md)
- [IAM-Datenklassifizierung](../../docs/architecture/iam-datenklassifizierung.md)
- [Postgres-Setup](../../docs/development/postgres-setup.md)
