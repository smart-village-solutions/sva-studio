# Runtime-Profile für Lokal, Builder und Abnahme

## Ziel

Dieses Runbook definiert die drei offiziellen Betriebsprofile für SVA Studio und vereinheitlicht Start, Update, Stop, Diagnose, Smoke-Checks und Migrationen:

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

Zusätzlich unterstützt der Diagnosepfad optionale Doctor-Overrides:

- `SVA_DOCTOR_KEYCLOAK_SUBJECT`
- `SVA_DOCTOR_INSTANCE_ID`
- `SVA_DOCTOR_SESSION_ROLES`

Damit kann `env:doctor:*` in allen Profilen denselben Actor-/Membership-Pfad prüfen, ohne PII oder Secrets auszugeben.

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
pnpm env:doctor:local-keycloak
pnpm env:smoke:local-keycloak
pnpm env:migrate:local-keycloak
pnpm env:update:local-keycloak
pnpm env:down:local-keycloak
```

Für zusätzliche lokale Instanzen oder zweite lokale Datenbanken ist `../guides/lokale-instanz-db-initialisierung.md` der kanonische Bootstrap-Pfad.

### Lokal mit Builder.io

```bash
pnpm env:up:local-builder
pnpm env:status:local-builder
pnpm env:doctor:local-builder
pnpm env:smoke:local-builder
pnpm env:migrate:local-builder
pnpm env:update:local-builder
pnpm env:down:local-builder
```

### HB-Abnahme

```bash
pnpm env:precheck:acceptance-hb
pnpm env:deploy:acceptance-hb -- --release-mode=app-only
pnpm env:deploy:acceptance-hb -- --release-mode=schema-and-app --maintenance-window="2026-03-20 19:00-19:15 CET"
pnpm env:status:acceptance-hb
pnpm env:doctor:acceptance-hb
pnpm env:smoke:acceptance-hb
pnpm env:migrate:acceptance-hb
pnpm env:down:acceptance-hb
```

### Lokale HB-Produktivsimulation in Docker

```bash
pnpm env:up:local-keycloak:hb:docker
pnpm env:status:local-keycloak:hb:docker
pnpm env:down:local-keycloak:hb:docker
```

Dieser Pfad startet die App als Produktionscontainer lokal gegen `postgres-hb`, `redis` und `otel-collector`. Die dafür verwendete Runtime-Datei ist `config/runtime/local-keycloak.hb.docker.local.vars`.

## Verhalten der Kommandos

### `up`

- lokale Profile starten Docker Compose für Redis/Postgres und optional den Monitoring-Stack
- lokale Profile starten zusätzlich Adminer auf `http://127.0.0.1:8080`
- lokale Profile starten danach den Dev-Server für `sva-studio-react`
- `acceptance-hb` nutzt stattdessen den kanonischen Releasepfad `deploy`; direkte Acceptance-Deploys über `up` sind gesperrt

### `update`

- lokale Profile ziehen Compose-Images neu, starten Infrastruktur erneut und starten den Dev-Server kontrolliert neu
- `acceptance-hb` nutzt stattdessen den kanonischen Releasepfad `deploy`; direkte Acceptance-Redeploys über `update` sind gesperrt

### `down`

- lokale Profile stoppen Dev-Server und Compose-Stack
- `acceptance-hb` entfernt den Swarm-Stack

### `status`

- lokale Profile geben lokalen App-Status plus `docker compose ps` aus
- `acceptance-hb` gibt `docker stack services` und `docker stack ps` aus

### `precheck`

- lokal derzeit nicht belegt
- `acceptance-hb` prüft vor einem Release verbindlich:
  - effektive Runtime-Konfiguration und Pflichtvariablen
  - Remote-Service-Sicht via `quantum-cli`
  - Erreichbarkeit des Acceptance-Postgres
  - offensichtliche kritische Schema-Drift
- `pnpm env:precheck:acceptance-hb --json` liefert die Prüfung maschinenlesbar

### `deploy`

- nur für `acceptance-hb`
- ist der kanonische Release-Einstiegspunkt für Serverdeploys
- Orchestrierung in fixer Reihenfolge:
  1. `environment-precheck` inklusive Soll-/Live-Spec-Drift und Pflichtvariablen
  2. `image-smoke` gegen das auszurollende Digest-Artefakt
  3. optional `migrate` bei `--release-mode=schema-and-app`
  4. Stack-Rollout via `quantum-cli stacks update` oder `docker stack deploy`
  5. `internal-verify` mit internen HTTP-Probes und `doctor`-Diagnostik
  6. `external-smoke` gegen die öffentliche URL
  7. `release-decision` auf Basis der technischen Gates
  8. Deploy-Report unter `artifacts/runtime/deployments/`
- unterstützte Release-Modi:
  - `app-only`
  - `schema-and-app`
- `schema-and-app` erfordert zwingend `--maintenance-window=...`
- optionale Report-/Release-Metadaten:
  - `--image-tag=...`
  - `--image-digest=...`
  - `--rollback-hint=...`
  - `--actor=...`
  - `--workflow=...`
- Acceptance-Releases sind nur mit `--image-digest=sha256:...` gültig; der Tag bleibt rein ergänzende Lesbarkeit
- `--json` schreibt zusätzlich zur Artefakterzeugung den vollständigen Deploy-Report auf stdout

### `smoke`

Alle Profile prüfen mindestens:

- `GET /health/live`
- `GET /health/ready`
- Auth-Verhalten von `/auth/login`
- Mock-/OIDC-Verhalten von `/auth/me`
- IAM-Kontext über `/api/v1/iam/me/context`
- Mainserver-Basisfunktion über OAuth-Token + GraphQL `{ __typename }`

Zusatzprüfungen:

- lokal: OTEL Collector `http://127.0.0.1:13133/healthz`
- Acceptance: Container-Status für `app`, `redis`, `postgres`, `otel-collector`
- Acceptance: öffentliche Smoke-Probes gegen `/`, `/health/live`, `/health/ready`, `/auth/login`, `/api/v1/iam/me/context`

`smoke` validiert zusätzlich den kritischen IAM-Schema-Stand. Fehlende Tabellen, Indizes oder RLS-Policies gelten als deterministischer Fehler und werden als maschinenlesbarer Drift gemeldet.

### `doctor`

`doctor` ist der verbindliche Diagnosepfad für Runtime-Profile. Er ergänzt `smoke` um Ursachenanalyse statt nur Erreichbarkeitsprüfung.

Prüfungen in Reihenfolge:

- effektive Runtime-Konfiguration und Pflichtvariablen
- `GET /health/live`
- `GET /health/ready`
- Auth-Verhalten von `/auth/login`
- Auth-/Mock-Verhalten von `/auth/me`
- Mainserver-Basisfunktion
- IAM-Feature-Flags (`IAM_*`, `VITE_IAM_*`)
- kritischer IAM-Schema-Guard
- optional Actor-/Membership-Diagnose über `SVA_DOCTOR_*`
- Acceptance zusätzlich: Remote-Service-Zustand via `quantum-cli`

Optional:

```bash
pnpm env:doctor:acceptance-hb --json
```

Ausgabeformat pro Check:

- `status`: `ok | warn | error | skipped`
- `code`: stabiler Maschinen-Code
- `message`: menschenlesbare Kurzbeschreibung
- `details`: nicht-sensitive Zusatzdiagnose

Beispiele für `details`:

- `reason_code=missing_table`
- `reason_code=missing_instance_membership`
- `expected_migration=0019_iam_account_groups_origin_compat.sql`
- `schema_guard.failures=["missing_table:iam.account_groups"]`

### `migrate`

- lokal: `pnpm nx run data:db:migrate`
- Acceptance: führt den kanonischen `goose`-Migrationspfad aus `packages/data/migrations/*.sql` gegen den laufenden Swarm-Postgres aus
  - bevorzugt automatisch per `quantum-cli exec --endpoint sva --stack sva-studio --service postgres`
  - Fallback: lokaler `docker exec` nur dann, wenn der Acceptance-Stack über denselben Docker-Daemon sichtbar ist
  - `goose` wird dabei mit gepinnter Version temporär bereitgestellt; eine Vorinstallation auf dem Zielsystem ist nicht erforderlich
  - für `pnpm env:migrate:acceptance-hb` werden keine Mainserver-Smoke-Werte benötigt; der Befehl validiert nur noch den für Migrationen relevanten Acceptance-Kontext
  - nach dem `goose`-Lauf prüft ein verbindlicher Schema-Guard den kritischen IAM-Sollstand (`groups`, `group_roles`, `account_groups`, Schlüsselspalten, Indizes, RLS-Policies)

## Rollback und Betriebsregeln

- Schemaänderungen bleiben ein separater, bewusster Schritt und sind nie Teil von `up`
- Acceptance-Deploys laufen nur noch über `pnpm env:deploy:acceptance-hb`
- vor einem Acceptance-Release mit `--release-mode=schema-and-app` ist ein dokumentiertes Wartungsfenster Pflicht
- `schema-and-app` führt Migrationen nur innerhalb des orchestrierten Deploypfads oder bewusst separat über `pnpm env:migrate:acceptance-hb` aus
- jeder Acceptance-Deploy erzeugt einen maschinenlesbaren und menschenlesbaren Bericht unter `artifacts/runtime/deployments/`
- jeder Acceptance-Deploy erzeugt zusätzlich Release-Manifest, Phasenreport, Migrationsreport, interne Probe-Ergebnisse und externe Probe-Ergebnisse als eigene JSON-Artefakte
- nach jedem Acceptance-Deploy folgt `pnpm env:feedback:acceptance-hb`; der Befehl erzeugt eine Trend-Zusammenfassung und einen Review-Entwurf fuer den juengsten Lauf
- fehlgeschlagene oder manuell stabilisierte Deploys muessen zusaetzlich als Review unter `docs/reports/` festgehalten werden
- vor einer tieferen Fehlersuche immer zuerst `pnpm env:doctor:<profil>` ausführen; manuelles `psql` und Browser-Netzwerk sind nur Fallback
- bei lokalen Profilwechseln nie zwei Profile parallel auf Port `3000` betreiben
- für serverseitige Details, Secrets und Portainer-Bedienung bleibt `../guides/swarm-deployment-runbook.md` die Referenz

## Typische Fehlerbilder

- Adminer lokal nicht erreichbar: prüfen, ob `docker compose ps adminer` läuft und Port `8080` frei ist
- Adminer-Login schlägt lokal fehl: Server `postgres`, System `PostgreSQL`, Benutzer `sva`, Datenbank `sva_studio` und das lokale `POSTGRES_PASSWORD` verwenden
- Platzhalterwerte wie `__SET_IN_LOCAL_OVERRIDE__` vorhanden: `config/runtime/<profil>.local.vars` anlegen
- `env:up:local-*` scheitert mit aktivem anderem Profil: zuerst `pnpm env:down:<anderes-profil>`
- `smoke` scheitert im Builder-Profil an `/auth/me`: `SVA_MOCK_AUTH` und `VITE_MOCK_AUTH` prüfen
- `smoke` scheitert bei Mainserver: `SVA_MAINSERVER_*` prüfen
- `doctor` meldet `missing_actor_account` oder `missing_instance_membership`: Actor-/Membership-Kontext per `SVA_DOCTOR_KEYCLOAK_SUBJECT` gegen die Zielinstanz prüfen
- bei neuer lokaler Instanz-DB zuerst `pnpm env:bootstrap:local-instance-db -- ...` verwenden statt manuell Tabellen oder User aus einer anderen Instanz zu kopieren
- `doctor` oder `/health/ready` melden `schema_drift`: zuerst `pnpm env:migrate:<profil>`, dann `pnpm env:doctor:<profil>`
- Acceptance-Deploy scheitert: unvollständige Portainer-Variablen in `deploy/portainer/.env.example`
- Acceptance-Migration findet keinen lokalen `postgres`-Container: erwartbar bei Remote-Swarm; der Befehl nutzt dann automatisch `quantum-cli exec`
- `env:deploy:acceptance-hb --release-mode=schema-and-app` scheitert sofort: Wartungsfenster fehlt oder `quantum-cli`/Stack-Zugriff ist nicht verfügbar
- `env:deploy:acceptance-hb` scheitert vor dem Rollout: `SVA_IMAGE_DIGEST` fehlt oder das Digest-Artefakt besteht den `image-smoke` nicht
