# ADR-005: Observability Module Ownership

**Datum:** 6. Februar 2026
**Status:** ⏳ Proposed
**Kontext:** Observability & Modulgrenzen (Core, SDK, Monitoring-Client)
**Entscheider:** SVA Studio Team

---

## Entscheidung

Die Observability-Implementierung wird in **drei klar getrennte Schichten** aufgeteilt:

1. **packages/core/** bleibt **observability-neutral** und enthält keine OTEL-, Logger- oder Monitoring-Abhängigkeiten.
2. **packages/sdk/** stellt **framework-agnostische Logger- und Context-Utilities** bereit (z. B. strukturierter Logger, Request-Context, PII-Redaction Hooks).
3. **packages/monitoring-client/** bündelt die **OpenTelemetry SDK-Konfiguration**, Exporter, Collector-Endpoints und Entwicklungs-Dashboards.

Damit bleibt die Kernlogik minimal und stabil, während Observability als **optional, austauschbar und erweiterbar** umgesetzt wird.

---

## Kontext und Problem

Für den Docker-basierten Monitoring-Stack (Prometheus + Loki + Grafana + OTEL Collector) müssen **Logs, Metrics und Traces** in der Entwicklung wie in der Produktion konsistent erfasst werden. Gleichzeitig gilt:

- **Core bleibt framework-agnostisch** und darf keine Infrastruktur-Details erzwingen.
- **SDK soll app-agnostische Utilities bündeln**, damit Plugins und Apps einen gemeinsamen Logging-Standard nutzen.
- **Monitoring-Setup ist optional** (Dev-Stack), darf also nicht zwingend alle Apps/Packages referenzieren.
- **Dependency Hygiene** (workspace-Protokoll, geringe Transitivität) ist entscheidend für Build-Zeit und Wartbarkeit.

Die Entscheidung muss sicherstellen, dass Observability **leicht aktivierbar**, aber **klar gekapselt** ist.

---

## Betrachtete Optionen

| Option | Kriterien | Bewertung | Kommentar |
|---|---|---|---|
| **A: Monitoring-Client Package + SDK Logger (empfohlen)** | Saubere Modulgrenzen, optional, austauschbar | 9/10 | Klarer Ownership-Schnitt, geringe Core-Kopplung ✅ |
| B: Alles in `core` bündeln | Minimale Package-Anzahl | 4/10 | Vermischt Domäne & Infrastruktur, schwer austauschbar |
| C: Alles in `sdk` bündeln | Zentraler Einstiegspunkt | 6/10 | SDK wird zu schwergewichtig, OTEL-Abhängigkeiten überall |
| D: App-spezifische Implementierung | Maximale Flexibilität | 5/10 | Inkonsistente Standards, hoher Pflegeaufwand |

### Warum Option A?

- ✅ **Separation of Concerns:** Core bleibt stabil, Observability bleibt optional.
- ✅ **Austauschbarkeit:** OTEL Collector oder Backend-Wechsel erfordern keine Core-Änderung.
- ✅ **Developer Experience:** SDK bietet konsistente Logger-API, Monitoring-Client kapselt OTEL-Setup.
- ✅ **Build-Performance:** Keine OTEL-Abhängigkeiten in core → geringere Bundle- und Testkosten.

---

## Trade-offs & Limitierungen

### Pros
- ✅ Klare Verantwortlichkeiten zwischen Core, SDK und Monitoring-Client.
- ✅ Einfache Aktivierung/Deaktivierung per Import im App-Entry.
- ✅ Unterstützung von alternativen Backends (z. B. Datadog) ohne Core-Schnittstellenänderung.

### Cons
- ❌ Zusätzliche Packages erhöhen organisatorischen Overhead.
- ❌ App-Teams müssen zwei Packages kennen (`sdk` + `monitoring-client`).
- ❌ Mehrerlei Konfigurationen können Inkonsistenzen verursachen, wenn nicht dokumentiert.

**Mitigation:** Gemeinsame Default-Konfiguration in `monitoring-client` und klare README-Dokumentation.

---

## Implementierung / Ausblick

- [ ] `packages/sdk/src/logger/` erstellt einen strukturierten Logger mit PII-Redaction-Hooks.
- [ ] `packages/monitoring-client/src/otel.ts` enthält OTEL SDK Setup (Exporter, Resource, Instrumentation).
- [ ] `packages/monitoring-client/` enthält Dev-Dashboards und Collector-Konfiguration.
- [ ] Apps aktivieren Observability via explizitem Import (kein implicit side-effect in Core).

---

## Migration / Exit-Strategie

Falls ein anderer Observability-Stack genutzt wird, wird nur `monitoring-client` ausgetauscht. SDK-Logger bleibt stabil, Core bleibt unverändert.

---

**Links:**
- [ADR-004: Monitoring Stack – Loki, Grafana & Prometheus](ADR-004-monitoring-stack-loki-grafana-prometheus.md)
- [Design: Docker-basierter Monitoring Stack](../../../openspec/changes/add-docker-monitoring-dev-stack/design.md)
