# Performance-Nachweis IAM Authorize

## Kontext

- Zeitpunkt: 2026-05-25T16:48:23.586Z
- Instanzkontext: de-musterhausen
- Keycloak-Subject: 4d633499-5d51-450f-aa29-e6c44be016db
- Action: poi.read
- Resource-Typ: poi
- Resource-ID: n. v.
- Organisationskontext: n. v.
- Mess-Requests je Szenario: 12
- Warm-up-Requests je Szenario: 2

## Ergebnisübersicht

| Szenario | Samples | p50 | p95 | p99 | Bewertung |
| --- | --- | --- | --- | --- | --- |
| Cache-Hit | 12 | 131.01 ms | 138.70 ms | 138.70 ms | nicht erfüllt |
| Cache-Miss | 12 | 130.12 ms | 148.98 ms | 148.98 ms | erfüllt |
| Recompute | 12 | 126.25 ms | 132.45 ms | 132.45 ms | erfüllt |

## Abnahmeaussage

- p95 < 100 ms im Cache-Hit-Szenario: nicht erfüllt

## Rohbeobachtungen

### Cache-Hit

- Minimum: 125.44 ms
- Durchschnitt: 131.93 ms
- Maximum: 138.70 ms
- Bewertung: nicht erfüllt
- Cache-Status: hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit

### Cache-Miss

- Minimum: 126.84 ms
- Durchschnitt: 132.87 ms
- Maximum: 148.98 ms
- Bewertung: erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss

### Recompute

- Minimum: 117.61 ms
- Durchschnitt: 126.58 ms
- Maximum: 132.45 ms
- Bewertung: erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss
