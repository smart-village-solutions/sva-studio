# ADR-014: Postgres NOTIFY für IAM-Cache-Invalidierung

**Status:** Accepted  
**Entscheidungsdatum:** 2026-02-28  
**Entschieden durch:** IAM/Core + Plattform

## Kontext

Mit Child D werden Permission-Snapshots pro Benutzer-/Instanzkontext gecacht, um `POST /iam/authorize` im Zielkorridor zu halten. Bei Rollen-, Zuordnungs- oder Policy-Änderungen müssen diese Snapshots zeitnah invalidiert werden.

Rein TTL-basierte Invalidierung erzeugt zu lange Stale-Fenster. Eine synchrone DB-only-Auflösung erhöht hingegen die Latenz und Last.

## Entscheidung

Wir verwenden einen monotonen PostgreSQL-Revisionsvektor als Korrektheitsgrenze. `NOTIFY` ist nur der schnelle Trigger für Eviction und Cleanup:

1. Änderungen an IAM-Rechten erhöhen in derselben Transaktion entweder die benutzerbezogene `userRevision` oder konservativ die instanzweite `instanceRevision`.
2. Dieselbe SQL-Anweisung emittiert ein Event auf Kanal `iam_permission_snapshot_invalidation` mit `eventId`, Revisionsscope und neuer Revision. PostgreSQL stellt es erst nach erfolgreichem Commit zu.
3. Jeder L1- oder Redis-Hit wird erst nach einem schmalen PostgreSQL-Read des aktuellen Revisionsvektors verwendet; Snapshots sind durch beide Revisionen adressiert.
4. Authorize-Instanzen hören auf den Kanal (`LISTEN`), deduplizieren Ereignisse pro `eventId` und entfernen betroffene L1-/Redis-Einträge best-effort.
5. Verlorene, verspätete oder doppelte Events ändern die fachliche Gültigkeit nicht. Alte Revisionskeys werden nach einem Bump nicht mehr adressiert und laufen über TTL aus.
6. Recompute läuft in einem konsistenten PostgreSQL-Snapshot. Vor Publish wird die Revision erneut gelesen; veraltete Kandidaten werden verworfen und höchstens einmal wiederholt.
7. Redis-Lookup-, Snapshot-Write-, Revisions-Read- und Recompute-Fehler enden fail-closed mit HTTP `503` und Fehlercode `database_unavailable`.

## Begründung

- Event-getriebene Invalidierung reduziert Stale-Risiko deutlich gegenüber reinem TTL-Ansatz.
- Postgres NOTIFY ist ohne zusätzliche Broker-Infrastruktur verfügbar.
- Der autoritative Revisions-Read beseitigt Eventverlust als Korrektheitsrisiko; TTL begrenzt nur noch physische Altlasten.

## Verbindliche Leitplanken

- Snapshot-TTL: `300s`
- Maximal tolerierte fachliche Stale-Dauer nach bestätigtem Revisions-Read: `0s`
- Invalidation-End-to-End-Latenz: `P95 <= 2s`, `P99 <= 5s`
- Logging-Pflichtfelder: `workspace_id` (= `instanceId`), `component`, `environment`, `level`, plus `request_id`/`trace_id`

## Alternativen

### Alternative A: Nur TTL

- Vorteil: Sehr einfach
- Nachteil: Stale-Fenster zu lang, keine zeitnahe Reaktion
- Ergebnis: verworfen

### Alternative B: Externer Broker (z. B. Kafka/NATS) als Pflicht

- Vorteil: Hohe Robustheit und Entkopplung
- Nachteil: Deutlich höherer Betriebsaufwand in Phase 1
- Ergebnis: vorerst verworfen, ggf. Re-Review bei Skalierung

## Konsequenzen

### Positiv

- Niedrigere Authorize-Latenz durch Snapshot-Hits
- Revisionsgebundene Gültigkeit unabhängig von der Zuverlässigkeit des Eventkanals
- Gute Beobachtbarkeit über strukturierte Cache-Events und OTEL-Metriken

### Negativ

- Zusätzliche Komplexität für Listener- und Recompute-Pfade
- Temporäre Fail-Closed-`503` möglich, wenn Redis oder Recompute im Autorisierungspfad ausfallen

### Mitigationen

- Monitoring für Hit-Rate, Stale-Rate, Invalidation-Latenz
- Runbook für Eventverlust/Listener-Störung
- Erweiterte Failure-Mode-Tests

## Verwandte ADRs

- `ADR-011-instanceid-kanonischer-mandanten-scope.md`
- `ADR-013-rbac-abac-hybridmodell.md`
