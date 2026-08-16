# Multi-Replikat-Nachweis für den IAM-Permission-Cache

## Kontext

- Zeitpunkt: 2026-08-16T10:31:09.363Z
- App-Replikate: 2
- Mess-Requests je Benchmark: 100
- Parallelität für Cache-Hit und Cache-Miss: 100
- Testprofil: Produktionsbuild, lokales Docker-Netz, keine Browser-Drosselung
- Infrastruktur: lokales PostgreSQL und Redis über Docker
- Endpunkt: `POST /iam/authorize` auf zwei unabhängigen App-Prozessen
- Abweichung: Kein synthetisches Slow-4G-Profil; der lokale Docker-Aufbau ist als belastbarer Nachweis freigegeben.

## Integrationsszenarien

| Szenario                     | Ergebnis | Details                                                                  |
| ---------------------------- | -------- | ------------------------------------------------------------------------ |
| Benutzer-Grant               | erfüllt  | Beide Replikate verwenden userRevision 2.                                |
| Benutzer-Revocation          | erfüllt  | Beide Replikate verwenden userRevision 3.                                |
| Transaktionsrollback         | erfüllt  | Grant, Revisions-Bump und NOTIFY wurden gemeinsam verworfen.             |
| Verlorenes Event             | erfüllt  | Die autoritative Revision 4 invalidiert beide Replikate ohne NOTIFY.     |
| Verspätetes Event            | erfüllt  | Ein älteres Event konnte die aktuelle Grant-Entscheidung nicht ersetzen. |
| Instanzinvalidierung         | erfüllt  | Beide Replikate verwenden instanceRevision 10.                           |
| Parallele Mutation/Recompute | erfüllt  | Nach dem Rennen konvergieren beide Replikate auf den Grant.              |
| Redis-Ausfall                | erfüllt  | Der Authorize-Pfad antwortet fail-closed mit HTTP 503.                   |
| DB-Ausfall                   | erfüllt  | Der Authorize-Pfad antwortet fail-closed mit HTTP 503.                   |

## Performance

| Szenario   | Samples |       p50 |       p95 |       p99 |      Grenze | Ergebnis |
| ---------- | ------: | --------: | --------: | --------: | ----------: | -------- |
| cache-hit  |     100 |  52.98 ms |  85.15 ms |  86.37 ms | < 250.00 ms | erfüllt  |
| cache-miss |     100 | 232.55 ms | 257.73 ms | 259.35 ms | < 600.00 ms | erfüllt  |
| recompute  |     100 |   8.30 ms |  13.13 ms |  20.17 ms | < 300.00 ms | erfüllt  |

## Abnahme

Alle Multi-Replikat- und Performance-Kriterien sind erfüllt.
