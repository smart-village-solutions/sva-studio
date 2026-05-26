# Performance-Nachweis IAM Authorize

## Kontext

- Zeitpunkt: 2026-05-25T16:57:45.813Z
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
| Cache-Hit | 12 | 3.99 ms | 10.44 ms | 10.44 ms | erfüllt |
| Cache-Miss | 12 | 10.58 ms | 138.71 ms | 138.71 ms | erfüllt |
| Recompute | 12 | 9.00 ms | 15.98 ms | 15.98 ms | erfüllt |

## Abnahmeaussage

- p95 < 100 ms im Cache-Hit-Szenario: erfüllt

## Rohbeobachtungen

### Cache-Hit

- Minimum: 2.45 ms
- Durchschnitt: 5.15 ms
- Maximum: 10.44 ms
- Bewertung: erfüllt
- Cache-Status: hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit

### Cache-Miss

- Minimum: 6.40 ms
- Durchschnitt: 21.83 ms
- Maximum: 138.71 ms
- Bewertung: erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss

### Recompute

- Minimum: 6.72 ms
- Durchschnitt: 9.57 ms
- Maximum: 15.98 ms
- Bewertung: erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss
