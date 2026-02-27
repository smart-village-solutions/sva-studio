# Design: Child D – ABAC, Hierarchie-Vererbung und Cache

## Kontext

Child D erweitert RBAC v1 um ABAC-Regeln, Hierarchie-Vererbung und Cache-Invalidierung. Ziel ist konsistente Autorisierung bei höherer Komplexität und Last.

## Ziele

- Deterministische ABAC-Evaluation im Instanzkontext
- Vererbungslogik für Organisations- und Geo-Hierarchien
- Cache-Snapshots mit kontrollierter Invalidierung
- Performance im Zielkorridor (P95)

## Architekturentscheidungen

1. Evaluationsreihenfolge ist fest: Instanzgrenze -> harte Deny-Regeln -> RBAC-Basis -> ABAC-Regeln -> finale Entscheidung
2. `instanceId` bleibt zwingende Vorbedingung für jede Entscheidung
3. Snapshot-Cache pro Benutzer-/Instanzkontext; Organisation als Sub-Kontext
4. Invalidation über Events mit TTL/Recompute-Fallback

## Vererbungsalgorithmus

- Berechtigungen können von übergeordneten Ebenen vererbt werden
- Untergeordnete Restriktionen können geerbte Berechtigungen einschränken
- Bei Konflikten gewinnt die restriktivere Regel

## Cache-Topologie

- Redis als primärer Snapshot-Store
- Schlüssel enthalten mindestens Benutzer, Instanz, Versionsmarker
- Invalidation bei Rollen-/Zuordnungs-/Policy-Änderungen
- Fallback bei Eventverlust: TTL und erzwungener Recompute

## Operative Observability

- SDK Logger ist verpflichtend für Cache-Operationen (`component: iam-cache`)
- Strukturierte Cache-Events für Hit/Miss/Stale/Invalidierung und Fehler
- OTEL-Metriken für Hit-Rate, Invalidation-Latenz und Stale-Risiko
- `request_id` und `trace_id` werden in Cache-bezogenen Autorisierungspfaden propagiert

## Architekturartefakte

- ADR: Postgres NOTIFY als primärer Invalidation-Trigger mit TTL/Recompute-Fallback
- ADR-013: RBAC+ABAC-Hybridmodell (Stage-Grenzen und Evaluationsreihenfolge Child C/D)

## Alternativen und Abwägung

- Reiner DB-Pfad ohne Cache: verworfen wegen Performance-Risiko
- Zeitbasierte Invalidierung ohne Events: verworfen wegen langer Stale-Intervalle

## Verifikation

- Konsistenztests Cache vs. DB
- Failure-Mode-Tests (Eventverlust, Cache-Miss, Stale-Entry)
- Lasttests für `authorize` unter ABAC-Bedingungen

## arc42-Referenzen (final)

- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/09-architecture-decisions.md`
- `docs/architecture/10-quality-requirements.md`
