# ADR-014: Postgres NOTIFY für IAM-Cache-Invalidierung

**Status:** Accepted  
**Entscheidungsdatum:** 2026-02-28  
**Entschieden durch:** IAM/Core + Plattform

## Kontext

Mit Child D werden Permission-Snapshots pro Benutzer-/Instanzkontext gecacht, um `POST /iam/authorize` im Zielkorridor zu halten. Bei Rollen-, Zuordnungs- oder Policy-Änderungen müssen diese Snapshots zeitnah invalidiert werden.

Rein TTL-basierte Invalidierung erzeugt zu lange Stale-Fenster. Eine synchrone DB-only-Auflösung erhöht hingegen die Latenz und Last.

## Entscheidung

Wir verwenden **Postgres NOTIFY** als primären Trigger für Cache-Invalidierung und kombinieren ihn mit **TTL/Recompute-Begrenzung**:

1. Änderungen an IAM-Rechten emittieren ein Event auf Kanal `iam_permission_snapshot_invalidation` mit `eventId`.
2. Authorize-Instanzen hören auf den Kanal (`LISTEN`) und deduplizieren Ereignisse pro `eventId`.
3. Betroffene Snapshot-Scopes werden invalidiert (User- oder Instanzscope).
4. Falls Events verloren gehen, begrenzt TTL die Stale-Dauer; ein technischer Fehler führt jedoch nicht zu einem fachlichen Fallback.
5. Redis-Lookup-, Snapshot-Write- und Recompute-Fehler enden fail-closed mit HTTP `503` und Fehlercode `database_unavailable`.

## Begründung

- Event-getriebene Invalidierung reduziert Stale-Risiko deutlich gegenüber reinem TTL-Ansatz.
- Postgres NOTIFY ist ohne zusätzliche Broker-Infrastruktur verfügbar.
- TTL/Recompute begrenzt Eventverlust, ohne einen unsicheren Stale-Fallback einzuführen.

## Verbindliche Leitplanken

- Snapshot-TTL: `300s`
- Maximal tolerierte Stale-Dauer: `300s`
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
- Konsistente Invalidierung mit klaren Fallbacks
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
