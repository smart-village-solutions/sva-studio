# Performance-Nachweis IAM Authorize

## Kontext

- Zeitpunkt: 2026-06-04T09:44:22.873Z
- Instanzkontext: de-musterhausen
- Keycloak-Subject: 4d633499-5d51-450f-aa29-e6c44be016db
- Action: content.read
- Resource-Typ: content
- Resource-ID: n. v.
- Organisationskontext: n. v.
- Mess-Requests je Szenario: 12
- Warm-up-Requests je Szenario: 2

## Ergebnisübersicht

| Szenario | Samples | p50 | p95 | p99 | Bewertung |
| --- | --- | --- | --- | --- | --- |
| Cache-Hit | 12 | 131.03 ms | 160.43 ms | 160.43 ms | nicht erfüllt |
| Cache-Miss | 12 | 146.59 ms | 227.56 ms | 227.56 ms | erfüllt |
| Recompute | 12 | 228.10 ms | 643.67 ms | 643.67 ms | nicht erfüllt |

## Abnahmeaussage

- p95 < 100 ms im Cache-Hit-Szenario: nicht erfüllt

## Rohbeobachtungen

### Cache-Hit

- Minimum: 126.45 ms
- Durchschnitt: 135.26 ms
- Maximum: 160.43 ms
- Bewertung: nicht erfüllt
- Cache-Status: hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit

### Cache-Miss

- Minimum: 137.64 ms
- Durchschnitt: 168.33 ms
- Maximum: 227.56 ms
- Bewertung: erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss

### Recompute

- Minimum: 161.08 ms
- Durchschnitt: 267.41 ms
- Maximum: 643.67 ms
- Bewertung: nicht erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss
