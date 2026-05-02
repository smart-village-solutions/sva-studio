# Runtime-Profile für Lokal, Builder und Remote-Betrieb

## Ziel

Dieses Runbook definiert die offiziellen Betriebsprofile für SVA Studio und vereinheitlicht Start, Update, Stop, Diagnose, Smoke-Checks und Migrationen:

- `local-keycloak`: lokaler Betrieb auf `http://localhost:3000` mit globalem Test-Realm `svs-intern-studio-staging`
- `local-builder`: lokaler Betrieb auf `http://localhost:3000` mit Builder.io und Mock-User
- `studio`: produktionsnaher Serverbetrieb auf `https://studio.smart-village.app` mit dediziertem Swarm-Stack

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

Für `studio` gilt zusätzlich ein pragmatischer Testphasen-Vertrag:

- der verbindliche lokale Toolchain-Check vor jedem Runtime-Debugging ist `pnpm check:toolchain-consistency`; er bricht bei Drift zwischen `.nvmrc`, `packageManager`, `pnpm-lock.yaml` und installiertem `node_modules` fail-fast ab
- der verbindliche lokale Build-Nachweis vor jedem Image-Build ist `pnpm nx run sva-studio-react:verify:runtime-artifact`
- dieser Check bewertet ausschließlich den finalen Node-Output unter `apps/sva-studio-react/.output/server/**`
- der finale Build erzeugt zusätzlich einen generierten `tanstack-server-entry.mjs` direkt unter `.output/server/chunks/build/`; dieser Build-time-Patch ist Teil des kanonischen Artefakts und ersetzt die frühere Laufzeit-Umschreibung im Entrypoint
- `.nitro/vite/services/ssr/**` bleibt Diagnosematerial und ist kein Release-Nachweis
- kanonischer Pfad nur über `precheck -> deploy -> smoke`
- `SVA_STACK_NAME=studio`, `QUANTUM_ENDPOINT=sva`, `SVA_RUNTIME_PROFILE=studio`
- `IAM_DATABASE_URL` und `REDIS_URL` dürfen für Remote-Profile aus den vorhandenen DB-/Redis-Bausteinen abgeleitet werden
- lokale Dev-Defaults aus `base.vars` dürfen Remote-Fehlkonfigurationen nicht still kaschieren
- bei Quantum-Auth-Problemen muss ein lokaler Override durch `QUANTUM_API_KEY` mitgedacht werden; ein funktionierender Benutzerkontext kann lokal durch veraltete Shell-Umgebungen sabotiert werden
- lokale grüne Unit-, Integrations- oder Docker-Läufe sind kein Betriebsnachweis für `studio`
- für produktionsnahe Freigaben zählen nur die Remote-Gates, die laufende App-Readiness und die dokumentierte Deploy-Evidenz

Zusätzlich unterstützt der Diagnosepfad optionale Doctor-Overrides:

- `SVA_DOCTOR_KEYCLOAK_SUBJECT`
- `SVA_DOCTOR_INSTANCE_ID`
- `SVA_DOCTOR_SESSION_ROLES`

Damit kann `env:doctor:*` in allen Profilen denselben Actor-/Membership-Pfad prüfen, ohne PII oder Secrets auszugeben.

Für `studio` gilt zusätzlich ein expliziter Observability-Vertrag:

- `ENABLE_OTEL=false` plus `SVA_ENABLE_SERVER_CONSOLE_LOGS=true` bedeutet `console_to_loki` und ist in der frühen Testphase der bevorzugte Diagnosepfad
- `SVA_TRUST_FORWARDED_HEADERS=true` aktiviert im Reverse-Proxy-Betrieb die Auswertung von `X-Forwarded-*` und `Forwarded`; ohne dieses Flag fällt die Host-/Proto-Auflösung strikt auf `request.url` zurueck
- `ENABLE_OTEL=true` bedeutet `otel_to_loki`; der Bootstrap muss dann `observability_ready` schreiben
- Für `studio` ist der belastbare Tenant-Auth-Beweis erreicht, wenn nach frischen `/auth/login`-Probes in Loki `tenant_auth_resolution_summary` mit `secret_source="tenant"` und `oidc_cache_key_scope="tenant_secret"` für die aktiven Tenants sichtbar ist
- wenn weder OTEL noch produktive Console-Logs aktiv sind, gilt das Profil als `degraded` und `doctor`/`precheck` müssen daran scheitern
- `scripts/ops/runtime-env.ts` lädt für Remote-Diagnosen zusätzlich lokale Operator-Overlays aus `~/.config/quantum/env`, z. B. `SVA_GRAFANA_URL`, `SVA_LOKI_URL` und `SVA_GRAFANA_TOKEN`

### Wichtige Variablen

Gemeinsam:

- `SVA_RUNTIME_PROFILE`
- `SVA_PUBLIC_BASE_URL`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `SVA_MAINSERVER_GRAPHQL_URL`
- `SVA_MAINSERVER_OAUTH_TOKEN_URL`
- `SVA_MAINSERVER_CLIENT_ID`
- `SVA_MAINSERVER_CLIENT_SECRET`
- optional `SVA_MAINSERVER_REQUIRED=false`, wenn der Mainserver-Smoke in der frühen Testphase bewusst nicht blockieren darf
- optional `SVA_MIGRATION_STATUS_REQUIRED=false`, wenn der Remote-Goose-Status in der frühen Studio-Testphase nur als Zusatzsignal und nicht als blockierendes Gate gewertet werden soll

Remote (`studio`) verpflichtend:

- `SVA_STACK_NAME`
- `QUANTUM_ENDPOINT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `APP_DB_USER`
- `APP_DB_PASSWORD`
- `REDIS_PASSWORD`

Ableitbar für Remote-Profile:

- `IAM_DATABASE_URL`
- `REDIS_URL`

Nur Keycloak-Profile:

- `SVA_AUTH_CLIENT_SECRET`
- `SVA_AUTH_REDIRECT_URI`
- `SVA_AUTH_POST_LOGOUT_REDIRECT_URI`

Nur produktionsnahe Registry-Profile:

- `authRealm`, `authClientId` und `tenantAdminClient.clientId` liegen pro Instanz in `iam.instances`
- optional `authIssuerUrl`, wenn der Issuer nicht aus `KEYCLOAK_ADMIN_BASE_URL + /realms/<authRealm>` gebildet werden soll
- `SVA_AUTH_ISSUER` und `SVA_AUTH_CLIENT_ID` bleiben nur lokale Fallbacks für nicht-registry-gesteuerte Pfade
- der operative Root-Host-Provisioning-Pfad ist unter `../guides/instance-keycloak-provisioning.md` dokumentiert
- der tenant-spezifische Realm-Zielzustand selbst ist unter `../guides/keycloak-tenant-realm-bootstrap.md` dokumentiert

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

Wichtig für den lokalen `local-keycloak`-Pfad:

- `studio.localhost:3000` ist der Root-/Plattform-Host und authentifiziert gegen `svs-intern-studio-staging`.
- `<instanceId>.studio.localhost:3000` ist ein Tenant-Host und authentifiziert gegen den in `iam.instances.auth_realm` hinterlegten Tenant-Realm, zum Beispiel `de-musterhausen`.
- Normale Tenant-Mutationen für Nutzer, Rollen und Gruppen laufen im lokalen Standardpfad strikt gegen denselben Tenant-Realm wie der Login-Flow, aber über den separaten `tenantAdminClient`.
- `KEYCLOAK_ADMIN_REALM` und `KEYCLOAK_ADMIN_CLIENT_ID` beschreiben im lokalen Profil nur noch den Plattform-/Break-Glass-Pfad. Sie sind kein impliziter Fallback für Tenant-Alltagsverwaltung mehr.
- Fehlen tenantlokaler Admin-Client oder tenantlokales Secret im Instanzdatensatz, schlagen Tenant-Mutationen fail-closed mit `tenant_admin_client_not_configured` oder `tenant_admin_client_secret_missing` fehl.

Für zusätzliche lokale Instanzen oder zweite lokale Datenbanken ist `../guides/lokale-instanz-db-initialisierung.md` der kanonische Bootstrap-Pfad.

Für lokale Multi-Tenant-Hosttests ist `../guides/instance-registry-local-development.md` der kanonische Pfad. Offiziell unterstützt sind `studio.lvh.me` und `<instanceId>.studio.lvh.me`.

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

### Studio (Remote)

```bash
pnpm env:release:studio:local -- --image-digest=<sha256:...> --release-mode=app-only --rollback-hint="Vorherigen Digest erneut deployen"
pnpm env:release:studio:local -- --image-digest=<sha256:...> --release-mode=schema-and-app --maintenance-window="2026-03-20 19:00-19:15 CET" --rollback-hint="Vorherigen Digest erneut deployen"
pnpm env:status:studio
pnpm env:doctor:studio
pnpm env:migrate:studio
pnpm env:down:studio
```

Der kanonische Pfad für `studio` ist jetzt geteilt:

- GitHub Actions bereiten Digest und Verify vor
- `pnpm env:release:studio:local` führt lokal `precheck`, `deploy`, `smoke` und `feedback` für genau diesen Digest aus

Direkte lokale Aufrufe von `env:deploy:studio` bleiben ein Low-Level-Pfad; der dokumentierte produktionsnahe Einstieg ist `env:release:studio:local`.

Der Container-Entrypoint kennt zusätzlich nur noch einen expliziten Legacy-Recovery-Pfad:

- `SVA_ENABLE_RUNTIME_RECOVERY_PATCH=1` erlaubt im Incident-Fall den dokumentierten Runtime-Patch auf dem finalen Nitro-Entry
- ohne dieses Flag bleibt jede Artefakt-Umschreibung deaktiviert; der Standardbetrieb muss mit dem unveränderten Build-Output gesund starten

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
- Remote-Profile (`studio`) nutzen stattdessen den kanonischen Releasepfad `deploy`; direkte Remote-Deploys über `up` sind gesperrt

### `update`

- lokale Profile ziehen Compose-Images neu, starten Infrastruktur erneut und starten den Dev-Server kontrolliert neu
- Remote-Profile (`studio`) nutzen stattdessen den kanonischen Releasepfad `deploy`; direkte Remote-Redeploys über `update` sind gesperrt

### `down`

- lokale Profile stoppen Dev-Server und Compose-Stack
- Remote-Profile entfernen den Swarm-Stack

### `status`

- lokale Profile geben lokalen App-Status plus `docker compose ps` aus
- Remote-Profile geben einen zusammengefassten Stack-Status aus der Portainer-API aus
- `quantum-cli ps` bleibt nur Fallback, wenn der Read-only-API-Pfad nicht verfügbar ist

### `precheck`

- lokal derzeit nicht belegt
- Remote-Profile prüfen vor einem Release verbindlich:
  - effektive Runtime-Konfiguration und Pflichtvariablen
  - Remote-Service-Sicht via Portainer-API statt über lokalen `quantum-cli`-Status
  - Ingress-Konsistenz zwischen laufendem App-Service und externem `/health/live`
  - Runtime-Flags aus der Live-Service-Spec des `app`-Service
  - `app-db-principal` über `/health/ready` als Nachweis, dass `db`, `redis` und `keycloak` aus Sicht des laufenden `APP_DB_USER` stabil bereit sind
  - kritische Schema-, Instanz- und Hostname-Assertions über dedizierte Job-Evidenz
  - Soll-/Live-Drift der `app`-Service-Spec inklusive Image-Ref, Secrets/Env, Netzwerken (`internal`, `public`) und ingressrelevanten Traefik-Labels
- Remote-Postgres wird im Standardpfad nicht mehr über `quantum-cli exec` geprüft; dafür gelten `/health/ready`, laufender Postgres-Service und Bootstrap-/Schema-Evidenz als autoritative Signale
- `pnpm env:precheck:<profil> --json` liefert die Prüfung maschinenlesbar

### `deploy`

- nur für Remote-Profile (`studio`)
- ist der kanonische Release-Einstiegspunkt für Serverdeploys
- Remote-Mutationen sind für `studio` entweder im expliziten lokalen Operator-Kontext oder im dokumentierten Legacy-CI-Fallback zulässig
- der dokumentierte Standardweg setzt `SVA_REMOTE_OPERATOR_CONTEXT=local-operator` nur über `env:release:studio:local`
- Orchestrierung in fixer Reihenfolge:
  1. `environment-precheck` inklusive Soll-/Live-Spec-Drift und Pflichtvariablen
  2. `image-smoke` gegen das auszurollende Digest-Artefakt mit Root-Host-, Tenant-Host- und OIDC-Parität
  3. optional `migrate` bei `--release-mode=schema-and-app` als dedizierter Swarm-One-off-Job
  4. optional `bootstrap` bei `--release-mode=schema-and-app` als dedizierter Swarm-One-off-Job für App-User, Grants und Instanz-Seeding
  5. gehärteter Live-Rollout des echten Ziel-Stacks via `quantum-cli stacks update` oder `docker stack deploy`
  6. `internal-verify` über externe Healthchecks, `doctor`-Diagnostik und Swarm-Task-/Service-Status
  7. `external-smoke` gegen die öffentliche URL
  8. `release-decision` auf Basis der technischen Gates
  9. Deploy-Report unter `artifacts/runtime/deployments/`
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
- Remote-Releases sind nur mit `--image-digest=sha256:...` gültig; der Tag bleibt rein ergänzende Lesbarkeit
- `--json` schreibt zusätzlich zur Artefakterzeugung den vollständigen Deploy-Report auf stdout
- Vor dem eigentlichen Stack-Update validiert der gehärtete Renderpfad, dass `app` weiterhin die Netzwerke `internal` und `public` sowie die ingressrelevanten Traefik-Labels enthält. Fehlende Einträge blockieren den Rollout vor jedem Live-Mutationsschritt.
- Wenn das Ziel-Digest bereits live auf `app` läuft, darf das Parity-Gate die Live-Evidenz desselben Digests wiederverwenden. Voraussetzung sind grüne Nachweise für Ingress-Konsistenz, `app-db-principal`, Tenant-Auth-Proof und Live-Runtime-Flags.
- Ein lokaler Kandidatencontainer ersetzt für `studio` keinen echten Swarm-/Ingress-/Private-DNS-Nachweis. Kann der Remote-Hostvertrag lokal nicht realistisch abgebildet werden, bleibt nur die dokumentierte Live-Parität desselben Digests oder ein echter Remote-Rollout im kanonischen Pfad.
- Erkenntnis aus dem Studio-Release vom 28. April 2026: `migrate` und `bootstrap` bleiben harte Freigabegates, weil Schema-Pflichtfelder und Bootstrap-Reconcile gemeinsam betrachtet werden müssen.
- Erkenntnis aus dem Studio-Release vom 28. April 2026: externe Health- und Tenant-Probes direkt nach dem Stack-Cutover können kurzzeitige `404` liefern, obwohl der neue Task wenige Sekunden später gesund ist; Release-Wrapper sollen diesen Zeitraum mit bounded Retries statt mit einem Sofort-Abbruch behandeln.
- Erkenntnis aus dem Studio-Release vom 28. April 2026: eine erfolgreich in GitHub gelaufene `Studio Image Verify`-Evidenz ist fachlich gleichwertig zu lokal erzeugten Verify-Artefakten; ein reiner Lookup auf `artifacts/runtime/image-verify` erzeugt sonst Warnrauschen.

### `smoke`

Alle Profile prüfen mindestens:

- `GET /health/live`
- `GET /health/ready`
- Auth-Verhalten von `/auth/login`
- Mock-/OIDC-Verhalten von `/auth/me`
- IAM-Kontext über `/api/v1/iam/me/context`
- Mainserver-Basisfunktion über OAuth-Token + GraphQL `{ __typename }`

Ausnahme für `studio` in der frühen Testphase:

- wenn `SVA_MAINSERVER_REQUIRED=false` gesetzt ist, wird der Mainserver-Smoke in `doctor` und `smoke` als optional markiert und blockiert die Studio-Einrichtung nicht
- wenn `SVA_MIGRATION_STATUS_REQUIRED=false` gesetzt ist, wird ein nicht verfügbarer Remote-Goose-Status in `precheck` als optional markiert; der harte Schema-Guard bleibt weiterhin verbindlich
- die Mainserver-URLs bleiben trotzdem dokumentiert und können später ohne Skriptumbau wieder als verbindliches Gate aktiviert werden

Zusatzprüfungen:

- lokal: OTEL Collector `http://127.0.0.1:13133/healthz`
- lokal im Multi-Tenant-Pfad: Root-Host `studio.lvh.me`, Tenant-Host `hb.studio.lvh.me` und fail-closed-Fall `blocked.studio.lvh.me`
- Remote: Service-/Task-Status für `app`, `redis`, `postgres` bevorzugt über Portainer-API
- Remote: `otel-collector` nur dann zusätzlich, wenn `ENABLE_OTEL` im Zielprofil aktiviert ist
- Remote: öffentliche Smoke-Probes gegen Root-Host `/`, `/health/live`, `/health/ready`, `/auth/login`, `/api/v1/iam/me/context`
- Remote: zusätzlich `/api/v1/iam/instances`
- Remote: mindestens ein aktiver Tenant-Host und ein negativer Host-Fall gegen dieselbe App-Instanz
- Remote: `doctor` und `precheck` müssen `app-db-principal` für denselben Runtime-User wie die laufende App als `ok` ausweisen
- Remote: wenn die erste externe Probe direkt nach einem `app-only`-Rollout fehlschlägt, ist mindestens ein kurzer Retry-Zeitraum verpflichtend, bevor der gesamte Release als `health`-Fehler gewertet wird

Im Profil `studio` prüfen die externen Smokes zusätzlich tenant-spezifische OIDC-Redirects. Der Scope kommt bevorzugt aus der Instanz-Registry; `SVA_ALLOWED_INSTANCE_IDS` bleibt nur lokaler oder migrationsbezogener Fallback, und `SVA_TENANT_SCOPE_INSTANCE_IDS` kann den Scope für gezielte Operator-Läufe explizit übersteuern.

Für `studio` gilt bei Tenant-Smokes zusätzlich:

- wenn ein externer Tenant-Redirect falsch ist, denselben Request intern im `studio_app`-Container mit explizitem `Host` wiederholen
- wenn der interne Request bereits falsch ist, liegt das Problem nicht mehr im Ingress
- `/auth/me` muss nach erfolgreichem Tenant-Login einen `instanceId`-Claim liefern; ein blosses Keycloak-User-Attribut ohne Protocol Mapper reicht nicht

Zusatzvertrag für den Root-Host:

- `/admin/instances` ist die führende Control Plane für tenant-spezifische Realm-Basisdaten
- `/admin/users` und `/admin/roles` laufen auf dem Root-Host im Platform-Scope und lesen Plattform-User bzw. Plattform-Rollen aus dem Plattform-Realm; diese Pfade dürfen keine tenantgebundene `instanceId` voraussetzen
- `POST /api/v1/iam/users/sync-keycloak` nutzt auf dem Root-Host `executionMode=platform_admin`; derselbe Endpunkt nutzt auf Tenant-Hosts weiter `executionMode=tenant_admin`
- dort werden `authRealm`, `authClientId`, `tenantAdminClient.clientId`, optional `authIssuerUrl`, das tenant-spezifische OIDC-Client-Secret, das Tenant-Admin-Client-Secret und die Tenant-Admin-Stammdaten gepflegt
- das Client-Secret ist write-only; im UI wird nur angezeigt, ob es bereits konfiguriert ist
- Realm-/Login-Client-/Tenant-Admin-Client-/Mapper-/Tenant-Admin-Abgleich erfolgt explizit über den Keycloak-Reconcile-Pfad der Instanzverwaltung
- tenant-lokale `system_admin`s dürfen diese globale Root-Host-Verwaltung nicht sehen oder mutieren
- Tenant-Smokes werden separat gegen echte Tenant-Hosts ausgeführt; `partial_failure` beim Tenant-User-Sync ist ein fachlich offener Befund, aber kein Nachweis für einen Browser- oder Seitenabsturz

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
- Remote zusätzlich: Remote-Service-Zustand bevorzugt via Portainer-API; `quantum-cli` ist nur Fallback für Mutationen oder Sonderdiagnosen

Optional:

```bash
pnpm env:doctor:studio --json
```

```bash
pnpm env:doctor:studio --json
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
- `tenant_hostnames=["bb-guben.studio.smart-village.app"]`
- `derived=["IAM_DATABASE_URL","REDIS_URL"]`
- `configDrift=["SVA_PARENT_DOMAIN","APP_DB_USER"]`
- `channel="portainer-api"`
- `appDbUser="sva_app"`

## Deploy-Reports

Deploy-Reports unter `artifacts/runtime/deployments/` sind die primäre Diagnosequelle für `studio`. Sie enthalten mindestens:

- Commit-SHA
- Image-Ref und Digest
- Runtime-Profil, Stack und Endpoint
- Pflicht- und ableitbare Runtime-Schlüssel
- Gate-Ergebnisse für Precheck, Migration, Deploy, interne Verifikation und externe Smokes
- explizite Evidenz für `app-db-principal`, Ingress-Konsistenz, Tenant-Auth-Proof und gegebenenfalls Live-Paritäts-Reuse bei bereits laufendem Ziel-Digest
- Drift- und Ingress-Evidenz für die `app`-Service-Spec (Image, Netzwerke, Traefik-Labels, fehlende Env-/Secret-Schlüssel)
- Rollback-Hinweis

Wichtig für die Interpretation:

- ein roter Report kann in frühen Testphasen auch durch Verify-/Transport-Flakes entstehen
- wenn Service-Spec, laufende Tasks und externe Smokes grün sind, ist der nächste Schritt die gezielte Trennung zwischen echtem Rollout-Fehler und Report-False-Negative

### `migrate`

- lokal: `pnpm nx run data:db:migrate`
- Remote: führt den kanonischen `goose`-Migrationspfad aus `packages/data/migrations/*.sql` über einen dedizierten Swarm-Migrationsjob gegen den laufenden Swarm-Postgres aus
- Remote: führt danach den dedizierten Swarm-Bootstrap-Job für App-DB-User, Grants und `iam.instances`-/`iam.instance_hostnames`-Seed aus
  - der Job nutzt dasselbe Runtime-Image wie `app`, aber einen separaten Entrypoint `deploy/portainer/migrate-entrypoint.sh`
  - die Runtime-CLI rendert dafür ein temporäres Quantum-Projekt mit genau einem Service `migrate`
  - der Job hängt am bereits existierenden Overlay-Netzwerk `<stack>_internal` und spricht Postgres über `<stack>_postgres` an
  - `goose` wird mit gepinnter Version aus `packages/data/scripts/goosew.sh` im Job-Container bereitgestellt; eine Vorinstallation auf dem Zielsystem ist nicht erforderlich
  - für `pnpm env:migrate:<profil>` werden keine Mainserver-Smoke-Werte benötigt; der Befehl validiert nur den für Migrationen relevanten Remote-Kontext
  - nach dem Job-Lauf prüfen `ensureAcceptancePostMigrationState` und der verbindliche Schema-Guard den kritischen IAM-Sollstand (`groups`, `group_roles`, `account_groups`, Schlüsselspalten, Indizes, RLS-Policies)
  - Deploy-Reports schreiben zusätzlich ein eigenes JSON-Artefakt für den Migrationsjob mit Stack-/Service-Namen, Exit-Code, Task-ID und Job-Dauer

## Rollback und Betriebsregeln

- Schemaänderungen bleiben ein separater, bewusster Schritt und sind nie Teil von `up`
- Remote-Deploys laufen nur noch über `pnpm env:deploy:<profil>`
- vor einem Remote-Release mit `--release-mode=schema-and-app` ist ein dokumentiertes Wartungsfenster Pflicht
- für `studio` gilt in der frühen Testphase: erst Runtime-/Tenant-/DB-Vertrag stabilisieren, dann weitere Automatisierungsgates verschärfen

## Observability und Live-Diagnose

Für den produktionsnahen `studio`-Betrieb gilt:

- Grafana/Loki-Zugaenge können lokal über `~/.config/quantum/env` hinterlegt werden (`SVA_GRAFANA_URL`, `SVA_LOKI_URL`, `SVA_GRAFANA_TOKEN`)
- Read-only Remote-Diagnostik nutzt bevorzugt die Portainer-API mit `QUANTUM_API_KEY` und fester `QUANTUM_ENDPOINT_ID`
- `quantum-cli` bleibt im Regelbetrieb auf mutierende Rollouts (`stacks update`) sowie dedizierte Job-Stacks (`migrate`, `bootstrap`) begrenzt
- Logs müssen weiterhin PII- und Secret-arm bleiben; Diagnostik nutzt den SDK-Logger
- Wenn in Loki keine verwertbaren App-Diagnoselogs erscheinen, zuerst prüfen:
  - ob die aktuelle App-Version wirklich deployt ist
  - ob Runtime-Flags für Console-/Transport-Verhalten im Live-Service angekommen sind
  - ob der Log-Stream neue Container-Ausgaben überhaupt aufnimmt
- `schema-and-app` führt Migrationen nur innerhalb des orchestrierten Deploypfads oder bewusst separat über `pnpm env:migrate:<profil>` aus
- `env:migrate:<profil>` nutzt für Remote-Profile denselben Pfad `migrate-job -> bootstrap-job -> schema-guard` wie `schema-and-app`
- `env:migrate:<profil>` und `schema-and-app` laufen für Remote-Profile in separaten Temp-Stacks; diese Jobs dürfen den Live-Stack `app`, `postgres` und `redis` nicht reconciliieren
- jeder Remote-Deploy erzeugt einen maschinenlesbaren und menschenlesbaren Bericht unter `artifacts/runtime/deployments/`
- jeder Remote-Deploy erzeugt zusätzlich Release-Manifest, Phasenreport, Migrationsreport, interne Probe-Ergebnisse und externe Probe-Ergebnisse als eigene JSON-Artefakte
- nach jedem `studio`-Deploy folgt `pnpm env:feedback:studio` für den Review- und Feedback-Loop
- fehlgeschlagene oder manuell stabilisierte Deploys müssen zusätzlich als Review unter `docs/reports/` festgehalten werden
- vor einer tieferen Fehlersuche immer zuerst `pnpm env:doctor:<profil>` ausführen; manuelles `psql` und Browser-Netzwerk sind nur Fallback
- bei lokalen Profilwechseln nie zwei Profile parallel auf Port `3000` betreiben
- für serverseitige Details, Secrets und Portainer-Bedienung bleibt `../guides/swarm-deployment-runbook.md` die Referenz
- für `studio` ist `config/runtime/studio.local.vars` die bewusst freigegebene lokale Operator-Quelle für Ziel-Digest und Image-Ref; vor jedem `app-only`- oder `schema-and-app`-Rollout muss dieser Stand mit der beabsichtigten Live-Version konvergieren
- Der kanonische Recovery-Pfad für `app 1/1`, aber externen `502`, lautet: Render-Compose prüfen, Live-Service-Spec prüfen, kontrollierten `app-only`-Reconcile ausführen, danach `status`, `smoke` und `precheck` wiederholen. Direkte Portainer-API-Eingriffe gelten nur als Incident-Recovery.

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
- Remote-Deploy scheitert: unvollständige Portainer-Variablen in `deploy/portainer/.env.example`
- Remote-Migration findet keinen lokalen `postgres`-Container: erwartbar bei Remote-Swarm; der Befehl startet stattdessen den dedizierten Swarm-Migrationsjob
- Remote-Bootstrap läuft nicht oder hinterlässt `migrate`/`bootstrap` auf `replicas > 0`: Stack mit `pnpm env:status:<profil>` prüfen; die Job-Services müssen nach Erfolg wieder auf `0` stehen
- `env:deploy:<profil> --release-mode=schema-and-app` scheitert sofort: Wartungsfenster fehlt oder `quantum-cli`/Stack-Zugriff ist nicht verfügbar
- `status`, `doctor` oder `precheck` scheitern read-only trotz gesundem Stack: zuerst `QUANTUM_ENDPOINT_ID` und `QUANTUM_API_KEY` für den Portainer-Pfad prüfen, erst danach `quantum-cli` als Fallback debuggen
- `env:deploy:<profil>` scheitert vor dem Rollout: `SVA_IMAGE_DIGEST` fehlt oder das Digest-Artefakt besteht den `image-smoke` nicht
Für das frühe `studio`-Profil sind produktive Console-Logs bewusst per `SVA_ENABLE_SERVER_CONSOLE_LOGS=true` erlaubt, damit Loki die Serverdiagnostik auch ohne internen OTEL-Collector erfassen kann. Das Flag ist ein temporärer Testphasen-Hebel und soll in einer späteren Betriebsphase wieder deaktiviert werden, sobald die OTEL-Pipeline im Zielprofil stabil verfügbar ist.

Zusätzlich kann `SVA_AUTH_DEBUG_HEADERS=true` im frühen `studio`-Profil aktiviert werden. Dann liefert `/auth/login` auf Redirect-Antworten diagnostische Header wie effektiven Request-Host, Origin, aufgelöste `instanceId`, `authRealm` und `redirectUri`. Das ist ausschließlich für gezielte Tenant-Diagnosen gedacht und soll nach Abschluss des Debuggings wieder deaktiviert werden.
