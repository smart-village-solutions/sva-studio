# Swarm-Deployment-Runbook

## Ziel

Diese Anleitung beschreibt den Rollout von SVA Studio auf einem Server mit Docker Swarm und Traefik, verwaltet über Portainer. Sie ersetzt den früheren Nicht-Swarm-Stack und folgt dem Referenz-Betriebsprofil aus [ADR-019](../adr/ADR-019-swarm-traefik-referenz-betriebsprofil.md).

Im vereinheitlichten Betriebsmodell entspricht dieses Runbook dem Profil `acceptance-hb`. Die übergeordnete Bedienlogik für `precheck`, `deploy`, `down`, `status`, `smoke` und `migrate` ist unter `../development/runtime-profile-betrieb.md` dokumentiert.

Der Stack besteht aus:

- `app` (TanStack Start / Nitro Node-Server, über Traefik exponiert)
- `adminer` (geschützte DB-Admin-Oberfläche für Acceptance-Troubleshooting)
- `postgres` (IAM Core Data Layer)
- `redis` (Session-/Cache-Store)
- `otel-collector` (OTLP Hub für Logs und Metriken)
- `loki` (Log-Storage)
- `prometheus` (Metrik-Storage und Alert Rules)
- `grafana` (interne Auswertung)
- `promtail` (Node-/Container-Log-Shipping)
- `alertmanager` (Alert-Routing)

## Betriebsziele und Eskalation

### Zielwerte

| Bereich | Zielwert |
|---|---|
| App + Monitoring | `RTO <= 2h` |
| IAM-Daten in Postgres | `RPO <= 24h` |

Die Zielwerte sind bewusst als operative Mindestziele formuliert. Sie ersetzen kein vollständiges Backup- oder HA-Konzept, sondern definieren den erwarteten Wiederanlauf- und Datenverlustrahmen für das aktuelle Referenzprofil.

### Eskalationspfad

| Fall | Primärer Kanal | Zusätzlicher Kanal |
|---|---|---|
| Betriebsstörung ohne Sensitive Data | `operations@smart-village.app` | GitHub Issue für Nachverfolgung |
| Sicherheitsvorfall oder DSGVO-Bezug | `security@smart-village.app` | `operations@smart-village.app` |
| Reine Produkt-/Doku-Nacharbeit ohne Sensitivität | GitHub Issue | - |

Regel:

- Keine sensiblen Details in öffentliche GitHub Issues schreiben.
- Für Sicherheits- oder Datenschutzvorfälle zuerst per E-Mail eskalieren und GitHub nur für später bereinigte Folgetasks nutzen.

## Voraussetzungen

- Docker Swarm ist initialisiert (`docker swarm init`)
- Traefik läuft als Ingress-Proxy im selben Swarm und lauscht auf dem `public`-Overlay-Netzwerk
- Das externe Overlay-Netzwerk `public` existiert:
  ```
  docker network create -d overlay public
  ```
- Das App-Image ist vorgebaut und in einer Container-Registry verfügbar
- DNS-Einträge für `SVA_PARENT_DOMAIN` und `*.SVA_PARENT_DOMAIN` zeigen auf den Swarm-Ingress
- TLS deckt `SVA_PARENT_DOMAIN` und `*.SVA_PARENT_DOMAIN` über denselben Ingress-Vertrag ab

## Dateien

| Datei | Zweck |
|---|---|
| `deploy/portainer/docker-compose.yml` | Swarm-Stack-Definition |
| `deploy/portainer/Dockerfile` | Build-Definition für das App-Image |
| `deploy/portainer/entrypoint.sh` | Validiert und normalisiert Runtime-Variablen vor dem App-Start |
| `deploy/portainer/otel-bootstrap.mjs` | Initialisiert OTEL vor dem Nitro-Entry im Node-Prozess |
| `deploy/portainer/monitoring/` | Swarm-spezifische Monitoring-Konfigurationen |
| `deploy/portainer/monitoring-config-init/` | Build-Kontext für das Init-Image, das Monitoring-Konfigurationen in Volumes schreibt |
| `deploy/portainer/.env.example` | Referenz aller Konfigurationsvariablen |

## Schritt 1: Stack-Variablen konfigurieren

Das Referenzprofil `acceptance-hb` wird env-only betrieben. Sowohl nicht-sensitive als auch vertrauliche Werte werden als Stack-Umgebungsvariablen in Portainer gepflegt. Referenzwerte: `.env.example`.

### Pflicht-Variablen

| Variable | Beispiel |
|---|---|
| `POSTGRES_PASSWORD` | `***` |
| `APP_DB_PASSWORD` | `***` |
| `REDIS_PASSWORD` | `***` |
| `SVA_AUTH_CLIENT_SECRET` | `***` |
| `SVA_AUTH_STATE_SECRET` | `***` |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | `***` |
| `ENCRYPTION_KEY` | `***` |
| `IAM_PII_KEYRING_JSON` | `{"k1":"***"}` |
| `SVA_PUBLIC_BASE_URL` | `https://studio.smart-village.app` |
| `SVA_PUBLIC_HOST` | `studio.smart-village.app` |
| `SVA_DB_ADMIN_HOST` | `studio-db.smart-village.app` |
| `SVA_AUTH_REDIRECT_URI` | `https://studio.smart-village.app/auth/callback` |
| `SVA_AUTH_POST_LOGOUT_REDIRECT_URI` | `https://studio.smart-village.app/` |
| `SVA_PARENT_DOMAIN` | `studio.smart-village.app` |
| `IAM_CSRF_ALLOWED_ORIGINS` | `https://studio.smart-village.app` |

### Optionale Variablen

| Variable | Default | Beschreibung |
|---|---|---|
| `SVA_REGISTRY` | `ghcr.io/smart-village-solutions` | Container-Registry für das App-Image |
| `SVA_IMAGE_REPOSITORY` | `sva-studio` | Repository-Name des App-Images |
| `SVA_MONITORING_REGISTRY` | `ghcr.io/smart-village-solutions` | Container-Registry für das Monitoring-Init-Image |
| `SVA_IMAGE_TAG` | `0.0.0-dev` | Image-Tag oder Digest; für Produktion Digest oder unveränderlichen Tag verwenden |
| `SVA_IMAGE_DIGEST` | kein Default | Verbindlicher SHA256-Digest für produktionsnahe Releases |
| `SVA_IMAGE_REF` | kein Default | Vollständige Image-Referenz `${SVA_REGISTRY}/${SVA_IMAGE_REPOSITORY}@${SVA_IMAGE_DIGEST}` |
| `SVA_MONITORING_CONFIG_INIT_IMAGE_TAG` | `0.0.0-dev` | Image-Tag des Monitoring-Init-Images; für Produktion Digest oder unveränderlichen Tag verwenden |
| `SVA_ALLOWED_INSTANCE_IDS` | leer | Nur lokaler oder migrierender Fallback; im Registry-Betrieb keine führende Freigabequelle |
| `ENABLE_OTEL` | `true` | OpenTelemetry für lokale Deaktivierungsfälle in Development; im produktionsnahen Betrieb bleibt OTEL verpflichtend |
| `OTEL_SERVICE_NAME` | `sva-studio` | Service-Name für OTEL Resource Attributes |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4318` | Interner OTLP-HTTP-Endpoint |
| `GF_SECURITY_ADMIN_PASSWORD` | kein Default | Pflichtwert für den internen Grafana-Login |
| `IAM_UI_ENABLED` | `false` | IAM-Account-UI |
| `IAM_ADMIN_ENABLED` | `false` | IAM-Admin-UI |
| `IAM_BULK_ENABLED` | `false` | IAM-Bulk-Operationen |
| `SVA_DOCTOR_KEYCLOAK_SUBJECT` | leer | optionaler Actor-Override für `env:doctor:acceptance-hb` |
| `SVA_DOCTOR_INSTANCE_ID` | erster Wert aus `SVA_ALLOWED_INSTANCE_IDS` | überschreibt die Zielinstanz für den Doctor-Lauf |
| `SVA_DOCTOR_SESSION_ROLES` | leer | kommagetrennte Session-Rollen für Rollen-Diagnose |
| `SVA_DB_ADMIN_BASIC_AUTH` | kein Default | htpasswd-String für vorgeschalteten Adminer-Basic-Auth |

Die vollständige Variablenliste inklusive Keycloak-Admin- und Rollenabgleich-Optionen steht in `deploy/portainer/.env.example`.
Für produktionsnahe Acceptance-Deployments ist `SVA_IMAGE_DIGEST` verpflichtend; `SVA_IMAGE_REF` muss auf genau dieses Artefakt zeigen. `SVA_IMAGE_TAG` bleibt nur ergänzende Metadaten für Lesbarkeit und Rückverfolgung. Wenn App- und Monitoring-Image aus unterschiedlichen Registries bezogen werden, müssen `SVA_REGISTRY` und `SVA_MONITORING_REGISTRY` konsistent gesetzt sein.

Für tenant-spezifisches Auth-Routing gilt zusätzlich:

- `authRealm` und `authClientId` müssen für jede aktive Instanz in der Registry gesetzt sein.
- Neue Instanzen sind erst nach erfolgreichem Keycloak-Provisioning traffic-fähig.
- `SVA_AUTH_ISSUER` und `SVA_AUTH_CLIENT_ID` sind im Acceptance-/Swarm-Betrieb keine führenden Variablen mehr.

### Adminer für Acceptance

Für DB-Diagnose auf `acceptance-hb` wird Adminer intern über Traefik veröffentlicht:

- eigener Host über `SVA_DB_ADMIN_HOST`
- zusätzliche Basic-Auth über `SVA_DB_ADMIN_BASIC_AUTH`
- Adminer selbst nutzt danach weiterhin die normalen Postgres-Zugangsdaten

Beispiel zum Erzeugen des Basic-Auth-Hashes:

```bash
htpasswd -nbB admin '<starkes-passwort>'
```

Der komplette Output muss unverändert als `SVA_DB_ADMIN_BASIC_AUTH` gesetzt werden.

## Schritt 1a: DNS- und TLS-Vertrag prüfen

Vor jedem Acceptance-Rollout und vor jeder neuen Instanzfreigabe muss der gemeinsame Plattformvertrag für Root- und Tenant-Hosts erfüllt sein:

- `studio.smart-village.app` zeigt auf den gemeinsamen Swarm-/Traefik-Ingress
- `*.studio.smart-village.app` zeigt auf denselben Ingress
- das Zertifikat deckt Root-Domain und Wildcard ab
- Root-Host und Tenant-Hosts landen auf demselben App-Service

Stichproben:

```bash
dig +short studio.smart-village.app
dig +short hb-meinquartier.studio.smart-village.app
curl -I https://studio.smart-village.app
curl -I https://hb-meinquartier.studio.smart-village.app
```

### Ressourcenlimits des Referenzprofils

| Service | CPU-Limit |
|---|---|
| `app` | `1.0` |
| `postgres` | `0.5` |
| `redis` | `0.25` |
| `monitoring-config-init` | `0.10` |
| `otel-collector` | `0.25` |
| `loki` | `0.75` |
| `prometheus` | `1.0` |
| `grafana` | `0.5` |
| `promtail` | `0.25` |
| `alertmanager` | `0.25` |

## Schritt 2: Datenbank initialisieren

Im Swarm-Stack sind keine automatischen DB-Initialisierungsskripte enthalten. Beim ersten Deploy auf ein leeres Postgres-Volume muss die Datenbank manuell initialisiert werden.

### Migrationen ausführen

Die SQL-Dateien müssen als Artefakt bereitgestellt werden (z. B. CI-Artefakt, Release-Asset oder separates Migrationsbundle). Ein Repository-Checkout auf dem Swarm-Node ist nicht erforderlich.

Bevorzugter Betriebsweg aus dem Repository heraus:

```bash
cd "$(git rev-parse --show-toplevel)"
pnpm env:migrate:acceptance-hb
```

Der Befehl wendet die kanonischen `goose`-Migrationen aus `packages/data/migrations/*.sql` gegen den laufenden Acceptance-Postgres an:

- bevorzugt remote via `quantum-cli exec --endpoint sva --stack sva-studio --service postgres`
- nur als Fallback lokal via `docker exec`, wenn der Swarm-Postgres auf demselben Docker-Daemon sichtbar ist
- `goose` wird mit gepinnter Version temporär bereitgestellt; eine permanente Installation auf dem Zielsystem ist nicht erforderlich
- nach erfolgreichem Migrationslauf validiert ein kritischer IAM-Schema-Guard automatisch Tabellen, Spalten, Indizes und RLS-Policies
- bei Drift endet der Befehl mit einem maschinenlesbaren Fehlerbild statt mit einem stillschweigend unvollständigen Zustand

Damit ist kein manuelles Paste-in-`psql` mehr erforderlich.

Das Fallback über manuelle `psql`-Schleifen bleibt nur für Recovery-Sonderfälle reserviert; der kanonische Betriebsweg ist `pnpm env:migrate:acceptance-hb`.

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

`<APP_DB_PASSWORD>` muss dem Wert der Stack-Variable `APP_DB_PASSWORD` entsprechen.

## Schritt 3: Kanonischen Acceptance-Deploy ausführen

Der reguläre Serverdeploy für `acceptance-hb` läuft nur noch über den orchestrierten Einstiegspunkt `pnpm env:deploy:acceptance-hb`. Direkte Acceptance-Redeploys über `up`/`update`, Portainer-Klickpfade oder Ad-hoc-`docker stack deploy` sind nicht mehr der verbindliche Standard.

### Release-Klassen

- `app-only`: reiner Image-/Konfigurationsrollout ohne Schemaänderung
- `schema-and-app`: Migrationen plus nachgelagerter Stack-Rollout; erfordert ein dokumentiertes Wartungsfenster

### Empfohlene Reihenfolge

```bash
cd "$(git rev-parse --show-toplevel)"

pnpm env:precheck:acceptance-hb
pnpm env:deploy:acceptance-hb -- --release-mode=app-only --image-tag=<unveraenderlicher-tag>
```

Für Schemaänderungen:

```bash
cd "$(git rev-parse --show-toplevel)"

pnpm env:deploy:acceptance-hb -- \
  --release-mode=schema-and-app \
  --maintenance-window="2026-03-20 19:00-19:15 CET" \
  --image-tag=<unveraenderlicher-tag> \
  --rollback-hint="Vorherigen Digest erneut deployen"
```

Der Deploypfad führt verbindlich aus:

1. `environment-precheck` inklusive Pflichtvariablen, Schema-Guard und Live-Spec-Drift
2. `image-smoke` gegen das Digest-Artefakt
3. `migrate` bei `schema-and-app`
4. Stack-Rollout via `quantum-cli stacks update` oder `docker stack deploy`
5. `internal-verify` mit internen Probes und `doctor`
6. `external-smoke`
7. `release-decision`
8. Schreiben eines Deploy-Reports unter `artifacts/runtime/deployments/`

## Schritt 3a: Neue Instanz im Registry-Modell anlegen

Neue Instanzen werden nicht mehr über `SVA_ALLOWED_INSTANCE_IDS`, neue Stacks oder neue Runtime-Profile freigeschaltet. Der verbindliche Pfad läuft über die zentrale Instanz-Registry.

Zulässige Einstiege:

- Studio-Control-Plane auf dem Root-Host unter `/admin/instances`
- nicht-interaktive CLI unter `scripts/ops/instance-registry.ts`

Beispiel:

```bash
pnpm exec tsx scripts/ops/instance-registry.ts create \
  --instance-id hb-neu \
  --display-name "HB Neu" \
  --parent-domain studio.smart-village.app \
  --actor-id release-operator
pnpm exec tsx scripts/ops/instance-registry.ts activate \
  --instance-id hb-neu \
  --actor-id release-operator
```

Prüfkriterien:

- Registry-Eintrag existiert
- `primaryHostname` entspricht `<instanceId>.studio.smart-village.app`
- Status ist nach Freigabe `active`
- kein neues App-Deployment und kein neues Runtime-Profil wurden benötigt

### Fallback über Portainer oder CLI

Dieser Pfad bleibt nur Fallback für Ausnahmefälle oder die initiale Stack-Anlage. Danach muss die Verifikation immer wieder über `pnpm env:doctor:acceptance-hb` und `pnpm env:smoke:acceptance-hb` abgesichert werden.

#### Über Portainer

1. Neuen Stack anlegen (Typ: Swarm)
2. Compose-Pfad: `deploy/portainer/docker-compose.yml`
3. Umgebungsvariablen aus Schritt 2 eintragen
4. Deploy auslösen

#### Über CLI

```bash
cd "$(git rev-parse --show-toplevel)"
quantum-cli stacks update --environment swarm-secrets --endpoint sva --stack sva-studio --project . --wait
```

## Schritt 4: Diagnose, Smoke und Evidenz

Verbindliche Reihenfolge nach jedem Acceptance-Deploy:

```bash
pnpm env:doctor:acceptance-hb
pnpm env:smoke:acceptance-hb
```

Der kanonische Deploypfad erzeugt zusätzlich pro Lauf Artefakte unter `artifacts/runtime/deployments/`:

- JSON-Report für CI-Weiterverarbeitung
- Markdown-Report für Menschen
- Release-Manifest mit Commit, Digest, Image-Ref, Actor und Workflow
- Ergebnis von `environment-precheck`, `image-smoke`, `migrate`, `deploy`, `internal-verify`, `external-smoke` und `release-decision`
- separate JSON-Artefakte für Phasenstatus, Migration, interne Probes und externe Probes
- referenzierbaren Stack-Status und optionale Grafana-/Loki-Links

Unmittelbar danach:

```bash
pnpm env:feedback:acceptance-hb
```

Der Befehl erzeugt:

- `release-feedback-summary.json` und `release-feedback-summary.md` als Verlaufssicht
- `<reportId>.review.md` als Review-Entwurf fuer den juengsten Deploy

Wenn der Deploy fehlgeschlagen ist oder nur mit manueller Nacharbeit stabil wurde, wird der Review-Entwurf nach `docs/reports/` uebernommen und dort verbindlich vervollstaendigt.

`doctor` ergänzt die Betriebsprüfung um:

- Schema-Drift-Erkennung für kritische IAM-Artefakte
- Actor-/Membership-Diagnose über `SVA_DOCTOR_*`
- nicht-sensitive `reason_code`s für DB-, Redis-, Keycloak- und IAM-Pfade
- Remote-Service-Status via `quantum-cli`

Stabile Diagnosecodes umfassen unter anderem:

- `missing_table`
- `missing_column`
- `missing_actor_account`
- `missing_instance_membership`
- `schema_drift`
- `database_connection_failed`
- `keycloak_dependency_failed`

| Prüfung | Erwartung |
|---|---|
| `GET https://<SVA_PARENT_DOMAIN>/health/live` | HTTP 200 |
| `GET https://<SVA_PARENT_DOMAIN>/health/ready` | HTTP 200, Redis + DB bereit |
| `GET https://<SVA_PARENT_DOMAIN>/auth/login` | Redirect zum OIDC-Provider |
| `GET https://<aktive-instance>.<SVA_PARENT_DOMAIN>/` | HTTP 200 ohne neues Deployment |
| `GET https://unknown.<SVA_PARENT_DOMAIN>/` | fail-closed, ohne tenant-spezifische Detailoffenlegung |
| `GET https://<suspendierte-instance>.<SVA_PARENT_DOMAIN>/auth/me` | gleiches fail-closed-Verhalten wie unbekannter Host |
| App in Portainer | Status: `healthy` |
| Monitoring-Services in Portainer | `otel-collector`, `loki`, `prometheus`, `grafana`, `promtail`, `alertmanager` laufen |

Für IAM-Abnahmen zusätzlich:

- `/api/v1/iam/me/context` liefert keinen generischen `403` ohne diagnostischen `reason_code`
- `/api/v1/iam/users/me/profile` liefert keinen generischen `500` ohne diagnostischen Kontext
- OTEL-Spans für IAM-Requests enthalten korrelierbare Diagnoseattribute zu Dependency-Status, Actor-Auflösung und Schema-Guard

### Hinweis zum Monitoring-Bootstrap

`monitoring-config-init` ist als One-shot-Service ausgelegt. Er schreibt die versionierten Konfigurationsdateien in die benannten Volumes, setzt die benötigten Rechte und beendet sich danach erfolgreich. Das ist beabsichtigt und kein Fehlerzustand.

## Update eines bestehenden Stacks

Für ein reines App-Update ohne Schemaänderungen:

1. Neues Image mit unveränderlichem Tag oder Digest bereitstellen
2. `pnpm env:deploy:acceptance-hb -- --release-mode=app-only --image-tag=<tag>` ausführen
   - zusätzlich ist `--image-digest=<sha256:...>` verpflichtend
3. Deploy-Report prüfen und archivieren

Für Schemaänderungen:

1. Wartungsfenster definieren
2. `pnpm env:deploy:acceptance-hb -- --release-mode=schema-and-app --maintenance-window=...` ausführen
   - zusätzlich ist `--image-digest=<sha256:...>` verpflichtend
3. Deploy-Report auf `migrate`, `internal-verify`, `external-smoke` und `release-decision` prüfen

## Rollback

### App-Rollback (ohne Schemaänderung)

```bash
pnpm env:deploy:acceptance-hb -- --release-mode=app-only --image-tag=<vorheriger-unveraenderlicher-tag>
```

### Bei Schemaänderungen

Ein Rollback über eine destruktive Migration hinweg erfordert einen DB-Restore oder einen bewusst dokumentierten Rückweg. Für die aktuelle Development-Phase mit frischen Instanzen ist der einfachste Weg:

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

## Betrieb mit integriertem Monitoring

Das Referenzprofil aktiviert OTEL standardmäßig. Die App initialisiert das SDK direkt beim Prozessstart über `node --import ./otel-bootstrap.mjs .output/server/index.mjs`, damit Logs und Metriken nicht vom ersten Root-Request abhängen.

Die Monitoring-Konfigurationen werden nicht mehr als langes Inline-Compose-Kommando ausgerollt. Stattdessen schreibt ein eigenes `monitoring-config-init`-Image die versionierten Dateien aus `deploy/portainer/monitoring/` in die dafür vorgesehenen Named Volumes.

Der Monitoring-Block bleibt intern:

- `grafana`, `prometheus`, `loki`, `otel-collector`, `promtail` und `alertmanager` hängen nur am `internal`-Overlay.
- Nur `app` ist über Traefik öffentlich exponiert.
- Für externen Grafana-Zugriff ist eine separate Zugangsschicht erforderlich (z. B. VPN, Forward-Proxy oder dedizierter interner Ingress).

### Bekannte Lücken

- **Alertmanager-Receiver nicht konfiguriert:** Der `default`-Receiver in `alertmanager.yml` hat kein reales Ziel (Webhook, E-Mail, Slack). Alle Alert-Rules werden evaluiert, aber nicht zugestellt. Für den Produktivbetrieb muss ein Receiver konfiguriert werden.
- **Kein automatisiertes Postgres-Backup:** Aktuell ist nur manuelles `pg_dump` dokumentiert. Für den dauerhaften Betrieb wird ein automatisierter Backup-Cronjob mit Retention-Policy und Off-Site-Sicherung benötigt.
- **Single-Node-Pinning:** Alle Services sind auf `node-005.sva` gepinnt. Bei Ausfall dieses Nodes ist der gesamte Stack nicht verfügbar. Für HA-Betrieb ist eine Multi-Node-Strategie erforderlich.

## Instanz-Routing

### Modell

Instanzen werden über Subdomains adressiert: `<instanceId>.<SVA_PARENT_DOMAIN>`.

- `foo.studio.smart-village.app` → `instanceId = "foo"`
- Die Registry ist die führende Quelle für gültige Instanzen und Hostnamen
- `SVA_ALLOWED_INSTANCE_IDS` bleibt nur lokaler oder migrierender Fallback
- Root-Domain (`studio.smart-village.app`) ist der kanonische Auth-Host
- OIDC-Login/Logout-Flows laufen ausschließlich über den kanonischen Auth-Host

### Restriktionen

- Genau ein DNS-Label links der Parent-Domain erlaubt
- Nur `[a-z0-9]` und `-`, maximal 63 Zeichen, kein Punycode (`xn--`)
- Unbekannte, ungültige oder Root-Domain-Hosts erhalten identische 403-Antwort
- Die Allowlist ist für ≤ 50 Instanzen ausgelegt; bei Wachstum darüber hinaus ist eine DB-gestützte Registry geplant
