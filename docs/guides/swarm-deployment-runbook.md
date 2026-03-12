# Swarm-Deployment-Runbook

## Ziel

Diese Anleitung beschreibt den Rollout von SVA Studio auf einem Server mit Docker Swarm und Traefik, verwaltet über Portainer. Sie ersetzt den früheren Nicht-Swarm-Stack und folgt dem Referenz-Betriebsprofil aus [ADR-019](../adr/ADR-019-swarm-traefik-referenz-betriebsprofil.md).

Der Stack besteht aus:

- `app` (TanStack Start / Nitro Node-Server, über Traefik exponiert)
- `postgres` (IAM Core Data Layer)
- `redis` (Session-/Cache-Store)

## Voraussetzungen

- Docker Swarm ist initialisiert (`docker swarm init`)
- Traefik läuft als Ingress-Proxy im selben Swarm und lauscht auf dem `public`-Overlay-Netzwerk
- Das externe Overlay-Netzwerk `public` existiert:
  ```
  docker network create -d overlay public
  ```
- Das App-Image ist vorgebaut und in einer Container-Registry verfügbar
- DNS-Einträge für `SVA_PARENT_DOMAIN` und `*.SVA_PARENT_DOMAIN` zeigen auf den Swarm-Ingress

## Dateien

| Datei | Zweck |
|---|---|
| `deploy/portainer/docker-compose.yml` | Swarm-Stack-Definition |
| `deploy/portainer/Dockerfile` | Build-Definition für das App-Image |
| `deploy/portainer/entrypoint.sh` | Lädt Swarm-Secrets als Env-Variablen |
| `deploy/portainer/.env.example` | Referenz aller Konfigurationsvariablen |

## Schritt 1: Secrets provisionieren

Alle vertraulichen Werte werden als externe Docker-Swarm-Secrets bereitgestellt. Jedes Secret wird aus einer Datei erstellt. Die Dateien dürfen anschließend gelöscht werden.

```bash
# Auth-Secrets
docker secret create sva_studio_app_auth_client_secret ./secrets/oidc-client-secret.txt
docker secret create sva_studio_app_auth_state_secret ./secrets/state-secret.txt

# Verschlüsselung
docker secret create sva_studio_app_encryption_key ./secrets/encryption-key.txt
docker secret create sva_studio_app_pii_keyring_json ./secrets/pii-keyring.json

# Datenbank
docker secret create sva_studio_postgres_password ./secrets/postgres-password.txt
docker secret create sva_studio_app_db_password ./secrets/app-db-password.txt

# Redis
docker secret create sva_studio_redis_password ./secrets/redis-password.txt

# Keycloak-Admin (optional)
docker secret create sva_studio_keycloak_admin_client_secret ./secrets/keycloak-admin-client-secret.txt
```

Nach dem Provisionieren sollten die lokalen Secret-Dateien sicher gelöscht oder außerhalb der Shell-History verwaltet werden.

### Namenskonvention

`sva_studio_<service>_<secret_name>` – siehe Klassifizierungstabelle in `design.md`.

### Secret-Rotation

Bei Kompromittierung oder planmäßiger Rotation:

1. Neues Secret mit temporärem Namen erstellen
2. Stack-Datei auf neuen Secret-Namen anpassen
3. Stack neu deployen
4. Altes Secret löschen: `docker secret rm <alter_name>`

## Schritt 2: Stack-Variablen konfigurieren

Die nicht-sensitiven Konfigurationswerte werden als Stack-Umgebungsvariablen in Portainer gepflegt. Referenzwerte: `.env.example`.

### Pflicht-Variablen

| Variable | Beispiel |
|---|---|
| `SVA_PUBLIC_BASE_URL` | `https://studio.smart-village.app` |
| `SVA_AUTH_ISSUER` | `https://keycloak.example.org/realms/sva` |
| `SVA_AUTH_CLIENT_ID` | `sva-studio` |
| `SVA_AUTH_REDIRECT_URI` | `https://studio.smart-village.app/auth/callback` |
| `SVA_AUTH_POST_LOGOUT_REDIRECT_URI` | `https://studio.smart-village.app/` |
| `SVA_PARENT_DOMAIN` | `studio.smart-village.app` |
| `IAM_CSRF_ALLOWED_ORIGINS` | `https://studio.smart-village.app` |

### Optionale Variablen

| Variable | Default | Beschreibung |
|---|---|---|
| `SVA_REGISTRY` | `ghcr.io/smart-village-solutions` | Container-Registry |
| `SVA_IMAGE_TAG` | `latest` | Image-Tag oder Digest |
| `SVA_ALLOWED_INSTANCE_IDS` | leer | Kommagetrennte erlaubte instanceIds |
| `ENABLE_OTEL` | `false` | OpenTelemetry aktivieren |
| `IAM_UI_ENABLED` | `false` | IAM-Account-UI |
| `IAM_ADMIN_ENABLED` | `false` | IAM-Admin-UI |
| `IAM_BULK_ENABLED` | `false` | IAM-Bulk-Operationen |

Die vollständige Variablenliste inklusive Keycloak-Admin- und Rollenabgleich-Optionen steht in `deploy/portainer/.env.example`.

## Schritt 3: Datenbank initialisieren

Im Swarm-Stack sind keine automatischen DB-Initialisierungsskripte enthalten. Beim ersten Deploy auf ein leeres Postgres-Volume muss die Datenbank manuell initialisiert werden.

### Migrationen ausführen

```bash
# Postgres-Container identifizieren
docker ps --filter name=sva-studio_postgres

# Migrationen kopieren und ausführen
docker cp packages/data/migrations/up/. <CONTAINER_ID>:/tmp/migrations/
docker exec <CONTAINER_ID> sh -c '
  for f in /tmp/migrations/*.sql; do
    echo "Applying $f"
    psql -v ON_ERROR_STOP=1 -U sva -d sva_studio -f "$f"
  done
'
```

### Runtime-User anlegen

```bash
docker exec <CONTAINER_ID> psql -v ON_ERROR_STOP=1 -U sva -d sva_studio -c "
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sva_app') THEN
    CREATE ROLE sva_app LOGIN PASSWORD '<APP_DB_PASSWORD>'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
\$\$;
GRANT iam_app TO sva_app;
"
```

`<APP_DB_PASSWORD>` muss dem Wert des Swarm-Secrets `sva_studio_app_db_password` entsprechen.

## Schritt 4: Stack deployen

### Über Portainer

1. Neuen Stack anlegen (Typ: Swarm)
2. Compose-Pfad: `deploy/portainer/docker-compose.yml`
3. Umgebungsvariablen aus Schritt 2 eintragen
4. Deploy auslösen

### Über CLI

```bash
cd deploy/portainer
# .env mit den Werten aus .env.example befüllen
docker stack deploy -c docker-compose.yml sva-studio
```

## Schritt 5: Smoke-Check

| Prüfung | Erwartung |
|---|---|
| `GET https://<SVA_PARENT_DOMAIN>/health/live` | HTTP 200 |
| `GET https://<SVA_PARENT_DOMAIN>/health/ready` | HTTP 200, Redis + DB bereit |
| `GET https://<SVA_PARENT_DOMAIN>/auth/login` | Redirect zum OIDC-Provider |
| `GET https://foo.<SVA_PARENT_DOMAIN>/` | HTTP 200 (wenn `foo` in Allowlist) |
| `GET https://unknown.<SVA_PARENT_DOMAIN>/` | HTTP 403 (wenn nicht in Allowlist) |
| App in Portainer | Status: `healthy` |

## Update eines bestehenden Stacks

Für ein reines App-Update ohne Schemaänderungen:

1. Neues Image bauen und in die Registry pushen
2. `SVA_IMAGE_TAG` auf den neuen Tag setzen
3. Stack in Portainer aktualisieren (Redeploy)

Swarm führt ein Rolling-Update durch (`start-first`): der neue Container startet, bevor der alte gestoppt wird.

### Schemaänderungen

Neue SQL-Migrationen erfordern einen bewussten, separaten Schritt:

1. Postgres-Container identifizieren
2. Neue Migrationen manuell ausführen (siehe Schritt 3)
3. Danach den App-Stack mit dem neuen Image redeployen

## Rollback

### App-Rollback (ohne Schemaänderung)

```bash
# Vorherigen Tag setzen und redeployen
docker service update --image <registry>/sva-studio:<vorheriger-tag> sva-studio_app
```

### Bei Schemaänderungen

Ein Rollback über eine destruktive Migration hinweg erfordert einen DB-Restore. Für die aktuelle Development-Phase mit frischen Instanzen ist der einfachste Weg:

1. Postgres-Volume löschen
2. Stack frisch deployen
3. Datenbank neu initialisieren (Schritt 3)

## Persistenz

| Service | Volume | Placement |
|---|---|---|
| Postgres | `postgres-data` | `node.role == manager` |
| Redis | `redis-data` | `node.role == manager` |

Die Placement-Constraints stellen sicher, dass Volumes auf demselben Node bleiben. Bei Cluster-Erweiterung müssen die Constraints ggf. angepasst werden.

### Restore-Pfad

Postgres:

```bash
# Backup
docker exec <CONTAINER_ID> pg_dump -U sva -d sva_studio > backup.sql

# Restore in neues Volume
docker exec -i <CONTAINER_ID> psql -U sva -d sva_studio < backup.sql
```

## Betrieb ohne Monitoring

`ENABLE_OTEL=false` ist der Standardwert. Logs laufen über Docker/Portainer. Ein separater Monitoring-Stack (OTEL, Loki, Prometheus, Grafana) ist als Folgearbeit geplant.

## Instanz-Routing

### Modell

Instanzen werden über Subdomains adressiert: `<instanceId>.<SVA_PARENT_DOMAIN>`.

- `foo.studio.smart-village.app` → `instanceId = "foo"`
- Nur Einträge aus `SVA_ALLOWED_INSTANCE_IDS` sind gültig
- Root-Domain (`studio.smart-village.app`) ist der kanonische Auth-Host
- OIDC-Login/Logout-Flows laufen ausschließlich über den kanonischen Auth-Host

### Restriktionen

- Genau ein DNS-Label links der Parent-Domain erlaubt
- Nur `[a-z0-9]` und `-`, maximal 63 Zeichen, kein Punycode (`xn--`)
- Unbekannte, ungültige oder Root-Domain-Hosts erhalten identische 403-Antwort
- Die Allowlist ist für ≤ 50 Instanzen ausgelegt; bei Wachstum darüber hinaus ist eine DB-gestützte Registry geplant
