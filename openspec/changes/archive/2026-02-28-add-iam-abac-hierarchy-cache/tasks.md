# Tasks: add-iam-abac-hierarchy-cache

## 1. Policy-Modell erweitern

- [x] 1.1 ABAC-Attribute und Evaluationsregeln definieren
- [x] 1.2 Hierarchische Vererbung modellieren (Org/Geo)
- [x] 1.3 Einschränkungsregeln untergeordneter Ebenen absichern
- [x] 1.4 Instanzgrenzen als harte ABAC-Bedingung modellieren (`instanceId`)
- [x] 1.5 Deterministische Evaluationsreihenfolge dokumentieren (Konfliktauflösung)

## 2. Cache-Strategie

- [x] 2.1 Redis-Caching-Strategie erarbeiten und als Architekturentscheidung dokumentieren (Keys, TTL, Invalidation, Failure-Modes)
- [x] 2.2 Snapshot-Modell pro User/Instanz-Kontext implementieren (Org als Sub-Kontext)
- [x] 2.3 Invalidation-Events spezifizieren und umsetzen
- [x] 2.4 Fallback- und Recompute-Pfade absichern
- [x] 2.5 Monitoring-Metriken für Cache-Hit-Rate, Invalidation-Latenz und Stale-Risiko definieren
- [x] 2.6 Verbindliche Cache-Grenzwerte umsetzen und verifizieren (TTL 300 s, max. Stale-Dauer 300 s, Invalidation P95 <= 2 s/P99 <= 5 s)

## 3. Qualität

- [x] 3.1 Last-/Performancetests für `authorize` ergänzen
- [x] 3.2 Konsistenztests Cache vs. DB ergänzen
- [x] 3.3 Failure-Mode-Tests (stale cache, event loss) ergänzen

## 4. Verifikation & Dokumentation

- [x] 4.1 ABAC-Regelkatalog mit Beispielszenarien dokumentieren
- [x] 4.2 Testmatrix für Hierarchie-/Geo-/Instanzkombinationen dokumentieren
- [x] 4.3 arc42-Referenzen in betroffenen Child-Dokumenten final gegenprüfen

## 5. Architektur-Dokumentation (Review-Befund)

- [x] 5.1 `design.md` für Child D erstellt (ABAC-Evaluationslogik, Vererbungsalgorithmus, Cache-Topologie, Invalidierungs-Sequenz, Failure-Modes)
- [x] 5.2 ADR erstellen: „Postgres NOTIFY für Cache-Invalidierung" (unter `docs/adr/`)
## 6. Operative Observability (Logging-Review 26.02.2026)

- [x] 6.1 SDK Logger für Cache-Modul einsetzen: `createSdkLogger({ component: 'iam-cache' })`
- [x] 6.2 Cache-Events als strukturierte Log-Einträge spezifizieren:
  - `debug`: Cache-Hit (`{ operation: 'cache_lookup', hit: true, ttl_remaining_s }`)
  - `debug`: Cache-Miss (`{ operation: 'cache_lookup', hit: false }`)
  - `warn`: Cache-Stale-Erkennung (`{ operation: 'cache_stale_detected', age_s, max_ttl_s }`)
  - `info`: Cache-Invalidierung (`{ operation: 'cache_invalidate', trigger: 'pg_notify|ttl|recompute', affected_keys }`)
  - `error`: Cache-Invalidierung fehlgeschlagen (`{ operation: 'cache_invalidate_failed', error }`)
- [x] 6.3 OTEL-Metriken definieren: Cache-Hit-Rate (Counter), Invalidation-Latenz (Histogram), Stale-Entry-Rate (Gauge)
- [x] 6.4 Korrelations-IDs in Cache-Operationen durchreichen (`request_id`, `trace_id`)
- [x] 6.5 Monitoring-Dashboard-Vorlage für Grafana spezifizieren (Cache-Hit-Rate, Authorize-Latenz, Invalidation-Events)
- [x] 6.6 Logging-Pflichtfelder sicherstellen: `workspace_id` (= `instanceId`), `component`, `environment`, `level` in allen Cache-/Authorize-Logs
