# Performance-Nachweis IAM Authorize

## Kontext

- Zeitpunkt: 2026-05-25T16:51:16.997Z
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
| Cache-Hit | 12 | 107.77 ms | 129.86 ms | 129.86 ms | nicht erfüllt |
| Cache-Miss | 12 | 130.12 ms | 145.61 ms | 145.61 ms | erfüllt |
| Recompute | 12 | 127.80 ms | 185.11 ms | 185.11 ms | erfüllt |

## Abnahmeaussage

- p95 < 100 ms im Cache-Hit-Szenario: nicht erfüllt

## Rohbeobachtungen

### Cache-Hit

- Minimum: 104.77 ms
- Durchschnitt: 110.49 ms
- Maximum: 129.86 ms
- Bewertung: nicht erfüllt
- Cache-Status: hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit

### Cache-Miss

- Minimum: 114.52 ms
- Durchschnitt: 127.79 ms
- Maximum: 145.61 ms
- Bewertung: erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss

### Recompute

- Minimum: 109.27 ms
- Durchschnitt: 134.58 ms
- Maximum: 185.11 ms
- Bewertung: erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss
