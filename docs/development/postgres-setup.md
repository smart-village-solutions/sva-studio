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

# Up/Down-Zyklus validieren
pnpm nx run data:db:migrate:validate

# RLS-Isolation testen
pnpm nx run data:db:test:rls
```

## Verbindliche lokale Env-Konfiguration

Empfohlene `.env.local`:

```env
POSTGRES_DB=sva_studio
POSTGRES_USER=sva
POSTGRES_PASSWORD=sva_local_dev_password
IAM_DATABASE_URL=postgres://sva_app:sva_app_local_dev_password@localhost:5432/sva_studio
IAM_PII_ACTIVE_KEY_ID=k1
IAM_PII_KEYRING_JSON={"k1":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="}
```

Hinweis:
- `POSTGRES_*` wird von Docker Compose verwendet
- `IAM_DATABASE_URL` ist die kanonische App-Connection für den IAM Core Data Layer und sollte auf einen dedizierten Login-User ohne `SUPERUSER`/`BYPASSRLS` zeigen (z. B. `sva_app`)
- `IAM_PII_*` konfiguriert Application-Level Encryption für IAM-PII-Felder

## Runtime-User korrekt auf `iam_app` begrenzen

Für lokale Entwicklung den App-Login-User einmalig anlegen und auf die Runtime-Rolle `iam_app` festlegen:

```sql
CREATE ROLE sva_app LOGIN PASSWORD 'sva_app_local_dev_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT iam_app TO sva_app;
```

Die Anwendung setzt Transaktionen auf `SET LOCAL ROLE iam_app`, damit RLS-Policies konsistent wirksam bleiben.

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

Migrationen liegen unter:

- `packages/data/migrations/up/*.sql`
- `packages/data/migrations/down/*.sql`

Ausführung:

- `db:migrate` bzw. `db:migrate:up` führt alle Up-Migrationen lexikographisch aus
- `db:migrate:down` führt Down-Migrationen in umgekehrter Reihenfolge aus
- `db:migrate:validate` prüft `up -> down -> up`
- `db:test:rls` prüft Instanzisolation, Fail-Closed ohne `app.instance_id`, Runtime-Rollenhärtung sowie Privilege-Escalation-Guards

## RLS-Bypass-Dokumentation (Task 2.6)

- Migrationen laufen lokal über den Compose-`postgres`-User und haben damit administrativen Zugriff.
- Dieser administrative Pfad ist ausschließlich für Schemaänderungen/Recovery gedacht.
- Laufzeitzugriffe müssen die dedizierte Rolle `iam_app` verwenden; diese ist ohne `SUPERUSER` und ohne `BYPASSRLS` angelegt.
- Ohne gesetzten Instanzkontext (`SET app.instance_id = ...`) greifen RLS-Policies fail-closed und liefern keine mandantenbezogenen Zeilen.
