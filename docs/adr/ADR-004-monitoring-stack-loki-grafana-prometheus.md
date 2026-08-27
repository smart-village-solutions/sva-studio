# ADR-004: Monitoring Stack – Loki, Grafana & Prometheus

**Datum:** 5. Februar 2026
**Status:** ✅ Accepted
**Kontext:** System Monitoring, Logging & Observability für SVA Studio CMS 2.0
**Entscheider:** SVA Studio Team

---

## Entscheidung

Wir implementieren einen integrierten Observability Stack aus:
- **Prometheus** für Metriken und System-KPIs
- **Loki** für strukturierte Logs
- **Grafana** als zentale Visualisierungs- und Alerting-Plattform

---

## Kontext und Problem

**Architektur-Überblick:**
- **Betrieb durch Dienstleister:** Prometheus + Loki + Grafana laufen auf Dienstleister-Infrastruktur (zentral betrieben)
- **Kommunen erhalten vereinfachte Ansichten:** Im SVA Studio CMS gibt es Simple Dashboards/Logs, NICHT direkter Zugriff auf Grafana
- **Strikte Multi-Tenancy:** Kommunen können ihre Daten nicht gegenseitig sehen

Der Dienstleister benötigt umfassende Überwachung für:
- **System Health:** CPU, RAM, Disk, Netzwerk, DB-Performance (alle Kommunen, zentral)
- **Application Logging:** Strukturierte JSON-Logs mit Kontextinformationen (User-ID, Request-ID, Session-ID, Workspace-ID)
- **Audit Trails:** Vollständige Protokollierung kritischer Aktionen (Append-Only, unveränderlich, 2 Jahre Retention)
- **Performance Monitoring:** Response-Zeiten, Error-Rates, Cache-Hit-Rates pro Workspace
- **Anomalie-Erkennung:** Automatische Baselines und Abweichungserkennung für Capacity Planning
- **Alert Management:** Rule-basierte Alerts für kritische Fehler (E-Mail an Support-Team)
- **Multi-Tenant Isolation:** Strikte Daten-Trennung zwischen Kommunen auf Label-Ebene
- **Compliance:** DSGVO-konform (Anonymisierung, Datenschutz, Right-to-Deletion), 90 Tage Standard / bis 2 Jahre konfigurierbar

**Technische Anforderungen (Dienstleister-Seite):**
- High-Volume Log Ingestion (Millionen Events/Tag über alle Kommunen)
- Sub-Sekunden Query Performance für Echtzeit-Dashboards (Dienstleister, Kommunen mit Caching)
- Cost-Efficient Storage (Time-Series + Log Compression, zentrale Kostenoptimierung)
- Sichere Isolation: Prometheus/Loki nur für Dienstleister erreichbar (nicht öffentlich)
- Native Support für Labels/Tags zur Datenorganisation (workspace_id, tenant_id, component, etc.)
- **Kein direkter Kommunen-Zugriff:** Grafana ist Dienstleister-Tool, Kommunen nutzen vereinfachte SVA Studio Endpoints

**Kommune-Sicht (im SVA Studio CMS):**
- REST-API für Logs/Metriken (vereinfachte Queries, keine PromQL/LogQL-Exposure)
- Vordefinierte Dashboards (System-Health, Error-Übersicht, Nutzungsstatistiken)
- Einfache Visualisierungen (Charts, Tables, Alerts)
- Kein Zugriff auf andere Kommunen oder System-Metriken

---

## Betrachtete Optionen

| Stack | Logs | Metriken | Dashboards | Type Safety | Operator-Freundlich | Cost | Bewertung |
|---|---|---|---|---|---|---|---|
| **Prometheus + Loki + Grafana** | ✅ Loki | ✅ Prometheus | ✅ Grafana | 9/10 | 9/10 | 10/10 | **9.3/10** ✅ |
| ELK Stack (Elasticsearch) | ✅ (teuer) | 🟡 Metriken-Plugin | ✅ Kibana | 7/10 | 7/10 | 5/10 | 6.7/10 |
| Datadog | ✅ All-in-One | ✅ All-in-One | ✅ All-in-One | 8/10 | 10/10 | 3/10 (SaaS) | 7/10 |
| Splunk | ✅ (sehr teuer) | 🟡 Add-ons | ✅ Dashboards | 6/10 | 6/10 | 2/10 | 4.7/10 |
| New Relic | ✅ All-in-One | ✅ All-in-One | ✅ All-in-One | 7/10 | 9/10 | 4/10 (SaaS) | 6.7/10 |

### Warum Prometheus + Loki + Grafana?

#### **1. Perfekte Komplementarität:**
```
Prometheus (Metriken)
├── Time-Series DB optimiert für numerische Daten
├── PromQL für flexible Queries und Aggregationen
├── Built-in Alerting Rules
└── Native Exporters für Standard-Services

Loki (Logs)
├── Log-Indexierung optimiert für Labels, nicht volltext
├── LogQL (Prometheus-ähnlich) für konsistentes Querying
├── Hohe Compression (Log-Daten bis 10x komprimierbar)
└── Label-basierte Multi-Tenancy (Workspace/Kommune Isolation)

Grafana (Visualization & Alerting)
├── Unterstützt Prometheus, Loki, SQL, CloudWatch nativ
├── Unified Dashboards (Metriken + Logs zusammen)
├── Advanced Alerting (Multi-Channel: E-Mail, Slack, Webhook, SMS)
└── Plugin-Ökosystem für Erweiterungen
```

#### **2. Cost-Efficiency:**
```
Datadog (SaaS):
├── Logs: $0.70 pro GB/Monat → 100GB = $70/Monat
├── Metriken: $0.05 pro Metric/Monat → 1000 Metrics = $50/Monat
└── Total: ~$120-200/Monat für Small-Mid Setup

ELK Stack (Self-Hosted):
├── Elasticsearch (Speicher-hungrig): 16GB RAM + 500GB Storage
├── Logstash (CPU-intensiv): 4+ CPU Cores
├── Kibana (einfach): 2GB RAM
└── Total: ~$400-600/Monat Infrastruktur-Kosten

Prometheus + Loki + Grafana (Self-Hosted):
├── Prometheus: 2GB RAM, 100GB Storage (komprimiert)
├── Loki: 2GB RAM, 200GB Storage (Indexes leicht)
├── Grafana: 512MB RAM, minimal Speicher
└── Total: ~$100-150/Monat Infrastruktur-Kosten (75% günstiger als ELK)
```

#### **3. Developer Experience:**
- **Konsistente Query-Sprachen:** PromQL (Metriken) und LogQL (Logs) ähnliche Syntax
- **Native Integrations:** Winston/Pino für Logs, prom-client für Metriken
- **Unified Dashboards:** Metriken + Logs in einem Grafana-View (Korrelation)

#### **4. OpenTelemetry-Integration (Zukunftssicherheit):**

**Strategie:** Applikationen nutzen **OpenTelemetry SDK** statt direkter Prometheus/Loki-Clients.

**Begründung:**
- **Vendor-Neutralität:** App-Code unabhängig vom Backend (Prometheus/Loki/Datadog/...)
- **Standards-Compliance:** W3C Trace Context, OpenMetrics, OTLP Protocol
- **Migration-Sicherheit:** Backend-Wechsel = Config-Änderung (2-3 Tage), nicht Code-Refactoring (3-4 Wochen)
- **Unified Observability:** Traces + Metrics + Logs mit einem SDK, automatische Korrelation
- **TanStack Start Kompatibilität:** OTEL SDK funktioniert mit Server Functions und Middleware

**Praktischer Vorteil:**
```
Migration zu Datadog (falls nötig):
├── Mit OTEL: 0 Code-Änderungen, nur OTEL Collector Config swap
├── Ohne OTEL: 3-4 Wochen App-Code Refactoring, 2-3 Tage Downtime
└── Fazit: OTEL reduziert Lock-in-Risiko massiv
```

#### **5. Kubernetes-Native:**
- **Service Discovery:** Prometheus Operator + ServiceMonitors (automatische Target-Erkennung)
- **DaemonSet Deployment:** Promtail auf jedem K8s-Node (Log-Collection)
- **Helm Charts:** Offizielle Charts für Prometheus, Loki, Grafana (Infrastructure-as-Code)

#### **6. Multi-Tenant Isolation (Dienstleister-Betrieb):**
```
Prometheus Labels (Metriken)
├── workspace_id: "Kommune_A"      // MANDATORY Label
├── environment: "production"
├── service: "sva-studio-backend"
└── Nur Dienstleister sieht alle Metriken

Loki Labels (Logs)
├── workspace_id: "Kommune_A"      // MANDATORY, garantiert Isolation
├── component: "auth"
├── level: "error"
└── LogQL-Queries im Grafana: {workspace_id="Kommune_A"} filters strict by Dienstleister

Grafana (Dienstleister-Tool)
├── Multi-Workspace Dashboards (Dienstleister-View)
├── Alert Rules pro Workspace (z.B. hohe Error-Rate in Kommune_A)
├── Support-Team hat Zugriff auf alle Daten für Debugging
└── Rollenbasiert: Admin, Operator, Viewer (kein Zugriff auf andere Workspaces)

SVA Studio CMS (Kommune-View, vereinfacht)
├── REST-Endpoint: GET /api/admin/monitoring/dashboard
├── Rückgabe: {errorRate, avgResponseTime, activeUsers, lastErrors}
├── Keine Rohdaten, nur aggregierte Metriken
├── Streng isoliert: Queries intern mit workspace_id gefiltert
└── Rate-Limiting: 1 Request/Sekunde pro Kommune (DDoS-Schutz)
```

---

## Trade-offs & Limitierungen

### Pros
- ✅ **Cost-Efficient:** ~75% günstiger als ELK oder Datadog (Self-Hosted)
- ✅ **Open Source:** Keine Vendor Lock-in, vollständige Kontrolle
- ✅ **Highly Scalable:** Prometheus verarbeitet Millionen Metrics/Min, Loki Billionen Logs/Tag
- ✅ **Unified Platform:** Ein Dashboard für Logs + Metriken + Alerting
- ✅ **Developer-Friendly:** PromQL + LogQL sind konsistent, einfach zu lernen
- ✅ **Kubernetes-Native:** Service Discovery, Helm Charts, Prometheus Operator
- ✅ **DSGVO-Konform:** Self-Hosted, vollständige Datenkontrolle, einfache Anonymisierung
- ✅ **Rich Ecosystem:** 1000+ Exporters, Grafana Plugins, Community Support

### Cons
- ❌ **Dienstleister-Maintenance:** Require Operations Knowledge (höhere Anforderung an Support-Team)
- ❌ **Storage Management:** Retention-Policies müssen zentral gepflegt werden (Multi-Tenant Komplexität)
- ❌ **Cardinality Issues:** Hohe Label-Cardinality über viele Kommunen ⇒ Storage-Explosion (z.B. User-IDs als Labels)
- ❌ **Full-Text Search Limitation:** LogQL optimiert für Labels, nicht für komplexe Log-Suche
- ❌ **Beta Features:** Some Loki features (wie Patterns) sind noch nicht stabilisiert
- ❌ **HA Komplexität:** Single Prometheus/Loki = Single Point of Failure (backup strategy nötig)

### Mitigationen
```
❌ Dienstleister-Maintenance
└─ Mitigation: Infrastructure-as-Code (Terraform/Helm), dokumentierte Runbooks, SLA für Response-Zeit

❌ Storage Management (Multi-Tenant)
└─ Mitigation: Loki Table Manager für automatische Retention pro Workspace, Quotas pro Kommune
   └─ z.B. Kommune_A: max 500GB Logs, 90 Tage Retention

❌ Cardinality Issues
└─ Mitigation: Strict Label Guidelines (keine User-IDs/unique values als Labels)
   ├─ ALLOWED: workspace_id, component, level, status_code
   └─ FORBIDDEN: user_id, session_id, email
   └─ Cardinality Monitoring: Alert bei > 100k unique metric combinations

❌ Full-Text Search
└─ Mitigation: Für Audit-Logs Elasticsearch als optionales Backup
   └─ Loki = primary (schnell, kosteneffizient), ES = archival (Compliance)

❌ HA/Disaster Recovery
└─ Mitigation:
   ├─ Prometheus + Loki: 2 replicas behind Load Balancer
   ├─ Persistent Volume mit Backup (daily, 7 Tage retention)
   ├─ RPO (Recovery Point Objective): 1 Hour
   ├─ RTO (Recovery Time Objective): 15 Minuten
   └─ Test DR monatlich
```

---

## Sicherheit & Compliance

### Technische Komponenten
- **Prometheus:** Metrics Collection + AlertManager
- **Loki:** Log Aggregation + Promtail (Collector)
- **Grafana:** Visualisierung + LDAP/SAML Auth
- **External Monitoring:** UptimeRobot (SPOF-Überwachung)

### Multi-Tenancy & Isolation
- **Label-Enforcement:** `workspace_id` MANDATORY für alle Logs/Metriken (sonst Rejection)
- **Zugriffskontrolle:** Prometheus/Loki nur Dienstleister-intern, Kommunen via REST-API
- **Rate-Limiting:** 1000 logs/sec pro Workspace, 100 API-Requests/min

### DSGVO-Compliance
- **Anonymisierung:** IP-Adressen (letztes Oktett), User-Agent normalisiert
- **Retention:** 90 Tage Standard, 2 Jahre Audit-Logs
- **Right-to-Erasure:** Automatische Löschung auf Anfrage (30 Tage Bestätigung)

## Rahmenbedingungen für Umsetzung

### Label-Schema (Pflicht)
**Erlaubte Labels** (Low Cardinality): `workspace_id`, `component`, `environment`, `status_code`, `level`
**Verbotene Labels** (High Cardinality): `user_id`, `session_id`, `email`, `request_id`

### Cardinality-Limits
- Prometheus: Max 50k metric combinations pro Workspace
- Loki: Max 1k label combinations pro Stream
- Enforcement: OTEL SDK Whitelisting + Relabeling Rules

### Verantwortlichkeiten
**Dienstleister:** Stack-Betrieb (SLA 99.5%), Alert Response (< 15 Min), Backup-Tests
**Kommunen:** Dashboard-Zugriff via CMS, Support via Ticket-System

---

## Skalierung & Capacity Planning

### Auslegung (150 Kommunen)
- **Prometheus:** 1.125M Metrics, 500 IOPS SSD, Cardinality-Monitoring
- **Loki:** 5000 logs/sec (HA: 10k logs/sec), 30GB/day Storage (komprimiert)
- **Grafana:** 50 concurrent users, 500+ Dashboards

### Scale-Trigger
- **Scale UP:** Cardinality > 80%, Loki ingestion > 7000 logs/sec, Query Latency > 2sec
- **Scale OUT:** Latency p99 > 500ms (regionale Instanzen)

---

## Alerting & Verfügbarkeit

### Alert-Kategorien
- **Critical (< 5 Min):** Prometheus/Loki/Grafana Down, Cardinality-Explosion
- **Warning (< 15 Min):** Disk > 85%, Query Latency > 2sec, Backup Failed
- **Info:** Retention Cleanup, neue Labels erkannt

### External Monitoring
- **Tool:** UptimeRobot (oder Pingdom)
- **Zweck:** SPOF-Überwachung (wenn interne Alerts ausfallen)
- **Checks:** Health-Endpoints für Prometheus/Loki/Grafana alle 5 Min
- **Action:** Email + PagerDuty bei Ausfall

## High Availability

### HA-Setup
- **Prometheus:** 2 Replicas (active-active), S3 Snapshots, RPO 10min, RTO 15-30min
- **Loki:** 2 Replicas (stateless via S3), Redis Cache, RPO 0, RTO < 5min
- **AlertManager:** Gossip Cluster (2 Instances), 0 Alert Loss

### Backup-Strategie
- **Daily S3 Snapshots** (Prometheus TSDB)
- **S3 Lifecycle Policies** (Loki Retention)
- **Monatliche Restore-Tests**

---

## Implementierung / Roadmap

### Phase 1: Foundation (Woche 1-4, nicht 1-3)
- [ ] Prometheus Setup (HA with 2 replicas, Persistent Volumes, AlertManager)
- [ ] Loki Setup (HA 2 replicas, S3 backend storage, Redis cache)
- [ ] Grafana Setup + LDAP/SAML Integration + HA setup
- [ ] Firewall-Konfiguration (nur Dienstleister-Access)
- [ ] Backup-Strategie (daily S3 snapshots, 7 Tage retention)
- [ ] Disaster Recovery Test (restore from backup, record RTO)
- [ ] **UptimeRobot Setup**: Health-Check Endpoints, Email + Webhook alerts
- [ ] **AlertManager Config**: Critical/Warning/Info rules defined

### Phase 2: Application Integration (Woche 5-7, nicht 4-6)
- [ ] Structured Logging (Winston/Pino mit workspace_id Injection)
- [ ] Custom Metrics (API Response Times, Business Events)
- [ ] Audit Log Pipeline (Application → Loki mit Append-Only)
- [ ] Error Tracking (Errors → Grafana Alerts → Dienstleister-Email)
- [ ] Retention Policies (90 Tage default, konfigurierbar pro Workspace)
- [ ] **Label Validation**: workspace_id MANDATORY, return 400 if missing
- [ ] **Promtail Deployment**: DaemonSet per K8s Node, local buffering

### Phase 3: Kommune-Integration (Woche 8-9, nicht 7-8)
- [ ] REST-API für Logs/Metrics (vereinfachte Queries, workspace_id enforcement)
- [ ] SVA Studio CMS: Dashboard Integration
- [ ] Vordefinierte Charts (Error-Rate, Response-Time, User-Count)
- [ ] Alert-Notification im CMS (kritische Events)
- [ ] Rate-Limiting & Security Headers (100 req/min per workspace)
- [ ] **Data Export API**: GET /api/admin/monitoring/export (JSON, CSV)

### Phase 4: DSGVO & Testing & Production Hardening (Woche 10-13, nicht 9-10)
- [ ] Anonymization Filters (IP, User-Agent, PII)
- [ ] Right-to-Erasure Implementation & Testing
- [ ] DSGVO Compliance-Report Generator (monthly)
- [ ] Load Test: 150M logs/day, 5000 logs/sec sustained, verify limits
- [ ] HA Failover Test (each component individually + combined)
- [ ] **Cardinality Load Test**: 150 Workspaces × 7500 Metrics = 1.125M metrics
- [ ] **UptimeRobot Response Time**: Verify < 5sec health-checks
- [ ] Stress Test Alerting: 1000 alerts/min, verify no loss
- [ ] Backup & Restore Drill: Restore from S3, verify data integrity

### Validierung & SLOs
- [ ] Verfügbarkeit: 99.5% (Dienstleister-Stack), 99% (Kommune-API)
- [ ] Query Performance: Grafana Dashboards < 2 Sekunden, CMS-API < 1 Sekunde
- [ ] Alert Response: Kritische Alerts < 60 Sekunden, Email Versand < 120 Sekunden
- [ ] Data Loss: RPO 1 Hour, RTO 15 Minuten
- [ ] DSGVO Audit: Anonymisierung, Retention, Löschung funktionieren
- [ ] Cardinality Monitoring: Kein unkontrolliertes Wachstum

---

## Exit-Strategie

### Migration-Optionen
**Zu ELK Stack (3 Wochen):**
- **Trigger:** Cardinality > 1.5M oder Full-Text Search benötigt
- **Vorteil OTEL:** Nur OTEL Collector Config ändern, kein App-Code Refactoring

**Zu Datadog (2 Wochen):**
- **Trigger:** Ops-Aufwand > 20h/Monat, Budget verfügbar
- **Vorteil OTEL:** 0 Code-Änderungen, Parallel-Betrieb möglich

### Review-Zeitplan
- **6 Monate:** Kosten, Ops-Aufwand, Cardinality evaluieren
- **12 Monate:** Stack-Fitness Review

**Nicht zu migrierende Komponente:**
- SVA Studio CMS API bleibt gleich (kommunen-facing API ist abstrahiert)
- Nur Dienstleister-interne Stack austauschbar

---

## Validierung & SLOs (finalisiert)
- [ ] Verfügbarkeit: 99.5% (Dienstleister-Stack), 99% (Kommune-API)
- [ ] Query Performance: Grafana Dashboards < 2 Sekunden, CMS-API < 1 Sekunde
- [ ] Alert Response: Kritische Alerts < 60 Sekunden, Email Versand < 120 Sekunden
- [ ] Data Loss: RPO 1 Hour (Prometheus), RPO 0 (Loki via S3), RTO 15 Minuten
- [ ] External Monitoring: UptimeRobot alerts within 5 minutes of outage
- [ ] DSGVO Audit: Anonymisierung, Retention, Löschung funktionieren
- [ ] Cardinality Limits: Max 1M metrics (150 Workspaces × 7.5k metrics), alert at 80%
- [ ] Label Validation: 100% of logs have workspace_id, < 0.1% validation errors
- [ ] HA Test Results: All components recover < 15 min after single/double failures

---

**Links:**
- [Logging und Observability](../architecture/logging-architecture.md)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Grafana Documentation](https://grafana.com/docs/grafana/)
- [ADR-001: Frontend Framework Selection](./ADR-001-frontend-framework-selection.md)
