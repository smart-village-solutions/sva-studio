# Performance-Nachweis IAM Authorize

## Kontext

- Zeitpunkt: 2026-06-11T08:44:29.459Z
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
| Cache-Hit | 12 | 312.32 ms | 513.76 ms | 513.76 ms | nicht erfüllt |
| Cache-Miss | 12 | 188.79 ms | 628.51 ms | 628.51 ms | nicht erfüllt |
| Recompute | 12 | 158.13 ms | 204.40 ms | 204.40 ms | erfüllt |

## Abnahmeaussage

- p95 < 100 ms im Cache-Hit-Szenario: nicht erfüllt

## Rohbeobachtungen

### Cache-Hit

- Minimum: 260.91 ms
- Durchschnitt: 349.83 ms
- Maximum: 513.76 ms
- Bewertung: nicht erfüllt
- Cache-Status: hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit

### Cache-Miss

- Minimum: 164.52 ms
- Durchschnitt: 262.23 ms
- Maximum: 628.51 ms
- Bewertung: nicht erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss

### Recompute

- Minimum: 147.21 ms
- Durchschnitt: 161.97 ms
- Maximum: 204.40 ms
- Bewertung: erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss
