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

## Routing und Ownership

- Primär-Owner: IAM-/Auth-Team
- Sekundär-Owner: Plattform-Team (Keycloak/Redis/Postgres)
- Eskalation: Bei `critical` innerhalb von 15 Minuten
