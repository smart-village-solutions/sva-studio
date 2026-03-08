# Design: Docker-basierter Monitoring Stack

## Context

Der Monitoring Stack basiert auf ADR-004 (Prometheus + Loki + Grafana + OpenTelemetry). Diese Design-Entscheidung fokussiert auf die **lokale Entwicklungsumgebung** als Vorstufe zur Produktions-Implementierung.

**Constraints:**
- Entwickler nutzen Docker Desktop (macOS/Linux)
- Minimaler RAM-Footprint (<2GB zusätzlich)
- Keine Cloud-Dependencies (alles lokal)
- Kompatibel mit pnpm-Workspace und Nx-Monorepo

**Stakeholders:**
- Entwickler (primär): Schnelles Debugging, Performance-Analyse
- DevOps (sekundär): Validierung der Produktions-Konfiguration

## Goals / Non-Goals

### Goals
- ✅ Lokaler Stack spiegelt Produktions-Architektur (Prometheus, Loki, Grafana, OTEL)
- ✅ Automatisches Log-Shipping von allen App-Containern
- ✅ Vorkonfigurierte Dashboards (Copy-Paste-Ready für Produktion)
- ✅ OpenTelemetry SDK validierbar (Backend-Wechsel testbar)
- ✅ Zero-Config für Entwickler (docker compose up + fertig)

### Non-Goals
- ❌ High-Availability Setup (keine HA-Replicas lokal)
- ❌ Produktions-Retention (nur 7 Tage statt 90 Tage)
- ❌ Multi-Region Deployment (alles auf localhost)
- ❌ External Monitoring (kein UptimeRobot lokal)

## Decisions

### 1. Docker Compose vs Kubernetes
**Decision:** Docker Compose für lokale Entwicklung

**Rationale:**
- Einfaches Setup (eine YAML-Datei, kein Cluster nötig)
- Geringer Ressourcen-Verbrauch (~1.5GB RAM vs K8s >4GB)
- Schneller Restart-Zyklus (<10 Sekunden)
- Entwickler-freundlich (keine kubectl-Kenntnisse nötig)

**Alternatives considered:**
- Minikube/Kind: Zu ressourcen-intensiv für lokales Setup
- Helm Charts: Overkill für Development, passt besser für Staging/Produktion

**Production Path:** Helm Charts werden separat in Phase 1 (Produktions-Implementierung) erstellt

### 2. Service-Architektur
```
┌─────────────────────────────────────────────────────┐
│                  Docker Compose                      │
├──────────────┬──────────────┬──────────────┬────────┤
│  App Services│ OTEL Collector│  Prometheus  │ Grafana│
│  (Backend,   │  (Metrics/   │  (TSDB)      │ (UI)   │
│   Frontend)  │   Logs Hub)  │              │        │
│      │       │      │       │      │       │   │    │
│      └───────┼──────┘       │      │       │   │    │
│              │              │      │       │   │    │
│              ├──────────────┼──────┘       │   │    │
│              │              │              │   │    │
│              └──────────────┼──────────────┘   │    │
│                             │                  │    │
│                          Loki ◄────────────────┘    │
│                        (Logs)                       │
└─────────────────────────────────────────────────────┘
       │                    │                    │
    Promtail          Persistent Volume    Dashboard JSON
  (Log Shipper)        (7d Retention)      (Auto-Import)
```

**Decision:** OTEL Collector als zentraler Hub

**Rationale:**
- App-Services senden nur an OTEL Collector (single target)
- OTEL Collector routet zu Prometheus (Metriken) + Loki (Logs)
- Backend-Wechsel = nur Collector-Config ändern (App unverändert)
- Validiert Produktions-Setup (gleiches SDK, gleiche Exporter)

### 3. Log-Collection-Strategie
**Decision:** Docker Logging Driver + Promtail (Hybrid)

**Configuration:**
```yaml
services:
  sva-studio-backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "workspace_id,component"

  promtail:
    volumes:
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./promtail-config.yml:/etc/promtail/config.yml
    healthcheck:
      test: [ "CMD", "curl", "-f", "http://localhost:3101/ready" ]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Rationale:**
- Docker Logging Driver: Zero-Config für Services
- Promtail: Liest Docker-Logs, fügt Labels hinzu, sendet an Loki
- Kein App-Code-Change nötig (Logs gehen automatisch zu stdout/stderr)

**Alternatives considered:**
- Direktes Logging von App zu Loki: Mehr Komplexität, App-Dependency
- Syslog Driver: Weniger flexibel für Label-Injection

### 4. Label-Schema & Cardinality-Kontrolle
**Mandatory Labels:**
```typescript
interface LogContext {
  workspace_id: string;      // MANDATORY (Auto-injected aus Request-Context)
  component: string;         // z.B. "auth", "api", "scheduler"
  environment: "development" | "staging" | "production";
  level: "error" | "warn" | "info" | "debug";
}

// FORBIDDEN als Labels (High-Cardinality):
// ❌ user_id, session_id, request_id, email

// ERLAUBT als Log-Payload-Fields (nicht indexiert):
// ✅ user_id, session_id, request_id (mit PII-Redaction)
```

**PII-Redaction Policy:**
- **Automatische Redaction** für: `password`, `token`, `authorization`, `api_key`, `secret`
- **Email-Masking**: `user@example.com` → `u***@example.com`
- **User-IDs**: Nur als Log-Field, nie als Label (nicht suchbar)
- **Request-IDs**: Nur in Log-Payload für Tracing, nicht als Label

**Enforcement-Strategie:**
- **Development-Modus:** Warning bei fehlendem workspace_id (nicht blockierend)
- **Production-Modus:** 400 Bad Request bei fehlendem workspace_id
- **OTEL SDK:** Whitelist in Instrumentation-Config + PII-Processor
- **Promtail:** Relabeling Rules filtern verbotene Labels
- **Logger:** Automatische Redaction vor Export

**Rationale:**
- Entwickler können vergessen, workspace_id zu setzen → Warnung statt Hard-Fail
- Production ist strikt (Multi-Tenancy-Sicherheit)
- Cardinality-Explosion verhindert (max 1k Kombinationen pro Service)

### 5. Persistent Storage & Retention
**Configuration:**
```yaml
volumes:
  prometheus-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./dev/monitoring/prometheus

  loki-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./dev/monitoring/loki

# Retention Policies:
prometheus:
  retention.time: 7d
  retention.size: 5GB

loki:
  limits_config:
    retention_period: 168h  # 7 Tage
    max_query_length: 721h  # 30 Tage für Debugging
```

**Rationale:**
- Bind-Mounts: Daten überleben `docker compose down`
- 7 Tage: Genug für Feature-Branches, nicht zu viel Disk-Verbrauch
- 5GB Limit: Verhindert Disk-Full auf Entwickler-Maschinen
- In `.gitignore`: `dev/monitoring/` nicht committen (lokale Daten)

### 6. Grafana-Dashboards & Provisioning
**Decision:** JSON-Dashboards in Git versionieren, Auto-Import beim Start

**Structure:**
```
dev/monitoring/grafana/
├── dashboards/
│   ├── development-overview.json
│   ├── application-logs.json
│   └── multi-tenancy-test.json
└── provisioning/
    ├── datasources.yml
    └── dashboards.yml
```

**Auto-Provisioning Config:**
```yaml
apiVersion: 1
providers:
  - name: 'default'
    folder: 'Development'
    type: file
    options:
      path: /etc/grafana/dashboards
```

**Rationale:**
- Entwickler müssen keine Dashboards manuell erstellen
- Dashboards sind versioniert → Reproducibility
- Produktion kann gleiche Dashboards nutzen (Copy-Paste)
- Team-weite Konsistenz (alle sehen gleiche Metrics)

### 7. OpenTelemetry SDK Integration
**Implementation Pattern:**
```typescript
// packages/monitoring-client/src/otel.ts (zentraler SDK-Setup)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';

const sdk = new NodeSDK({
  serviceName: 'sva-studio-backend',
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4318/v1/metrics'
    })
  }),
  logRecordProcessor: new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4318/v1/logs'
    })
  ),
  instrumentations: [
    new HttpInstrumentation(),
    new PrismaInstrumentation(),
  ],
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'sva-studio-backend',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  })
});

// Auto-Start in Development
if (process.env.NODE_ENV !== 'test') {
  sdk.start();
}
```

**Package Ownership:**
- `packages/monitoring-client/` - OTEL SDK Setup, Prometheus/Loki Clients, Dashboard Configs
- `packages/sdk/src/logger/` - Framework-agnostischer Logger mit OTEL Transport
- App-Integration nutzt beide Packages, keine direkte OTEL-Imports in App-Code

**Context Injection für workspace_id:**
```typescript
// Middleware injects workspace_id from Request
app.use((req, res, next) => {
  const workspaceId = req.headers['x-workspace-id'] || 'default';

  context.with(
    context.active().setValue('workspace_id', workspaceId),
    () => next()
  );
});

// Logger/Metrics nutzen automatisch Context
logger.info('User logged in', {
  userId: user.id // workspace_id wird automatisch hinzugefügt
});
```

**Rationale:**
- OTEL SDK abstrahiert Backend (Prometheus/Loki heute, Datadog morgen)
- Auto-Instrumentation reduziert Boilerplate (HTTP, DB automatisch getracked)
- Context-Propagation verhindert manuelles Label-Passing
- Testbar: SDK-Start in Tests deaktiviert

## Risks / Trade-offs

### ❌ Risk: Ressourcen-Verbrauch auf Entwickler-Maschinen
**Impact:** Docker Desktop kann langsam werden (>2GB RAM zusätzlich)

**Mitigation:**
- Optionales Setup: `docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up`
- Entwickler können Monitoring Stack separat starten (nur bei Bedarf)
- Memory-Limits in Compose-File (`mem_limit: 512m` pro Service)
- README mit RAM-Requirements und Deaktivierungs-Anleitung

### ❌ Risk: Divergenz zwischen Development und Production
**Impact:** Lokales Setup funktioniert, Production schlägt fehl

**Mitigation:**
- Gleiche OTEL SDK Config (nur Endpoints unterschiedlich)
- Gleiche Label-Schema (Whitelist in Code, nicht in Config)
- Dashboard-JSONs 1:1 von Development zu Production exportierbar
- CI-Tests validieren Label-Compliance

### ❌ Risk: Cardinality-Explosion in Development
**Impact:** Entwickler nutzen user_id als Label → Prometheus/Loki überlastet

**Mitigation:**
- Whitelist in OTEL SDK (nur approved Labels durchgelassen)
- Loki Relabeling Rules (verbotene Labels gedroppt)
- Monitoring-Stack gibt Warnings aus bei hoher Cardinality
- Dokumentation: "Forbidden Labels" explizit auflisten

### ❌ Risk: PII-Leakage in Logs/Metriken
**Impact:** Sensitive Daten (User-IDs, Emails, Tokens) landen in durchsuchbaren Logs

**Mitigation:**
- PII-Redaction Processor in OTEL SDK (vor Export)
- Email-Masking: `user@example.com` → `u***@example.com`
- Automatische Redaction in Logger für: `password`, `token`, `authorization`, `api_key`, `secret`
- Sensitive Daten nur in Log-Payload (nicht in Labels), Payload nicht indexiert
- Unit-Tests: Validierung dass keine PII in Metrics/Labels landet

### ❌ Risk: Service-Ausfälle (Health-Check Fehler)
**Impact:** Ein fehlerhafter Service blockiert `docker compose up`

**Mitigation:**
- Health-Checks für alle Services mit `ignore_errors: true` (lokal nicht kritisch)
- Separate Health-Check Endpoints (`/:healthcheck`, `/ready`, `/-/healthy`)
- Startup-Logik prüft Health vor Dashboard-Auto-Import
- README dokumentiert: Wie man einen fehlerhaften Service debuggt

## Health-Check Strategy

**Alle Services haben Healthchecks:**

```yaml
services:
  prometheus:
    healthcheck:
      test: [ "CMD", "curl", "-f", "http://localhost:9090/-/healthy" ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  loki:
    healthcheck:
      test: [ "CMD", "curl", "-f", "http://localhost:3100/ready" ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  grafana:
    healthcheck:
      test: [ "CMD", "curl", "-f", "http://localhost:3001/api/health" ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  otel-collector:
    healthcheck:
      test: [ "CMD", "/healthcheck" ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  promtail:
    healthcheck:
      test: [ "CMD", "curl", "-f", "http://localhost:3101/ready" ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
```

**Health-Check Endpoints:**
- **Prometheus:** `GET http://localhost:9090/-/healthy` (200 OK = ready)
- **Loki:** `GET http://localhost:3100/ready` (204 No Content = ready)
- **Grafana:** `GET http://localhost:3001/api/health` (200 OK + JSON response)
- **OTEL Collector:** `/healthcheck` über gRPC (ServicePort 13133)
- **Promtail:** `GET http://localhost:3101/ready` (200 OK = ready)

**Startup-Verhalten:**
- Alle Services starten parallel
- Health-Checks validieren Readiness (nicht Liveness)
- Fehlerhafte Services blocken nicht den `compose up` (local dev, nicht critical)
- Dashboard-Auto-Import wartet auf Grafana + Prometheus + Loki (in Grafana-Init-Script)

## Security & Secrets Management

**Default-Security:**
- **Grafana Admin**: Randomized Password via `.env` (`GF_SECURITY_ADMIN_PASSWORD`)
- **Port Bindings**: Alle Services nur `127.0.0.1` (localhost-only)
  ```yaml
  services:
    prometheus:
      ports:
        - "127.0.0.1:9090:9090"  # Only localhost
  ```
- **Promtail Scope**: Container-Filter nur SVA-Services (`com.sva-studio.monitoring=enabled` Label)
- **No Default-Credentials**: README dokumentiert Setup, keine hartcodierten Secrets
- **OTEL Collector Auth**: Bearer Token optional (lokal deaktiviert, Production validiert in Phase 2)

**PII-Redaction:**
- Automatische Redaction in `packages/sdk/src/logger/` für:
  - `password`, `token`, `authorization`, `api_key`, `secret`
  - Email-Masking: `user@example.com` → `u***@example.com`
- OTEL SDK Processor filtert High-Cardinality Labels vor Export
- Redaction-Pattern als Whitelist (Default: sperrt alle, nur approved durchgelassen)

**Secrets-Handling:**
- `.env.example` im Repo (mit Platzhaltern)
- `.env` in `.gitignore`
- Docker Compose: `env_file: .env` statt hardcoded values
- Grafana Admin Password: Random UUID generiert beim ersten Start (in README)
- Kein Secret-Manager lokal nötig (Development, nicht Production)

**Data Protection (DSGVO):**
- Logs/Metriken nur 7 Tage retention (automatisch gelöscht)
- Keine User-PII in Logs (nur workspace_id)
- LocalStorage nur auf Developer-Machine (nicht synced)
- Backup-Anleitung dokumentiert: Wie man Daten löscht

**Phase 1: Docker Compose Setup (diese Change)**
1. Erstelle `docker-compose.monitoring.yml`
2. Füge Services hinzu: Prometheus, Loki, Grafana, OTEL Collector, Promtail
3. Erstelle Dashboards und Provisioning-Config
4. Dokumentiere Setup in README

**Phase 2: OTEL SDK Integration (parallel zu Phase 1)**
1. Installiere Dependencies (`@opentelemetry/sdk-node`)
2. Erstelle `packages/core/src/observability/otel.ts`
3. Integriere in Backend-Startup (`apps/sva-studio-react/src/entry-server.tsx`)
4. Teste Metriken-Export zu Prometheus

**Phase 3: Strukturiertes Logging**
1. Installiere Winston + OTEL Transport
2. Erstelle `packages/sdk/src/logger/index.ts`
3. Ersetze `console.log` durch Logger-Calls
4. Validiere Logs in Grafana

**Phase 4: Production Readiness (separate Change, nach diesem Proposal)**
1. Erstelle Helm Charts für Kubernetes
2. Konfiguriere HA-Setup (2 Replicas)
3. Füge External Monitoring hinzu (UptimeRobot)
4. Implementiere DSGVO-Compliance (Anonymisierung, Retention)

**Rollback-Strategy:**
- Development: `docker compose down -v` entfernt alle Monitoring-Services
- Code-Changes: Feature-Flag `ENABLE_OBSERVABILITY` (default: true in dev, false in prod bis validiert)
- Production: Wird nicht in dieser Change deployt (nur Dev-Setup)

## Open Questions

1. **Soll OTEL Collector auch Traces sammeln?**
   - **Aktuell:** Nur Metriken + Logs
   - **Option:** Distributed Tracing hinzufügen (Jaeger/Tempo)
   - **Decision:** Verschieben auf spätere Phase (Traces = zusätzliche Komplexität)

2. **Wie testen wir Multi-Tenancy lokal?**
   - **Option A:** Seeding-Script erstellt 3 Test-Workspaces
   - **Option B:** Entwickler nutzt Header `X-Workspace-Id: test-workspace-1`
   - **Preferred:** Option B (einfacher, kein DB-Seeding nötig)

3. **Brauchen wir AlertManager lokal?**
   - **Use Case:** Teste Alert-Rules vor Production-Deployment
   - **Decision:** Nein für MVP, optional in Phase 2
   - **Rationale:** Lokale Alerts sind nicht kritisch, keine Email-Infrastruktur lokal

4. **Wie synchronisieren wir Dashboards zwischen Dev und Production?**
   - **Current Plan:** Manuelle Exports (JSON → Git → Helm Charts)
   - **Future:** Grafana Dashboard API + CI/CD Sync
   - **Decision:** Manuell für MVP (automatisiert in Production-Phase)

---

## Migration Plan

**Verwendete API-Versionen:**
- **OTLP Protocol**: v0.20.0 (HTTP/1.1, gRPC unterstützt)
  - Metrics: `http://otel-collector:4318/v1/metrics`
  - Logs: `http://otel-collector:4318/v1/logs`
- **Prometheus API**: v1 (Remote Write Protocol v1.0)
- **Loki Push API**: v1 (`/loki/api/v1/push`)
- **Grafana Provisioning**: Schema v1 (Grafana 9.x+)

**Standards-Compliance:**
- OpenTelemetry Semantic Conventions v1.21+ (HTTP, DB, Service)
- Prometheus Exposition Format & Remote Write Spec
- W3C Trace Context (falls Tracing später aktiviert)

**Migration & Exit-Strategie:**
- **Dashboard-Export**: Grafana JSON API (`GET /api/dashboards/uid/{uid}`)
- **Prometheus-Daten**: Remote Read/Snapshot Export
- **Loki-Daten**: LogQL Queries → NDJSON Export
- **Config-Versionierung**: Git-Tags für docker-compose + Provisioning
- **Alternative Backends**: OTEL Collector Config-Swap (z.B. Datadog, Elastic)

---

## Security & Secrets Management

**Default-Security:**
- **Grafana Admin**: Randomized Password via `.env` (`GF_SECURITY_ADMIN_PASSWORD`)
- **Port Bindings**: Alle Services nur `127.0.0.1` (localhost-only)
- **Promtail Scope**: Container-Filter nur SVA-Services (`com.sva-studio.monitoring=enabled` Label)
- **No Default-Credentials**: README dokumentiert Setup, keine hartcodierten Secrets

**PII-Redaction:**
- Automatische Redaction in `packages/sdk/src/logger/` für:
  - `password`, `token`, `authorization`, `api_key`, `secret`
  - Email-Masking: `user@example.com` → `u***@example.com`
- OTEL SDK Processor filtert High-Cardinality Labels vor Export

**Secrets-Handling:**
- `.env.example` im Repo (mit Platzhaltern)
- `.env` in `.gitignore`
- Docker Compose: `env_file: .env` statt hardcoded values

---

## Operations & Runbooks (Betriebsfähigkeit)

**Runbook-Anforderungen (in docs/development/monitoring-stack.md):**

1. **Installation & Startup**
   - Prerequisites (Docker Desktop, RAM/Disk)
   - Start: `docker compose -f docker-compose.monitoring.yml up -d`
   - Verify: Health-Checks für alle Services
   - First-Login: Grafana Credentials Setup

2. **Update & Rollback**
   - Image-Versionen in `.env` pinnen
   - Rollback: `docker compose down && git checkout <tag> && docker compose up`
   - Dashboard-Rollback: JSON-Export vor Update

3. **Backup & Restore**
   - Volume-Backup: `docker run --rm -v monitoring_prometheus-data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/prometheus-$(date +%Y%m%d).tar.gz /data`
   - Restore: `tar xzf backup.tar.gz -C /path/to/volume`
   - Test-Restore monatlich (automatisiert in CI)

4. **Troubleshooting**
   - Port-Konflikte: `.env` Ports anpassen
   - RAM-Limits: `docker stats` prüfen, mem_limit anpassen
   - Log-Zugriff: `docker compose logs -f <service>`

5. **Monitoring & Alerting (Minimal)**
   - Lokale Alert-Rules für Log-Error-Rate, Service Down
   - Health-Checks: `curl http://localhost:9090/-/healthy`
