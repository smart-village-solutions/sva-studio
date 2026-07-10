# PR #45 Interoperability & Data Portability Review

**Reviewer Role:** Interoperability & Data Reviewer
**Review Date:** 8. Februar 2026
**Status:** 🟡 CONDITIONAL APPROVAL (Risiken erkannt)
**Branch:** feat/logging
**Components:** Observability Stack (OTEL, Prometheus, Loki, Redis Sessions)

---

## Leitfrage: Kann eine Kommune morgen wechseln – ohne Datenverlust?

⚠️ **ANTWORT:** Teilweise ja, aber mit kritischen Lücken.

---

## INTEROPERABILITÄT-BEWERTUNG: **Mittel**

Die Observability-Architektur ist **stark auf offene Standards gebaut** (OTLP, Prometheus, Loki), aber **wesentliche Export- und Migrations-Fähigkeiten fehlen**.

---

## ✅ Stärken

### 1. **Offene Datenprotokolle (OTLP v1)**
- **OTLP HTTP Endpoints:** `http://collector:4318/v1/metrics` und `v1/logs`
- **Standardisiert:** OpenTelemetry Protocol ist ein CNCF-Standard, nicht proprietär
- **Vorteil:** Beliebiger OTLP-kompatibler Exporter kann andocken
- **Code:** [packages/monitoring-client/src/otel.ts#L127-L131](../packages/monitoring-client/src/otel.ts#L127-L131)

### 2. **Prometheus Metrics Format (PromQL & Export)**
- **Scrape Endpoints:** Prometheus scrapet Standard `/metrics` auf Port 8889 von OTEL Collector
- **Format:** OpenMetrics/Prometheus (IETF-Standard)
- **Export:** `GET /api/v1/query_range` liefert exportierbare Time-Series
- **Vorteil:** Kann zu VictoriaMetrics, Thanos, InfluxDB etc. migriert werden
- **Retention:** 7 Tage (konfigurierbar in [compose.monitoring.yaml#L15](../compose.monitoring.yaml#L15))

### 3. **Loki Logs (LogQL Export)**
- **Endpoint:** `http://loki:3100/loki/api/v1/push` (OTLP Import)
- **Query API:** `GET /loki/api/v1/query_range` zur Datenextraktion
- **Retention:** 168h (7 Tage) mit `delete_request_store` für GDPR-Löschungen
- **Schema:** `v12` versioniert in [dev/monitoring/loki/loki-config.yml#L23-L27](../dev/monitoring/loki/loki-config.yml#L23-L27)

### 4. **Workspace-Isolation durch Context**
- **Mandatory Label:** Alle Logs/Metriken haben `workspace_id` Tag
- **AsyncLocalStorage:** Request-Context wird per Middleware injiziert ([packages/sdk/src/observability/context.ts#L48-L73](../packages/sdk/src/observability/context.ts#L48-L73))
- **Vorteil:** Vollständige Datentrennung möglich via `{workspace_id="org-123"}` Filterung

### 5. **PII-Redaction (mehrstufig)**
- **Level 1:** OTEL SDK redacted Forbidden Labels (user_id, email, token, ip) → nur Whitelist bleibt
- **Level 2:** Promtail redacted nochmal via Regex (`relabel_configs` in [dev/monitoring/promtail/promtail-config.yml#L29-L33](../dev/monitoring/promtail/promtail-config.yml#L29-L33))
- **Level 3:** Email-Masking (`john.doe@example.com` → `j***@example.com`)
- **Dokumentation:** [docs/development/observability-best-practices.md#L46-L100](../docs/development/observability-best-practices.md#L46-L100)

### 6. **Session API mit Versionskontrolle**
- **Struktur:** `SessionData` ist typsicher mit Validierung ([packages/auth/src/redis-session.ts#L4-L8](../packages/auth/src/redis-session.ts#L4-L8))
- **Serialisierung:** JSON (portabel)
- **TTL:** 7 Tage (consistent mit Logs/Metriken)

---

## ⚠️ Interoperabilitäts-Risiken

### 🔴 KRITISCH: Keine Prometheus Export-API

**Problem:**
Es gibt **keine Exportier-API/Tools**, um alle Metriken aus Prometheus zu exportieren.

```
HEUTE: Prometheus → via /api/v1/query_range manuell querybar
FEHLT: Prometheus → Standard-Format (OpenMetrics JSON, protobuf, etc.)
```

**Auswirkung:**
- ❌ Keine vollständige Metrik-Migration in andere Zeit-Reihen-Datenbanken
- ❌ Bei Prometheus-Cluster-Migration könnten Daten verloren gehen
- ❌ Keine Point-in-Time Recovery für Metriken

**Behebung erforderlich:**
```bash
# Sollte möglich sein (ist es aber nicht dokumentiert/implementiert):
prometheus-admin export --output=json --workspace_id=org-123 > metrics.json
prometheus-admin export --output=openmetrics > metrics.txt
```

---

### 🔴 KRITISCH: Keine Loki Bulk-Export-Funktion

**Problem:**
Loki hat **keine nativen Bulk-Export-APIs** für Logs.

```
HEUTE: LogQL Queries, aber nur mit Limit/Pagination
FEHLT: Batch-Export, Streaming-Export für große Mengen
```

**Auswirkung:**
- ❌ Logs > 10GB lassen sich nicht vollständig exportieren
- ❌ Migration zu ELK/Datadog/Splunk schwierig
- ❌ GDPR-Recht auf Datenportabilität fraglich für große Workspaces

**Workaround (suboptimal):**
```bash
# Nur via LogQL Query Loop möglich:
curl 'http://loki:3100/loki/api/v1/query_range?query={workspace_id="org-123"}&start=X&end=Y'
```

**Behebung erforderlich:**
```typescript
// loki/export.ts – NICHT VORHANDEN
export async function exportWorkspaceLogs(
  workspaceId: string,
  format: 'jsonl' | 'logfmt'
): Promise<AsyncIterable<string>> {
  // Stream alle Logs in beliebige Größe
}
```

---

### 🟡 MITTEL: Session-API hat keine Versioning-Strategie

**Problem:**
`SessionData` Interface könnte Breaking Changes bekommen ohne Migrations-Path.

```typescript
// HEUTE: SessionData ist nicht versioniert
export interface SessionData {
  userId: string;
  workspaceId: string;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>; // Catch-all, aber nicht versioned
}

// BESSER: Explizite Versionierung
export interface SessionDataV1 {
  _version: 1;
  userId: string;
  // ...
}
```

**Auswirkung:**
- 🟡 Wenn neues Field hinzugefügt wird → alte Sessions brechen
- 🟡 Keine Migration-Strategie für Redis-Keys

**Behebung:**
```typescript
// Migrations-Handler FEHLT:
function migrateSessionV0ToV1(data: unknown): SessionDataV1 {
  // Hätte sein sollen
}
```

---

### 🟡 MITTEL: OTEL SDK hat keine Deprecation-Pfade

**Problem:**
`OtelConfig` Interface könnte Backwards-Compatibility brechen.

```typescript
export interface OtelConfig {
  serviceName: string;
  environment?: string;
  otlpEndpoint?: string;  // ← Wenn dies mal ändert → Breaking
  logLevel?: DiagLogLevel;
}
```

**Fehlt:**
- ❌ Version der Config-API dokumentiert
- ❌ Deprecation-Pfade für alte Parameter
- ❌ Migration-Guide wenn API sich ändert

**Best Practice wäre:**
```typescript
export interface OtelConfig {
  serviceName: string;
  environment?: string;
  // Deprecation: otlpEndpoint renamed to collectors.otlp.http.endpoint
  otlpEndpoint?: string; /** @deprecated use collectors instead */
  collectors?: { otlp?: { http?: { endpoint?: string } } };
}
```

---

## 🔄 Export-/Import-Fähigkeiten

| Datentyp | Export | Import | Format | Status | Notes |
|----------|--------|--------|--------|--------|-------|
| **Prometheus Metriken** | ⚠️ Teilweise | ❌ Nein | PromQL Text | 🟡 Manual | Via `/query_range` querybar, aber kein bulk-export |
| **Loki Logs** | ⚠️ Teilweise | ❌ Nein | JSON via API | 🟡 Pagination | Nur small batches mit LogQL |
| **Redis Sessions** | ❌ Nein | ❌ Nein | JSON (internal) | 🔴 Kritisch | Keine Backup-Strategie, keine Migration |
| **Business Events Counter** | ✅ Ja | ⚠️ Teilweise | Prometheus Metrics | 🟢 Gut | Via Prometheus export, keine Reimport-API |
| **Dashboards (Grafana)** | ✅ Ja | ✅ Ja | JSON | 🟢 Gut | Versioniert im Repo [dev/monitoring/grafana/dashboards/](../dev/monitoring/grafana/dashboards/) |
| **Alerting-Rules** | ⚠️ Teilweise | ⚠️ Teilweise | YAML (Loki/Prometheus) | 🟡 Limited | Konfiguriert in YAML, aber keine Versionierung |

---

## 📋 Fehlende Standards & APIs

### 1. **Prometheus Remote-Write/Read Standard**
```yaml
# SOLLTE KONFIGURIERT SEIN (ist es nicht):
global:
  remote_write:
    - url: "http://backup-prometheus:9090/api/v1/write"  # ← FEHLT
      queue_config:
        capacity: 1000000
```

**Warum wichtig?**
- Ermöglicht Multi-Prometheus-Setup (High Availability)
- Erlaubt automatische Replizierung für Migration
- Standard CNCF-Protokoll

---

### 2. **OpenMetrics Exposition Format**
```bash
# HEUTE: Standard Prometheus Text Format
curl http://otel:8889/metrics

# SOLLTE AUCH UNTERSTÜTZT SEIN:
curl http://otel:8889/metrics?format=openmetrics
# → Würde histograms/summaries besser abbilden
```

---

### 3. **OTLP Metrics Export Endpoint**
```
VORHANDEN: OTLP Receiver (Pull von App)
FEHLT: OTLP Exporter für andere OTEL Collector (Daisy-chaining)
```

Sollte sein:
```yaml
exporters:
  otlp:
    endpoint: "http://backup-otel-collector:4318"  # ← FEHLT
```

---

### 4. **Workspace-Level Data Export API**
```typescript
// NICHT VORHANDEN - sollte es aber geben:
GET /api/workspace/:workspaceId/export?format=jsonl&include=logs,metrics,traces
GET /api/workspace/:workspaceId/delete (für GDPR)
```

---

## 🛣️ Migration-Roadmap: "Wie würde ein Ausstieg funktionieren?"

### Szenario 1: Prometheus → VictoriaMetrics

```bash
# STATUS: 🟡 TEILWEISE MÖGLICH

# Schritt 1: Alte Metriken exportieren (WORKAROUND, nicht ideal)
for i in {1..100}; do
  curl -s 'http://prometheus:9090/api/v1/query_range' \
    --data-urlencode 'query={workspace_id="org-123"}' \
    --data-urlencode 'start='$((NOW - i*3600))'&end='$((NOW - (i-1)*3600))
done | jq '.data.result[]' > metrics.jsonl

# Schritt 2: In VictoriaMetrics via vmctl (EXTERNE TOOL)
vmctl remote-read --source http://prometheus:9090 \
  --destination http://victoria:8428 \
  --query='{workspace_id="org-123"}'

# Problem: ⚠️ Braucht externe Tools, nicht dokumentiert
```

---

### Szenario 2: Loki → ELK Stack

```bash
# STATUS: 🔴 PRAKTISCH UNMÖGLICH (aktuell)

# Loki hat KEINE Native Log-Stream-Export
# Workaround: LogQL → Netzwerk-Query → Parse → Elasticsearch

# Pseudo-Code (würde man selbst schreiben müssen):
for stream_id in $(loki query '{workspace_id="org-123"}' | jq '.[].stream'); do
  logs=$(loki query '{workspace_id="org-123"}' -n 10000)
  curl -X POST http://elasticsearch/bulk -d $(
    echo "$logs" | jq -c '{index:{_index:"logs"}} + .message'
  )
done

# 🔴 LÜCKE: Keine offizielle Migration gegeben
```

---

### Szenario 3: Redis Sessions → PostgreSQL

```bash
# STATUS: 🔴 PRAKTISCH UNMÖGLICH

# Redis Sessions haben KEINE Export-API
# Einziger Weg: SCAN alle Keys und JSON-Dump (aber Sessions sind TTL-basiert!)

redis-cli --scan --pattern 'session:*' | \
  xargs -I{} redis-cli GET '{}' > sessions.jsonl

# Problem: ⚠️ Sessionen sind ephemer (7 Tage TTL)
#         ⚠️ Keine Backward-Kompatibilität wenn Schema ändert
#         ⚠️ Keine Migrations-Strategie für neue SessionData-Versionen
```

---

## 7️⃣ Workspace-spezifische Datenportabilität (GDPR)

### ✅ Was funktioniert

```bash
# Logs für Workspace exportieren (theoretisch)
curl 'http://loki:3100/loki/api/v1/query_range?query={workspace_id="org-123"}'

# Metriken für Workspace filtern
curl 'http://prometheus:9090/api/v1/query?query=sva_business_events_total{workspace_id="org-123"}'
```

### ❌ Was nicht funktioniert

- **Bulk-Export:** Kein Tool für "exportiere ALLES für org-123"
- **Streaming:** Logs > 10GB können nicht on-the-fly gestreamt werden
- **Punkt-in-Zeit:** Keine Snapshots für Compliance-Audits
- **Lösch-API:** Loki hat `delete_request_store` aber **keine Public-API dafür**

```typescript
// SOLLTE EXISTIEREN - existiert aber nicht:
POST /api/workspace/:workspaceId/gdpr/export { format: 'jsonl' }
→ Streamed JSONL mit allen Logs/Metriken/Sessions

DELETE /api/workspace/:workspaceId/gdpr/purge
→ Löscht ALLE Daten (braucht Approvals)
```

---

## 📊 Zusammenfassung: Offene Standards vs. Lock-In

| Standard | Adoption | Status |
|----------|----------|--------|
| **OTLP (OpenTelemetry Protocol)** | ✅ Vollständig | v1 HTTP + gRPC |
| **Prometheus Format** | ✅ Vollständig | OpenMetrics compatible |
| **LogQL (Grafana Loki)** | ✅ Vollständig | Standard Query Language |
| **Redis Protocol** | ✅ Redis-Standard | Aber kein Export-Format definiert |
| **JSON Serialization** | ✅ Überall | Sessions, Logs, Metriken |
| **OpenMetrics Export** | ⚠️ Implementiert | Aber nicht genutzt |
| **gRPC OTLP** | ⚠️ Supported | Aber nur HTTP wird getestet |
| **Prometheus Remote-Write** | ❌ FEHLT | Keine HA/Replication |
| **Workspace-Data Export API** | ❌ FEHLT | GDPR-Risiko |
| **Session-Versioning** | ❌ FEHLT | Breaking-Change-Risiko |

---

## GESAMTBEWERTUNG: **Gering-Mittel Vendor Lock-In** 🟡

### Positiv
- ✅ OTLP ist offen & standardisiert
- ✅ Prometheus ist Industry Standard für Metriken
- ✅ Loki ist Open Source mit offenen APIs
- ✅ Session-Format (JSON) ist portabel

### Risiken
- ⚠️ **Keine Prometheus Bulk-Export-API** → Metriken-Migration schwierig
- ⚠️ **Keine Loki Bulk-Export-API** → Log-Migration unmöglich bei großen Mengen
- ⚠️ **Keine Session-Versioning** → Zukünftige Breaking Changes
- ⚠️ **Keine Workspace-Export-API** → GDPR-Compliance fraglich
- ⚠️ **Keine Migration-Scripts** → Kommune bleibt abhängig von SVA

### Konklusion: Kann eine Kommune morgen wechseln?

| Szenario | Status | Aufwand |
|----------|--------|---------|
| **Nur zur neuen OTEL-Instance migrieren** | ✅ Möglich | Mittel (OTLP forwarding) |
| **Prometheus zu VictoriaMetrics migrieren** | ⚠️ Mit Workaround | Hoch (manuelle Scripts nötig) |
| **Loki zu ELK migrieren** | ❌ Praktisch unmöglich | Sehr hoch (Edge-Case Handling) |
| **Sessions migrieren** | ⚠️ Möglich mit Redis SCAN | Mittel (aber Datenverlust-Risk) |
| **Kompletter Workspace-Export (GDPR)** | ❌ Nicht vorgesehen | Sehr hoch (Custom Code) |

---

## 🎯 EMPFEHLUNGEN (Priorität)

### P0 (Kritisch – vor Merge)
- [ ] **Workspace-Level Export-API implementieren** (GDPR-Risiko)
  ```typescript
  GET /api/workspace/:id/export { format: 'jsonl', include: ['logs', 'metrics'] }
  ```

- [ ] **Prometheus Remote-Write konfigurieren** (HA-Vorbereitung)
  ```yaml
  global:
    remote_write:
      - url: http://backup-prometheus:9090/api/v1/write
  ```

- [ ] **Session-Versioning hinzufügen**
  ```typescript
  export interface SessionDataV1 {
    _version: 1;
    userId: string;
    // ...
  }
  ```

### P1 (Hoch – nächstes Release)
- [ ] **Prometheus Metrics Backup-Script** (prometheus-admin cli)
- [ ] **Loki Log Streaming-Export** (für große Workspaces)
- [ ] **Migration-Dokumentation** schreiben (Prometheus → VictoriaMetrics, Loki → ELK)
- [ ] **GDPR-Lösch-API implementieren** (Public endpoint für `delete_request_store`)

### P2 (Mittel – mittelfristig)
- [ ] OpenMetrics Exposition Format aktivieren
- [ ] gRPC OTLP Tests hinzufügen
- [ ] API-Versionierung dokumentieren (v1, v2 mit Deprecation-Pfaden)

---

## Sign-off

**Reviewer:** Interoperability & Data Reviewer
**Date:** 8. Februar 2026

**Status:** 🟡 **CONDITIONAL APPROVAL**

### Bedingungen:
1. ✅ **OTLP-Integration ist gut** – kann so mergen
2. ⚠️ **Aber Workspace-Export-API ist CRITICAL** – muss vor Production-Release kommen
3. ⚠️ **Session-Versioning sollte hinzugefügt werden** – vor großer Änderung
4. ⚠️ **Migration-Doku fehlt vollständig** – muss später ergänzt werden

### Begründung:
Die Architektur ist grundsätzlich **offen und portabel**, aber es fehlen **praktische Migrations-APIs** für Datenexporte. Eine Kommune könnte technisch wechseln, bräuchte aber custom Code oder externe Tools – das ist nicht ideal für Vendor-Lock-In-Freiheit.
