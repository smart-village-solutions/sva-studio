# Runtime-Profile für Lokal, Builder und Abnahme

## Ziel

Dieses Runbook definiert die drei offiziellen Betriebsprofile für SVA Studio und vereinheitlicht Start, Update, Stop, Smoke-Checks und Migrationen:

- `local-keycloak`: lokaler Betrieb auf `http://localhost:3000` mit Test-Realm
- `local-builder`: lokaler Betrieb auf `http://localhost:3000` mit Builder.io und Mock-User
- `acceptance-hb`: Serverbetrieb auf `https://hb-meinquartier.studio.smart-village.app`

Die kanonischen Profildefinitionen liegen unter `config/runtime/`. Sensible oder standortspezifische Werte werden optional in `config/runtime/<profil>.local.vars` übersteuert.

## Konfigurationsmodell

### Kanonische Quellen

1. `config/runtime/base.vars`
2. `config/runtime/<profil>.vars`
3. optional `config/runtime/<profil>.local.vars`

Die Runtime-Kommandos setzen daraus konsistent:

- `SVA_RUNTIME_PROFILE`
- `VITE_SVA_RUNTIME_PROFILE`
- Auth-/Builder-Flags
- Redis-/Postgres-/OTEL-Konfiguration
- Mainserver-Smoke-Konfiguration

### Wichtige Variablen

Gemeinsam:

- `SVA_RUNTIME_PROFILE`
- `SVA_PUBLIC_BASE_URL`
- `REDIS_URL`
- `IAM_DATABASE_URL`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `SVA_MAINSERVER_GRAPHQL_URL`
- `SVA_MAINSERVER_OAUTH_TOKEN_URL`
- `SVA_MAINSERVER_CLIENT_ID`
- `SVA_MAINSERVER_CLIENT_SECRET`

Nur Keycloak-Profile:

- `SVA_AUTH_ISSUER`
- `SVA_AUTH_CLIENT_ID`
- `SVA_AUTH_CLIENT_SECRET`
- `SVA_AUTH_REDIRECT_URI`
- `SVA_AUTH_POST_LOGOUT_REDIRECT_URI`

Nur Builder:

- `SVA_MOCK_AUTH=true`
- `VITE_MOCK_AUTH=true`
- `VITE_PUBLIC_BUILDER_KEY`

## Standardkommandos

### Lokal mit Keycloak

```bash
pnpm env:up:local-keycloak
pnpm env:status:local-keycloak
pnpm env:smoke:local-keycloak
pnpm env:migrate:local-keycloak
pnpm env:update:local-keycloak
pnpm env:down:local-keycloak
```

### Lokal mit Builder.io

```bash
pnpm env:up:local-builder
pnpm env:status:local-builder
pnpm env:smoke:local-builder
pnpm env:migrate:local-builder
pnpm env:update:local-builder
pnpm env:down:local-builder
```

### HB-Abnahme

```bash
pnpm env:up:acceptance-hb
pnpm env:status:acceptance-hb
pnpm env:smoke:acceptance-hb
pnpm env:migrate:acceptance-hb
pnpm env:update:acceptance-hb
pnpm env:down:acceptance-hb
```

## Verhalten der Kommandos

### `up`

- lokale Profile starten Docker Compose für Redis/Postgres und optional den Monitoring-Stack
- lokale Profile starten danach den Dev-Server für `sva-studio-react`
- `acceptance-hb` führt `docker stack deploy` mit `deploy/portainer/docker-compose.yml` aus

### `update`

- lokale Profile ziehen Compose-Images neu, starten Infrastruktur erneut und starten den Dev-Server kontrolliert neu
- `acceptance-hb` führt ein erneutes `docker stack deploy` als Redeploy aus

### `down`

- lokale Profile stoppen Dev-Server und Compose-Stack
- `acceptance-hb` entfernt den Swarm-Stack

### `status`

- lokale Profile geben lokalen App-Status plus `docker compose ps` aus
- `acceptance-hb` gibt `docker stack services` und `docker stack ps` aus

### `smoke`

Alle Profile prüfen mindestens:

- `GET /health/live`
- `GET /health/ready`
- Auth-Verhalten von `/auth/login`
- Mock-/OIDC-Verhalten von `/auth/me`
- Mainserver-Basisfunktion über OAuth-Token + GraphQL `{ __typename }`

Zusatzprüfungen:

- lokal: OTEL Collector `http://127.0.0.1:13133/healthz`
- Acceptance: Container-Status für `app`, `redis`, `postgres`, `otel-collector`

### `migrate`

- lokal: `pnpm nx run data:db:migrate`
- Acceptance: führt alle SQL-Dateien aus `packages/data/migrations/up/*.sql` explizit im laufenden Postgres-Container aus

## Rollback und Betriebsregeln

- Schemaänderungen bleiben ein separater, bewusster Schritt und sind nie Teil von `up`
- vor einem Acceptance-Redeploy mit Schemaänderung zuerst `pnpm env:migrate:acceptance-hb` ausführen
- bei lokalen Profilwechseln nie zwei Profile parallel auf Port `3000` betreiben
- für serverseitige Details, Secrets und Portainer-Bedienung bleibt `../guides/swarm-deployment-runbook.md` die Referenz

## Typische Fehlerbilder

- Platzhalterwerte wie `__SET_IN_LOCAL_OVERRIDE__` vorhanden: `config/runtime/<profil>.local.vars` anlegen
- `env:up:local-*` scheitert mit aktivem anderem Profil: zuerst `pnpm env:down:<anderes-profil>`
- `smoke` scheitert im Builder-Profil an `/auth/me`: `SVA_MOCK_AUTH` und `VITE_MOCK_AUTH` prüfen
- `smoke` scheitert bei Mainserver: `SVA_MAINSERVER_*` prüfen
- Acceptance-Deploy scheitert: fehlende Swarm-Secrets oder unvollständige Portainer-Variablen in `deploy/portainer/.env.example`
