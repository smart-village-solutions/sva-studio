# Logging & Observability Review – Template

Nutze dieses Template fuer Logging-Reviews. Fokus: Debugging-Tauglichkeit, Struktur, Korrelation, Datenschutz.

## Entscheidung
- Logging-Reifegrad: [Low | Medium | High]
- Begruendung (1–2 Saetze):

## Executive Summary (3–5 Punkte)
- Punkt 1
- Punkt 2
- Punkt 3

## Befunduebersicht
| ID | Thema | Schwere | Bereich | Evidenz |
|---:|-------|---------|---------|---------|
| L1 | …     | 🔴/🟡/🟢 | Struktur/PII/Korrelation | Link/Zitat |

## Detail-Findings
### L1 – Kurztitel
- Beschreibung: …
- Impact/Risiko (Debugging, Sicherheit, Compliance): …
- Evidenz/Quelle: (Logs, Pipelines, Configs)
- Referenzen: observability-best-practices, ADR-006
- Empfehlung/Abhilfe: …

## Checkliste (Status)
- [ ] Pipeline: OTEL SDK -> Collector -> Loki; Promtail nur Fallback
- [ ] SDK Logger Pflicht; kein console.log
- [ ] Strukturierte Logs (JSON) mit stabilen Feldern
- [ ] Pflichtfelder: workspace_id, component, environment, level
- [ ] Korrelation: trace_id, request_id, span_id (falls OTEL aktiv)
- [ ] PII/Secrets redacted; keine Tokens/Passwoerter in Logs
- [ ] Log-Level-Konventionen (error/warn/info/debug) definiert
- [ ] Fehler mit Kontext; keine Stacktraces/PII in Logs
- [ ] Label-Whitelist in App und Promtail konsistent (labelkeep/labeldrop)
- [ ] Sampling oder Rate-Limits bei High-Volume Logs
- [ ] Retention und Zugriff (RBAC) dokumentiert

## Anhaenge
- Eingesetzte Inputs: (Configs, Pipelines, Beispiel-Logs)
