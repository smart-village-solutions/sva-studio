# Performance-Nachweis IAM Authorize

## Kontext

- Zeitpunkt: 2026-06-11T07:27:19.457Z
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
| Cache-Hit | 12 | 122.97 ms | 169.28 ms | 169.28 ms | nicht erfüllt |
| Cache-Miss | 12 | 129.17 ms | 140.69 ms | 140.69 ms | erfüllt |
| Recompute | 12 | 135.61 ms | 166.02 ms | 166.02 ms | erfüllt |

## Abnahmeaussage

- p95 < 100 ms im Cache-Hit-Szenario: nicht erfüllt

## Rohbeobachtungen

### Cache-Hit

- Minimum: 115.95 ms
- Durchschnitt: 130.26 ms
- Maximum: 169.28 ms
- Bewertung: nicht erfüllt
- Cache-Status: hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit, hit

### Cache-Miss

- Minimum: 117.76 ms
- Durchschnitt: 129.41 ms
- Maximum: 140.69 ms
- Bewertung: erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss

### Recompute

- Minimum: 122.91 ms
- Durchschnitt: 137.10 ms
- Maximum: 166.02 ms
- Bewertung: erfüllt
- Cache-Status: miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss, miss
