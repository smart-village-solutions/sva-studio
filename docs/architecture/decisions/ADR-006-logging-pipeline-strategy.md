# ADR-006: Logging Pipeline Strategy

**Datum:** 6. Februar 2026
**Status:** ⏳ Proposed
**Kontext:** Logging-Pipeline (OTEL vs. Logger vs. Promtail)
**Entscheider:** SVA Studio Team

---

## Entscheidung

Die **primäre Logging-Pipeline** läuft über **OpenTelemetry SDK → OTEL Collector → Loki**.

- **App-Logs:** Strukturierte JSON-Logs im App-Code (SDK-Logger), Export via OTEL (OTLP/HTTP).
- **Container-Logs:** **Promtail** sammelt stdout/stderr als **Fallback** (für Dienste ohne OTEL).
- **Kein direktes Loki-SDK** in Apps; OTEL bleibt der zentrale Integrationspunkt.

Damit entsteht eine **einheitliche, zukunftssichere Pipeline**, die Backend-Wechsel ermöglicht und konsistente Kontext-Korrelation erlaubt.

---

## Kontext und Problem

Im lokalen Monitoring-Stack müssen Logs zuverlässig, konsistent und mit Kontext (workspace_id, component, level) erfasst werden. Gleichzeitig:

- Es gibt **mehrere potenzielle Pipelines** (Promtail-only, direkter Loki-Client, OTEL).
- **Multi-Tenancy** erfordert strikte Label- und PII-Regeln.
- Die Lösung muss **Developer-freundlich** sein und **keine Hard-Lock-ins** erzeugen.

Ziel ist eine Pipeline, die **Entwicklung, Tests und späteren Betrieb** konsistent unterstützt.

---

## Betrachtete Optionen

| Option | Kriterien | Bewertung | Kommentar |
|---|---|---|---|
| **A: OTEL SDK → Collector → Loki (empfohlen)** | Standardisierung, Korrelation, Future-Proof | 9/10 | Einheitlicher Weg für Logs + Metrics ✅ |
| B: Promtail-only (stdout) | Einfachheit, keine App-Änderung | 6/10 | Kein strukturiertes Context-Management |
| C: Direkter Loki-Client in Apps | Direkter Weg | 5/10 | Starker Lock-in, geringe Flexibilität |
| D: Logger-only (File/Console) | Minimal | 3/10 | Keine zentrale Observability, keine Dashboards |

### Warum Option A?

- ✅ **Standards-Compliance:** OTLP ist vendor-neutral und etabliert.
- ✅ **Korrelation:** Logs, Metrics und Traces mit gemeinsamen Resource-Attributen.
- ✅ **Backend-Flexibilität:** Loki kann später ersetzt werden, ohne App-Code zu ändern.
- ✅ **Observability-Consistency:** Gleiches Setup für lokale Entwicklung und Produktion.

---

## Trade-offs & Limitierungen

### Pros
- ✅ Vereinheitlichte Pipeline (ein Exporter, ein Collector).
- ✅ Bessere Korrelation zwischen Log-Events und Metriken.
- ✅ Skalierbar: OTEL Collector als zentraler Hub.

### Cons
- ❌ Zusätzliche Komplexität (Collector + Exporter).
- ❌ Höherer Setup-Aufwand für Entwickler.
- ❌ Doppelpfad möglich (Promtail + OTEL) → Risiko von Duplikaten.

**Mitigation:** Promtail dient nur als Fallback für nicht-OTEL-fähige Services; OTEL-Logs werden bevorzugt. Duplikate werden via Label oder Pipeline-Filter verhindert.

---

## Implementierung / Ausblick

- [ ] SDK-Logger schreibt strukturierte JSON-Logs (timestamp, level, workspace_id, component).
- [ ] OTEL SDK exportiert Logs per OTLP/HTTP an den Collector.
- [ ] Promtail sammelt Container-stdout für Legacy/Third-Party Services.
- [ ] Label-Whitelist & PII-Redaction greifen vor dem Export.

---

## Migration / Exit-Strategie

Bei Wechsel zu z. B. Datadog oder ELK bleibt der App-Code gleich; nur der OTEL Collector und die Exporter-Konfiguration werden angepasst.

---

**Links:**
- [ADR-004: Monitoring Stack – Loki, Grafana & Prometheus](ADR-004-monitoring-stack-loki-grafana-prometheus.md)
- [Design: Docker-basierter Monitoring Stack](../../../openspec/changes/add-docker-monitoring-dev-stack/design.md)
