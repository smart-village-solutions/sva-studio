# Portainer-Deployment ohne Monitoring-Stack

> **Hinweis:** Der Stack wurde auf Docker Swarm mit Traefik-Ingress umgestellt. Die aktuelle Referenz für den serverbasierten Betrieb ist das [Swarm-Deployment-Runbook](./swarm-deployment-runbook.md). Die folgende Anleitung beschreibt den ursprünglichen, nicht-Swarm-basierten Ansatz und dient nur noch als historische Referenz.

## Ziel

Diese Anleitung bringt den aktuellen Stand von `sva-studio` auf einen Server mit Portainer, zunächst ohne Loki, Prometheus, Grafana oder OTEL-Collector.

Der Stack besteht nur aus:

- `app` (TanStack Start / Nitro Node-Server)
- `postgres`
- `redis`

## Dateien

Für das Deployment liegen die relevanten Dateien unter:

- `deploy/portainer/docker-compose.yml`
- `deploy/portainer/Dockerfile`
- `deploy/portainer/.env.example`

## Wichtige Einschränkung

Die Postgres-Initialisierung führt die SQL-Migrationen nur beim **ersten Start mit leerem Daten-Volume** automatisch aus. Für spätere Updates auf eine bereits bestehende Datenbank müssen neue Migrationen bewusst separat ausgeführt werden.

Für einen ersten Test- oder MVP-Rollout ist das ausreichend und deutlich robuster als ein zusätzlicher One-shot-Migrationscontainer in Portainer.

## Vorbereitung

1. Repo nach GitHub pushen.
2. In Portainer einen Stack aus dem Git-Repository anlegen.
3. Als Compose-Pfad `deploy/portainer/docker-compose.yml` verwenden.
4. Die Werte aus `deploy/portainer/.env.example` in die Stack-Umgebungsvariablen übernehmen und anpassen.

## Mindest-Umgebungsvariablen

Pflichtwerte:

- `POSTGRES_PASSWORD`
- `APP_DB_PASSWORD`
- `SVA_PUBLIC_BASE_URL`
- `SVA_AUTH_ISSUER`
- `SVA_AUTH_CLIENT_ID`
- `SVA_AUTH_CLIENT_SECRET`
- `SVA_AUTH_REDIRECT_URI`
- `SVA_AUTH_POST_LOGOUT_REDIRECT_URI`
- `SVA_AUTH_STATE_SECRET`
- `ENCRYPTION_KEY`
- `IAM_PII_KEYRING_JSON`

Für den ersten Schritt ohne Admin-Features sollten diese Flags auf `false` bleiben:

- `IAM_UI_ENABLED`
- `IAM_ADMIN_ENABLED`
- `IAM_BULK_ENABLED`
- `VITE_IAM_UI_ENABLED`
- `VITE_IAM_ADMIN_ENABLED`
- `VITE_IAM_BULK_ENABLED`

Damit sind keine Keycloak-Admin-Service-Credentials zwingend notwendig.

## Erstdeploy

Beim ersten Deploy auf ein leeres Postgres-Volume passiert automatisch:

1. Postgres wird initialisiert.
2. Alle SQL-Dateien aus `packages/data/migrations/` werden angewendet.
3. Der dedizierte Runtime-User `APP_DB_USER` wird angelegt und an `iam_app` gebunden.
4. Danach startet die App.

## Prüfung nach dem Deploy

- `app` muss in Portainer als `healthy` erscheinen.
- `GET /health/live` muss erfolgreich antworten.
- `GET /health/ready` sollte Redis und Datenbank als bereit melden.
- `/auth/login` sollte einen Redirect zum OIDC-Provider liefern.

## Update eines bestehenden Stacks

Für einen reinen App-Update ohne Schemaänderungen reicht ein Redeploy des Stacks.

Wenn neue SQL-Migrationen dazugekommen sind, reicht ein normales Redeploy **nicht**, weil `docker-entrypoint-initdb.d` nur beim ersten Initialisieren des Postgres-Volumes ausgeführt wird. Dann gibt es zwei saubere Wege:

1. Test-/Staging-System: Postgres-Volume bewusst neu anlegen und Stack frisch deployen.
2. Bestehende Datenbank behalten: Migrationen kontrolliert manuell gegen die laufende Datenbank ausführen.

## Historischer Hinweis zum Betrieb ohne Monitoring

Der hier beschriebene Ansatz mit `ENABLE_OTEL=false` entspricht **nicht** mehr dem aktuellen Zielmodell fuer produktive Umgebungen. Nach heutigem Stand gilt:

- Production-Logging laeuft ueber OTEL.
- Console- und Dev-Konsole sind dort keine regulaeren Betriebswege.
- Fehlende OTEL-Readiness gilt in Production als Fehlerzustand.

Die folgende Konstellation ist daher nur noch als historische oder provisorische Bring-up-Referenz zu verstehen, nicht als aktuelle Produktionsfreigabe.

## Nächster Schritt

Wenn der Basis-Stack stabil läuft, kann anschließend gezielt ein zweiter Compose-Stack oder eine Erweiterung für OTEL-Collector, Loki, Prometheus und Grafana ergänzt werden, ohne die Basis-Services neu zu schneiden.
