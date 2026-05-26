# Performance-Nachweis IAM Authorize

## Kontext

- Zeitpunkt: 2026-05-25T16:44:03.271Z
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
| Cache-Hit | 12 | 109.88 ms | 119.67 ms | 119.67 ms | nicht erfüllt |
| Cache-Miss | 12 | 121.16 ms | 184.16 ms | 184.16 ms | erfüllt |
| Recompute | 12 | 122.36 ms | 132.13 ms | 132.13 ms | erfüllt |

## Abnahmeaussage

- p95 < 100 ms im Cache-Hit-Szenario: nicht erfüllt

## Rohbeobachtungen

### Cache-Hit

- Minimum: 104.82 ms
- Durchschnitt: 110.62 ms
- Maximum: 119.67 ms
- Bewertung: nicht erfüllt
- Cache-Status: hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit

### Cache-Miss

- Minimum: 113.06 ms
- Durchschnitt: 127.22 ms
- Maximum: 184.16 ms
- Bewertung: erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss

### Recompute

- Minimum: 118.12 ms
- Durchschnitt: 123.01 ms
- Maximum: 132.13 ms
- Bewertung: erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss
