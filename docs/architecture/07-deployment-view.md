# 07 Verteilungssicht

## Zweck

Dieser Abschnitt beschreibt die technische Verteilung auf Umgebungen und
Laufzeitknoten auf Basis des aktuellen Repos.

## Mindestinhalte

- Deployment-Topologie (lokal, CI, staging, production)
- Abhängigkeiten zu externen Diensten (z. B. Redis, OTEL, Loki)
- Sicherheits- und Betriebsaspekte je Umgebung

## Aktueller Stand

### Lokale Entwicklungsverteilung

- App: `pnpm nx run sva-studio-react:serve` auf `localhost:3000`
- Postgres IAM-DB: `docker-compose.yml` (`5432`)
- Redis: `docker-compose.yml` (`6379`, optional TLS `6380`)
- Monitoring Stack: `docker-compose.monitoring.yml`
  - Collector: `4317`, `4318`, `13133`
  - Loki: `3100`
  - Prometheus: `9090`
  - Grafana: `3001`
  - Promtail: `3101`
  - Alertmanager: `9093`
  - Redis Exporter: `9121` (für Redis-/Permission-Cache-Metriken im Zielbild)

### Deployment-Bausteine (logisch)

- Web-App Runtime (TanStack Start / Node)
- Nx-/pnpm-basierte Build- und Test-Pipeline
- Separates IAM-Acceptance-Gate für Paket-1-/2-Abnahmen
- Externe Plattform (GitHub Actions) für CI-Ausführung
- Keycloak als zentraler OIDC Identity Provider
- Redis Session Store
- Redis Permission Snapshot Cache als primärer Shared-Read-Path für effektive IAM-Berechtigungen
- Postgres IAM Core Data Layer
- OTEL Collector als Telemetrie-Hub
- Loki/Prometheus als Storage, Grafana für Auswertung
- `redis-exporter` als Prometheus-Scrape-Target für Redis-Infrastrukturmetriken

### Ergänzung 2026-03: Minimaler Server-Rollout mit Portainer

> **Hinweis:** Der ursprüngliche, nicht-Swarm-basierte Portainer-Stack ist durch das Swarm-Referenz-Betriebsprofil ersetzt. Die folgenden Abschnitte beschreiben den aktuellen Stand.

### Swarm-/Traefik-Referenz-Betriebsprofil (ab 2026-03)

Für den serverbasierten Betrieb ist ein Docker-Swarm-Stack mit Traefik als Ingress-Proxy definiert:

- Compose-Datei: `deploy/portainer/docker-compose.yml`
- Services: `app`, `postgres`, `redis`, `otel-collector`, `loki`, `prometheus`, `grafana`, `promtail`, `alertmanager`
- Monitoring bleibt intern auf dem Overlay-Netzwerk; nur die App hängt zusätzlich am `public`-Netzwerk

#### Topologie

```
Internet
  │
  ▼
Traefik (Ingress, TLS, HostRegexp-Routing)
  │  Overlay-Netzwerk „public"
  ▼
┌──────────────────────────────────────────────────────────────┐
│  Swarm-Stack „sva-studio"                                    │
│                                                              │
│  app ←──── internes Overlay ────→ redis                      │
│   │                                     │                    │
│   ├──── internes Overlay ────→ postgres │                    │
│   │                                     │                    │
│   └──── internes Overlay ────→ otel-collector ──→ Loki       │
│                                         │         │           │
│                                         └──────→ Prometheus   │
│                                                   │           │
│                                           Grafana + Alerting  │
│                                           Promtail (Node-Logs)│
└──────────────────────────────────────────────────────────────┘
```

#### Demo-Profil

Neben dem Referenzprofil mit Docker Swarm Secrets existiert ein vereinfachtes
Demo-Profil (`deploy/portainer/docker-compose.demo.yml`) für Evaluierungs-
und Vorführungszwecke. Unterschiede zum Referenzprofil:

- Secrets werden als Umgebungsvariablen statt Docker Swarm Secrets übergeben
- Konfiguration über `deploy/portainer/.env.demo.example`
- Quantum-CLI-Unterstützung über `.quantum`-Datei im Repository-Root
- Traefik-v1-kompatible Labels statt der v2+-Router-Labels des Referenzprofils
- Nicht für Produktionseinsatz vorgesehen

#### Deployment-Muster

- Der Build-Graph des Portainer-Images baut `sva-mainserver` explizit nach `auth` und vor `plugin-example`, damit die serverseitige Integrationsschicht im Deploy-Artefakt verlässlich vorhanden ist.

- **Image-basiert:** Vorgebaute Images aus Container-Registry; für die App ist im Acceptance-Referenzpfad `SVA_IMAGE_REF` mit Digest verpflichtend, der Tag bleibt nur Metadatum. Kein `build:`-Block im Stack.
- **Traefik-Labels:** Host-basiertes Routing über `HostRegexp` für Instanz-Subdomains unter `SVA_PARENT_DOMAIN`. TLS über Traefiks `certresolver`.
- **Profilgrenze Traefik:** Das Referenzprofil verwendet Traefik v2+-Labels; das Demo-Profil bleibt bewusst bei Traefik-v1-kompatiblen Labels und ist deshalb kein 1:1-Abbild des Referenzbetriebs.
- **Swarm Secrets:** Vertrauliche Werte als externe Docker-Swarm-Secrets mit Namenskonvention `sva_studio_<service>_<secret_name>`. Ein Shell-Entrypoint (`entrypoint.sh`) liest Secret-Dateien und exportiert sie als Env-Variablen.
- **Versionierte Monitoring-Konfigurationen:** Prometheus-, Loki-, Grafana-, Promtail- und Alertmanager-Konfigurationen liegen versioniert im Repository und werden über ein dediziertes `monitoring-config-init`-Image einmalig in die Swarm-Volumes geschrieben.
- **Rolling Updates:** `start-first` für Updates, `stop-first` für Rollbacks.
- **Kanonischer Acceptance-Releasepfad:** `acceptance-hb` nutzt den orchestrierten Pfad `environment-precheck -> image-smoke -> optional migrate -> deploy -> internal-verify -> external-smoke -> release-decision -> Deploy-Report`.
- **Release-Klassen:** Acceptance-Deploys unterscheiden `app-only` und `schema-and-app`; nur `schema-and-app` darf Migrationen auslösen.
- **Deploy-Evidenz:** Jeder Acceptance-Deploy schreibt JSON- und Markdown-Artefakte unter `artifacts/runtime/deployments/` mit Image-, Actor-, Workflow-, Stack- und Verifikationsdaten.
- **Health-Modell:** `live` bleibt prozessnah und ohne schwere optionale Abhängigkeiten; `ready` bildet nur minimale Traffic-Voraussetzungen ab; öffentliche Freigabe erfolgt erst über externe Smoke-Probes.
- **Persistenz:** Named Volumes für Postgres, Redis, Prometheus, Loki, Grafana und Alertmanager.
- **Monitoring-Bootstrap:** Der Node-Prozess lädt OpenTelemetry vor dem Nitro-Entry per `--import`, statt erst beim ersten Root-Request.
- **Ressourcenprofile:** Das Referenzprofil setzt CPU-Limits für App, Datenbank und Monitoring-Services, damit der Stack auf kleinen Swarm-Nodes kontrolliert bleibt.
- **Redis-Keyspaces:** Session-/Login-State und Permission-Snapshots teilen sich höchstens die Infrastruktur, werden aber fachlich getrennt behandelt (`session:*` vs. `perm:v1:*`).
- **Eviction-Policy:** Für den Permission-Snapshot-Keyspace ist `allkeys-lru` verbindlich; wenn Session- und Snapshot-Keys dieselbe Redis-Instanz nutzen, muss das Betriebsprofil Evictions getrennt überwachen oder die Keyspaces logisch/physisch separieren.

#### Instanz-Routing

- `<instanceId>.<SVA_PARENT_DOMAIN>` → Instanz-Kontext
- Root-Domain (`SVA_PARENT_DOMAIN`) → Kanonischer Auth-Host
- Env-basierte Allowlist (`SVA_ALLOWED_INSTANCE_IDS`) als autoritative Freigabequelle
- Startup-Validierung gegen `instanceId`-Regex, fail-fast bei ungültigen Einträgen

#### DB-Initialisierung

Im Swarm-Stack sind keine automatischen Initialisierungsskripte enthalten. Die DB-Einrichtung bleibt ein bewusster Betriebsschritt, wird für `acceptance-hb` aber über den offiziellen `env:migrate`-/`env:deploy`-Pfad statt über ad-hoc SQL oder implizite Redeploys gesteuert. Details im [Swarm-Deployment-Runbook](../guides/swarm-deployment-runbook.md).

Betriebliche Einordnung:

- App läuft als Node-/Nitro-Server aus dem TanStack-Start-Build.
- Für spätere Updates bestehender Datenbanken bleiben Migrationen ein bewusster separater Betriebsschritt.

Referenzen:

- `deploy/portainer/docker-compose.yml`
- `deploy/portainer/entrypoint.sh`
- `docs/guides/swarm-deployment-runbook.md`
- `docs/guides/swarm-deployment-guide.md`
- `docs/adr/ADR-019-swarm-traefik-referenz-betriebsprofil.md`
- `docs/adr/ADR-020-kanonischer-auth-host-multi-host-grenze.md`

### Sicherheits-/Betriebsaspekte

- Monitoring-Ports in Compose explizit auf `127.0.0.1` gebunden
- Redis TLS-Unterstützung vorhanden, in local Dev optional
- Postgres mit Healthcheck (`pg_isready`) und separatem Volume
- Healthchecks für zentrale Monitoring-Services konfiguriert
- Graceful OTEL Shutdown im SDK vorgesehen
- `/health/ready` bewertet den Authorization-Cache separat über `checks.authorizationCache` mit den Zuständen `ready`, `degraded` und `failed`
- `degraded` gilt für den Permission-Cache bei Redis-Latenz > `50 ms` oder Recompute-Rate > `20/min`; `failed` bei drei aufeinanderfolgenden Redis-Fehlern
- Session-Ausfälle und Permission-Cache-Ausfälle werden operativ getrennt behandelt: Session-Wiederherstellung folgt dem Plattform-RTO, Snapshots sind flüchtig und werden aus Postgres rekonstruiert
- Keycloak wird aktuell als externer Dienst angebunden (nicht über Repo-Compose provisioniert)
- Das IAM-Acceptance-Gate läuft gegen eine bereits vorhandene Testumgebung und startet keine eigene Keycloak-Topologie im Workflow.
- Swarm-Stack: Secrets als externe Swarm-Secrets, nicht als Klartext-Env-Variablen
- Swarm-Stack: Entrypoint-basierte Secret-Injektion, abwärtskompatibel mit Nicht-Swarm-Betrieb
- Swarm-Stack: Host-Validierung gegen Env-Allowlist mit fail-closed-Policy (identische 403-Antwort)
- Swarm-Stack: Startup-Validierung der Allowlist gegen `instanceId`-Regex (fail-fast)
- Swarm-Stack: Monitoring-UI und Storage bleiben intern; keine öffentliche Exponierung ohne zusätzliche Zugangskontrolle
- Swarm-Stack: `monitoring-config-init` ist ein One-shot-Initialisierer und soll nach erfolgreicher Volume-Befüllung beendet sein
- Swarm-Stack: `postgres-schema-bootstrap` ist nur noch ein Legacy-Übergangspfad; der reguläre Schemarollout erfolgt über `pnpm env:migrate:acceptance-hb` bzw. `pnpm env:deploy:acceptance-hb -- --release-mode=schema-and-app`
- Operative Zielwerte für das Referenzprofil: `RTO <= 2h` für App/Monitoring und Session-Store, `RTO <= 15 min` für den rekonstruierbaren Permission-Cache, `RPO <= 24h` für IAM-Daten in Postgres
- Primäre betriebliche Eskalation via `operations@smart-village.app`, Sicherheits-/DSGVO-Eskalation via `security@smart-village.app`

### Noch offen (Stand heute)

- HA-/Skalierungsdetails für produktiven Betrieb sind nur teilweise als ADR/Doku beschrieben
- Sichere externe Erreichbarkeit für Grafana oder alternative interne Zugriffswege sind noch kein Teil des Referenzprofils
- DB-gestützte `instanceId`-Registry bei Wachstum über 50 Instanzen

Referenzen:

- `docker-compose.yml` (lokale Entwicklung)
- `docker-compose.monitoring.yml`
- `deploy/portainer/docker-compose.yml` (Swarm-Referenzprofil)
- `docs/development/postgres-setup.md`
- `docs/guides/swarm-deployment-runbook.md`
- `packages/sdk/src/server/bootstrap.server.ts`

### Ergänzung 2026-03: IAM-Admin-Integration

Für den produktiven Betrieb der Account-/Admin-UI sind zusätzlich erforderlich:

- Keycloak Service-Account `sva-studio-iam-service` mit Minimalrechten (`manage-users`, `view-users`, `view-realm`, `manage-realm`).
- Secret-Injektion für `KEYCLOAK_ADMIN_CLIENT_SECRET` über Secrets-Manager (nicht im Repository).
- Feature-Flags auf Backend-Seite:
  - `IAM_UI_ENABLED`
  - `IAM_ADMIN_ENABLED`
  - `IAM_BULK_ENABLED`
- Scheduler-Konfiguration für Rollen-Reconciliation:
  - `IAM_ROLE_RECONCILE_INTERVAL_MS`
  - `IAM_ROLE_RECONCILE_INSTANCE_IDS`
- Optional korrespondierende Frontend-Flags:
  - `VITE_IAM_UI_ENABLED`
  - `VITE_IAM_ADMIN_ENABLED`
  - `VITE_IAM_BULK_ENABLED`

Rollout-Reihenfolge:

1. Datenbankmigrationen (`0004` bis `0007`) ausrollen.
2. Keycloak-Service-Account inklusive `manage-realm` prüfen und Secret-Injektion verifizieren.
3. Backend mit Keycloak-Admin-Credentials deployen.
4. Feature-Flags initial auf `false` verifizieren (Kill-Switch).
5. Stufenweise aktivieren: UI -> Admin -> Bulk.
6. Geplanten Reconcile-Lauf aktivieren und Alerting gegen Drift-Backlog prüfen.
7. Separates IAM-Acceptance-Gate gegen die Zielumgebung ausführen und Bericht unter `docs/reports/` archivieren.
