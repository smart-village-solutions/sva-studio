# Postgres Setup für lokale Entwicklung

## Ziel

Diese Anleitung ergänzt das bestehende Redis-Docker-Setup um eine lokale Postgres-Instanz für den IAM Core Data Layer.

## Voraussetzungen

- Docker Desktop läuft lokal
- `.env.local` enthält die Postgres-Werte (oder es gelten die Defaults aus `docker-compose.yml`)

## Quickstart

```bash
# Postgres starten
pnpm nx run data:db:up

# Status prüfen
pnpm nx run data:db:status

# Logs ansehen
pnpm nx run data:db:logs

# SQL-Migrationen anwenden
pnpm nx run data:db:migrate
```

## Verbindliche lokale Env-Konfiguration

Empfohlene `.env.local`:

```env
POSTGRES_DB=sva_studio
POSTGRES_USER=sva
POSTGRES_PASSWORD=sva_local_dev_password
IAM_DATABASE_URL=postgres://sva:sva_local_dev_password@localhost:5432/sva_studio
```

Hinweis:
- `POSTGRES_*` wird von Docker Compose verwendet
- `IAM_DATABASE_URL` ist die kanonische App-Connection für den IAM Core Data Layer

## Betrieb und Reset

```bash
# Nur Postgres stoppen
pnpm nx run data:db:down

# Postgres-Container + Volume entfernen (Datenverlust)
pnpm nx run data:db:reset

# Danach neu starten
pnpm nx run data:db:up
```

## Healthcheck

Der Container ist im Compose mit `pg_isready` health-checked. Bei Problemen:

```bash
docker compose ps postgres
docker compose logs postgres --tail=200
```

## Migrations-Hinweis

Migrationen liegen unter `packages/data/migrations/*.sql` und werden in lexikographischer Reihenfolge ausgeführt.
