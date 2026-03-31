# ADR-026: Redis als primärer Shared Permission Cache

**Status:** Accepted
**Entscheidungsdatum:** 2026-03-31
**Entschieden durch:** SVA Studio Team

## Kontext

Die effektive Berechtigungsauflösung kombiniert Rollen, Gruppen, Organisationskontext und Geo-Kontext. Für `POST /iam/authorize` und `GET /iam/me/permissions` wird deshalb ein gemeinsam nutzbarer Snapshot-Read-Path benötigt, der schnell, invalidierbar und mandantengetrennt bleibt.

## Entscheidung

Redis wird als primärer Shared-Read-Path für Permission-Snapshots verwendet. Ein lokaler In-Memory-Cache bleibt als L1 erlaubt, darf Redis aber nicht ersetzen.

## Begründung

- Redis ermöglicht kontextgebundene Snapshots mit TTL, Versionierung und gezielter Invalidierung.
- Der Shared-Cache vermeidet inkonsistente Prozess-Lokalcaches.
- Fail-Closed-Regeln, Readiness und Observability lassen sich auf einen zentralen Read-Path ausrichten.

## Konsequenzen

### Positive Konsequenzen

- Endpoint-nahe Latenzziele werden realistisch erreichbar
- User-scoped und hierarchische Invalidierungen lassen sich normieren
- Betriebszustände wie `warming`, `degraded` und `failed` werden explizit messbar

### Negative Konsequenzen

- Redis wird zur kritischen Infrastruktur für den Autorisierungspfad
- Ausfall oder Fehlkonfiguration blockieren geschützte Zugriffe

### Mitigationen

- HTTP `503` fail-closed statt stiller Freigabe
- OTEL-Metriken, `redis-exporter`, Readiness-Gates und Performance-Berichte

## Verwandte ADRs

- `ADR-014-postgres-notify-cache-invalidierung.md`
- `ADR-022-iam-groups-geo-hierarchie-permission-caching.md`
- `ADR-025-multi-scope-prioritaetsregel-fuer-iam.md`
