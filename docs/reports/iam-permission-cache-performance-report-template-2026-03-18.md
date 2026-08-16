# Vorlage Performance-Bericht IAM Permission Cache – 2026-03-18

## Zweck

Diese Vorlage normiert den Liefernachweis für die Redis-gestützte IAM-Autorisierung.

## Pflichtfelder

- Testprofil
- Messumgebung
- Stichprobenzahl
- Endpunkte
- Lastprofil
- Ergebnisübersicht
- Abweichungen
- Artefaktverweise

## 1. Metadaten

- Berichtsdatum:
- Verantwortlich:
- Commit / Branch:
- Umgebung:
- Verwendete Datenbasis / Seed-Stand:

## 2. Testprofil

- Szenario A: Cache-Hit
- Szenario B: Cache-Miss
- Szenario C: Recompute nach Invalidierung
- Szenario D: Fail-Closed bei Redis-/Recompute-Fehler

## 3. Messumgebung

- Laufzeitumgebung:
- Node-Version:
- Redis-Version / Topologie:
- Datenbank:
- Netzwerkprofil:
  - lokal
- Beobachtungswerkzeuge:
  - OTEL-Metriken
  - Prometheus
  - Grafana
  - strukturierte Logs

## 4. Lastprofil

- Mess-Requests:
- Parallelität:
- Dauer je Lauf:
- Warm-up-Dauer:
- Wiederholungen je Szenario:
- Verwendete Endpunkte:
  - `POST /iam/authorize`
  - `GET /iam/me/permissions`

## 5. Ergebnisübersicht

| Szenario   | Netzwerkprofil | Samples | p50 | p95 | p99 | Ziel             | Ergebnis |
| ---------- | -------------- | ------- | --- | --- | --- | ---------------- | -------- |
| Cache-Hit  | lokal          |         |     |     |     | Beobachtungswert |          |
| Cache-Miss | lokal          |         |     |     |     | Beobachtungswert |          |
| Recompute  | lokal          |         |     |     |     | Beobachtungswert |          |

## 6. Beobachtungen

- Cache-Hit-Rate:
- Recompute-Rate pro Minute:
- Redis-Latenz:
- Invalidation-Latenz:
- Readiness-Status während des Laufs:
- erkannte Cold-Starts:

## 7. Abweichungen und Risiken

- Abweichung 1:
- Abweichung 2:
- Operative Auswirkung:
- Empfohlene Maßnahme:

## 8. Artefaktverweise

- Grafana-Screenshot / Dashboard:
- Rohdaten / Export:
- Log-Auszug:
- Lasttest-Skript:
- Verwandter Invalidierungs-Testbericht:
