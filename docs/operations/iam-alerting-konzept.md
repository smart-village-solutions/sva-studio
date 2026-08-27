# IAM Alerting-Konzept

## Ziel

Dieses Dokument definiert operative Alert-Regeln für den IAM-Service des SVA Studio.

## Metriken und Schwellwerte

### 1. Keycloak-Latenz

- Metrik: `iam_keycloak_request_duration_seconds`
- Alert-Bedingung: `p95 > 5s` über `5m`
- Severity: `warning`
- Aktion:
  1. Keycloak-Verfügbarkeit prüfen
  2. Circuit-Breaker-State prüfen
  3. IAM-Write-Endpunkte beobachten (`503`-Rate)

### 2. Circuit Breaker

- Metrik: `iam_circuit_breaker_state`
- Alert-Bedingung: `== 2` über `2m`
- Severity: `critical`
- Aktion:
  1. Keycloak Admin API prüfen
  2. Fallback-/Degraded-Mode kommunizieren
  3. Nach Stabilisierung Recovery verifizieren

### 3. Fehlerhafte IAM-Operationen

- Metrik: `iam_user_operations_total{result="failure"}`
- Alert-Bedingung: Rate `> 10/min` über `5m`
- Severity: `warning`
- Aktion:
  1. Häufigste Error-Codes aus Logs ermitteln
  2. Rate-Limit/CSRF/Idempotency-Konflikte gegen echte Fehler abgrenzen
  3. Bei Keycloak-Fehlern Abhängigkeit eskalieren

### 4. Role-Sync-Fehlerquote

- Metrik: `iam_role_sync_operations_total`
- Alert-Bedingung Warnung: Fehlerquote `> 5%` über `15m`
- Alert-Bedingung Kritisch: Fehlerquote `> 20%` über `10m`
- Severity: `warning` / `critical`
- Aktion:
  1. Fehler nach `operation` und `error_code` aufschlüsseln
  2. `iam_keycloak_request_duration_seconds` und `iam_circuit_breaker_state` parallel prüfen
  3. Bei `IDP_FORBIDDEN` Rechte-Matrix des Service-Accounts prüfen
  4. Bei `DB_WRITE_FAILED` Postgres-Health und Migrationsstand prüfen

### 5. Drift-Backlog im Rollen-Katalog

- Metrik: `iam_role_drift_backlog`
- Alert-Bedingung Warnung: Backlog `> 0` über `15m`
- Alert-Bedingung Kritisch: Backlog `> 0` über `60m`
- Severity: `warning` / `critical`
- Aktion:
  1. Betroffene `instance_id` identifizieren
  2. letzten Reconcile-Lauf und Audit-Events prüfen
  3. manuelles Reconcile für die betroffene Instanz ausführen
  4. orphaned Rollen nur nach dokumentierter Freigabe bereinigen

### 6. Authorization-Cache degradiert

- Metriken:
  - `sva_iam_cache_lookup_total`
  - `sva_iam_cache_invalidation_duration_ms`
  - `sva_iam_cache_stale_entry_rate`
- Alert-Bedingung: Redis-Latenz > `50 ms` oder Recompute-Rate > `20/min` über `5m`
- Severity: `warning`
- Aktion:
  1. `GET /health/ready` und `checks.authorizationCache` prüfen
  2. Redis-Latenz, Command-Saturation und Evictions über `redis-exporter` prüfen
  3. auf erhöhte Recompute-Last oder fehlgeschlagene Invalidation-Events in den Logs korrelieren

### 7. Authorization-Cache ausgefallen

- Metriken:
  - `redis_up`
  - `sva_iam_cache_invalidation_duration_ms`
- Alert-Bedingung: drei aufeinanderfolgende Redis-Fehler bzw. `GET /health/ready` liefert `503` wegen `authorizationCache.status=failed`
- Severity: `critical`
- Aktion:
  1. Redis-Erreichbarkeit und Authentisierung prüfen
  2. `cache_store_failed`, `cache_lookup_failed` und `cache_invalidate_failed` in den Logs prüfen
  3. nach Redis-Recovery Readiness erneut prüfen; Autorisierung bleibt bis dahin fail-closed mit `503`

### 8. Redis-Infrastruktur für Permission-Cache

- Metriken:
  - `redis_up`
  - `redis_connected_clients`
  - `redis_memory_used_bytes`
  - `redis_evicted_keys_total`
- Alert-Bedingung Warnung: Evictions steigen dauerhaft oder `redis_memory_used_bytes` > `85%` des Limits über `10m`
- Alert-Bedingung Kritisch: `redis_up == 0` über `2m`
- Severity: `warning` / `critical`
- Aktion:
  1. prüfen, ob Session- und Snapshot-Keyspaces dieselbe Instanz nutzen
  2. `allkeys-lru`-Verhalten gegen Snapshot-Keyspace und Session-Keyspace abgleichen
  3. bei anhaltenden Evictions Keyspace-Trennung oder Speicherkontingent anpassen

## Beispiel-PromQL

```promql
histogram_quantile(0.95, sum by (le) (rate(iam_keycloak_request_duration_seconds_bucket[5m]))) > 5
```

```promql
max(iam_circuit_breaker_state) == 2
```

```promql
sum(rate(iam_user_operations_total{result="failure"}[1m])) > 10
```

```promql
sum(rate(iam_role_sync_operations_total{result="failure"}[15m]))
/
clamp_min(sum(rate(iam_role_sync_operations_total[15m])), 0.001) > 0.05
```

```promql
max by (instance_id) (iam_role_drift_backlog) > 0
```

```promql
histogram_quantile(0.95, sum by (le) (rate(sva_iam_cache_invalidation_duration_ms_bucket[5m]))) > 2
```

```promql
max(redis_up) == 0
```

## Routing und Ownership

- Primär-Owner: IAM-/Auth-Team
- Sekundär-Owner: Plattform-Team (Keycloak/Redis/Postgres)
- Eskalation: Bei `critical` innerhalb von 15 Minuten
- Ziel-SLO für Rollen-Drift: Erkennung `<= 15 Minuten`, Korrektur oder Eskalation `<= 60 Minuten`
- Redis-Metriken für Session-Store und Permission-Cache werden gemeinsam durch `redis-exporter` erhoben, aber getrennt bewertet
