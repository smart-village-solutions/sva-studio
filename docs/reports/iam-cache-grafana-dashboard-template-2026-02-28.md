# IAM Cache Grafana Dashboard-Vorlage – 2026-02-28

## Ziel

Diese Vorlage definiert ein minimales Dashboard für den Child-D-Betrieb von IAM Authorize (ABAC + Hierarchie + Cache).

## Panel 1: Cache-Hit-Rate

- Typ: Time series
- Query (PromQL):

```promql
sum(rate(sva_iam_cache_lookup_total{hit="true"}[5m]))
/
clamp_min(sum(rate(sva_iam_cache_lookup_total[5m])), 0.0001)
```

- Alert-Empfehlung: Warnung bei Hit-Rate `< 0.8` über 15 Minuten

## Panel 2: Authorize-Latenz P95

- Typ: Time series
- Query (PromQL):

```promql
histogram_quantile(0.95, sum(rate(sva_iam_authorize_duration_ms_bucket[5m])) by (le))
```

- Zielwert: `< 50 ms`

## Panel 3: Invalidation-Latenz

- Typ: Time series
- Query (PromQL):

```promql
histogram_quantile(0.95, sum(rate(sva_iam_cache_invalidation_duration_ms_bucket[5m])) by (le))
```

- Zielwert: `P95 <= 2 s`, `P99 <= 5 s`

## Panel 4: Stale-Entry-Rate

- Typ: Gauge
- Query (PromQL):

```promql
avg(sva_iam_cache_stale_entry_rate)
```

- Alert-Empfehlung: Warnung bei Stale-Rate `> 0.05` über 10 Minuten

## Panel 5: Invalidation-Events (Loki)

- Typ: Logs
- Query (LogQL):

```logql
{component="iam-cache"} |= "cache_invalidate"
```

## Panel 6: Cache-Fehler (Loki)

- Typ: Logs
- Query (LogQL):

```logql
{component="iam-cache", level="error"} |= "cache_invalidate_failed"
```

## Pflichtfilter

- `workspace_id` (mandantenbezogene Sicht)
- `environment`
- `component` (`iam-authorize`, `iam-cache`)
