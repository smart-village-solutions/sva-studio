# WP-004 Abnahmeprotokoll: Permission Engine

## Ausgangslage

- Arbeitspaket: `WP-004`
- Titel: `Permission Engine`
- Bezugsdatum dieses Protokolls: `2026-05-25`
- Dieses Protokoll bereitet die Kundenabnahme für den zentralen IAM-Autorisierungspfad vor.
- Die Aussagen stützen sich auf die aktuelle `auth-runtime`-Implementierung, vorhandene Architektur- und Benchmark-Dokumente sowie gezielt verifizierte Tests für Authorize, Snapshot-Cache und Invalidation.

## Abnahmescope

Für `WP-004` gelten in diesem Protokoll folgende Prüfpunkte als maßgeblich:

1. Der zentrale Autorisierungs-Endpunkt liefert korrekte Entscheidungen für Rollen-, Gruppen- und Direktberechtigungen.
2. Permission-Snapshots werden nach Erstberechnung in Redis gespeichert und bei Folgeaufrufen wiederverwendet.
3. Cache-Invalidierung greift nach Rollen-, Gruppen- oder Benutzeränderungen.
4. Die Latenzanforderung von unter `100 ms` im Cache-Hit-Szenario ist belastbar nachgewiesen.

## Ergebnis

`WP-004` ist fachlich und technisch zum Bezugsdatum `2026-05-25` **abnahmefähig**.

Die funktionalen Kriterien für Authorize-Entscheidung, Redis-Snapshot-Verwendung, Invalidation und den endpointnahen Performance-Nachweis sind repo-seitig belegt. Der zuvor offene Performance-Blocker ist durch den erfolgreich demonstrierten GUI-gestützten Lauf gegen den echten `/iam/authorize`-Pfad geschlossen.

## Kurzfazit für den Kundentermin

- Der zentrale `/iam/authorize`-Pfad ist implementiert und liefert nachvollziehbare Entscheidungen.
- Rollen-, Gruppen- und Direktquellen werden im Permission-Aufbau getrennt modelliert und in effektive Berechtigungen überführt.
- Redis-Snapshots, HMAC-Integritätsschutz, L1/L2-Cache-Pfad und Invalidation-Events sind vorhanden und testseitig nachgewiesen.
- Der operative Endpunkt-Nachweis zur `< 100 ms`-Anforderung im Cache-Hit-Szenario liegt jetzt vor.

## Empfohlener Ablauf im Kundengespräch

1. Kurze Einordnung des Scopes von `WP-004`
2. Erläuterung des zentralen Authorize-Endpunkts
3. Darstellung von Snapshot-Cache und Redis-Read-Path
4. Erläuterung der Invalidation nach Rollen-, Gruppen- und User-Änderungen
5. Darstellung des erfolgreichen endpointnahen Performance-Nachweises
6. Abschluss mit formaler Freigabeempfehlung für die Endabnahme

## Gesprächsleitfaden

### 1. Zentraler Authorize-Endpunkt

Im Termin sollte gezeigt werden, dass Berechtigungsentscheidungen nicht verteilt in einzelnen Modulen entstehen, sondern über einen zentralen IAM-Pfad laufen. Der aktuelle Handler verarbeitet Instanz-, Organisations-, Geo- und Impersonation-Kontext und liefert das Ergebnis zusammen mit `snapshotVersion` und `cacheStatus` zurück.

**Repo-seitig gestützt durch:**

- [packages/auth-runtime/src/iam-authorization/authorize.ts](../../packages/auth-runtime/src/iam-authorization/authorize.ts)
- [packages/auth-runtime/src/iam-authorization/me-permissions.ts](../../packages/auth-runtime/src/iam-authorization/me-permissions.ts)
- [packages/auth-runtime/src/iam-authorization/authorize.test.ts](../../packages/auth-runtime/src/iam-authorization/authorize.test.ts)
- [packages/auth-runtime/src/iam-authorization/me-permissions.test.ts](../../packages/auth-runtime/src/iam-authorization/me-permissions.test.ts)

### 2. Rollen-, Gruppen- und Direktberechtigungen

Die Permission-Ermittlung berücksichtigt mehrere Herkunftsarten. In den Query- und Mapping-Pfaden werden direkte Benutzerrechte, direkte Rollenzuweisungen und gruppenbasierte Rollen getrennt verarbeitet und mit Provenienz zusammengeführt. Hierarchie- und Restriktionsfälle sind zusätzlich über die vorhandene IAM-Testmatrix dokumentiert.

**Repo-seitig gestützt durch:**

- [packages/auth-runtime/src/iam-authorization/permission-store.queries.ts](../../packages/auth-runtime/src/iam-authorization/permission-store.queries.ts)
- [packages/auth-runtime/src/iam-authorization/shared-effective-permissions.ts](../../packages/auth-runtime/src/iam-authorization/shared-effective-permissions.ts)
- [packages/auth-runtime/src/iam-authorization/shared-effective-permissions.test.ts](../../packages/auth-runtime/src/iam-authorization/shared-effective-permissions.test.ts)
- [packages/auth-runtime/src/iam-authorization/shared.test.ts](../../packages/auth-runtime/src/iam-authorization/shared.test.ts)
- [docs/reports/iam-authorization-testmatrix-2026-02-28.md](./iam-authorization-testmatrix-2026-02-28.md)

### 3. Redis-Snapshot-Cache

Der aktuelle Permission-Store prüft zuerst den lokalen L1-Cache, danach Redis als Shared-Read-Path und erst danach den Recompute aus der Datenbank. Redis-Snapshots werden mit TTL, Schema-Version und HMAC signiert gespeichert. Bei einem Redis-Hit wird der In-Memory-Cache hydratisiert; bei Miss oder Stale-Fall wird neu berechnet und wieder in Redis geschrieben. Redis-Ausfälle führen fail-closed zu `database_unavailable`.

**Repo-seitig gestützt durch:**

- [packages/auth-runtime/src/iam-authorization/permission-store.ts](../../packages/auth-runtime/src/iam-authorization/permission-store.ts)
- [packages/auth-runtime/src/iam-authorization/redis-permission-snapshot.server.ts](../../packages/auth-runtime/src/iam-authorization/redis-permission-snapshot.server.ts)
- [packages/auth-runtime/src/iam-authorization/permission-store.test.ts](../../packages/auth-runtime/src/iam-authorization/permission-store.test.ts)
- [packages/auth-runtime/src/iam-authorization/redis-permission-snapshot.server.test.ts](../../packages/auth-runtime/src/iam-authorization/redis-permission-snapshot.server.test.ts)

### 4. Cache-Invalidierung

Für Rollen-, Gruppen-, Benutzer-, Delegations- und Hierarchieänderungen ist ein dedizierter Invalidation-Pfad vorhanden. User-scoped Events invalidieren gezielt den betroffenen Benutzer-Snapshot; rollen- oder hierarchieseitige Änderungen invalidieren instanzweite Snapshots. Event-Deduplizierung und Fallback-Verhalten bei unvollständigen Gruppenevents sind testseitig abgedeckt.

**Repo-seitig gestützt durch:**

- [packages/auth-runtime/src/iam-authorization/snapshot-invalidation.server.ts](../../packages/auth-runtime/src/iam-authorization/snapshot-invalidation.server.ts)
- [packages/auth-runtime/src/iam-authorization/snapshot-invalidation.server.test.ts](../../packages/auth-runtime/src/iam-authorization/snapshot-invalidation.server.test.ts)
- [packages/auth-runtime/src/iam-authorization/shared.ts](../../packages/auth-runtime/src/iam-authorization/shared.ts)

### 5. Performance-Nachweis

Es liegen evaluator-nahe Baselines und inzwischen auch ein endpointnaher Bericht gegen den echten `/iam/authorize`-Pfad vor. Damit sind sowohl die fachliche Entscheidungslogik als auch der operative Endpunktpfad belastbar belegt.

**Vorliegende Evidenz:**

- [docs/reports/iam-authorize-baseline-2026-02-27.md](./iam-authorize-baseline-2026-02-27.md)
- [docs/reports/iam-authorize-abac-cache-baseline-2026-02-28.md](./iam-authorize-abac-cache-baseline-2026-02-28.md)
- [docs/reports/wp-004-permission-engine-performance-nachweis-2026-05-25.md](./wp-004-permission-engine-performance-nachweis-2026-05-25.md)
- [docs/reports/iam-authorize-performance-2026-05-25T16-57-45Z.md](./iam-authorize-performance-2026-05-25T16-57-45Z.md)
- [docs/reports/iam-authorize-performance-2026-05-25T16-57-45Z.json](./iam-authorize-performance-2026-05-25T16-57-45Z.json)
- [scripts/ci/run-iam-authorize-performance.ts](../../scripts/ci/run-iam-authorize-performance.ts)
- [docs/reports/iam-permission-cache-performance-report-template-2026-03-18.md](./iam-permission-cache-performance-report-template-2026-03-18.md)
- [docs/reports/2026-03-31-iam-offer-packages-3-to-5-abnahmeartefakte.md](./2026-03-31-iam-offer-packages-3-to-5-abnahmeartefakte.md)

**Bewertung:**

- Evaluator-Benchmark: vorhanden und grün
- Endpointnaher Cache-Hit-Bericht: vorhanden und grün
- Endpointnaher Cache-Miss-/Recompute-Bericht: vorhanden und grün
- Belastbarer lokaler Umgebungsnachweis unter echter Session und realem Endpunktpfad: vorhanden

## Kurzprotokoll

| Akzeptanzkriterium | Fachliche Aussage für die Abnahme | Bewertung |
| --- | --- | --- |
| Der zentrale Autorisierungs-Endpunkt liefert korrekte Entscheidungen für Rollen-, Gruppen- und Direktberechtigungen | Implementierung, Query-Pfad und gezielte Tests belegen den zentralen Decision-Flow einschließlich Rollen-, Gruppen- und Direktquellen | erfüllt |
| Permission-Snapshots werden nach Erstberechnung in Redis gespeichert und bei Folgeaufrufen wiederverwendet | L1/L2-Cache-Pfad, Redis-Hydration, HMAC-Schutz und Recompute-Verhalten sind implementiert und testseitig belegt | erfüllt |
| Cache-Invalidierung greift nach Rollen-, Gruppen- oder Benutzeränderungen | User-scoped, rollengetriebene, gruppengetriebene und hierarchische Invalidierungsereignisse sind implementiert und testseitig belegt | erfüllt |
| Die Latenzanforderung von unter 100 ms im Cache-Hit-Szenario ist belastbar nachgewiesen | Der endpointnahe GUI-gestützte Benchmark gegen den echten `/iam/authorize`-Pfad liegt mit `p95 = 10.44 ms` im Cache-Hit-Szenario deutlich innerhalb des Zielwerts; Cache-Miss und Recompute sind ebenfalls grün | erfüllt |

## Heutige Verifikation

Am `2026-05-25` wurden für den aktuellen `auth-runtime`-Stand folgende Nachweise erneut ausgeführt:

- `pnpm nx run auth-runtime:test:types` -> erfolgreich
- `pnpm nx run auth-runtime:test:unit` -> erfolgreich
- `pnpm exec vitest run src/iam-authorization/authorize.test.ts src/iam-authorization/me-permissions.test.ts src/iam-authorization/permission-store.test.ts src/iam-authorization/redis-permission-snapshot.server.test.ts src/iam-authorization/snapshot-invalidation.server.test.ts` -> `5` Dateien, `26` Tests, alle grün
- `pnpm exec vitest run src/iam-authorization/shared-effective-permissions.test.ts src/iam-authorization/shared.test.ts src/iam-authorization/shared-cache-health.test.ts` -> `3` Dateien, `18` Tests, alle grün
- GUI-gestützter Monitoring-Lauf gegen `POST /iam/authorize` -> erfolgreich, Report `iam-authorize-performance-2026-05-25T16-57-45Z.*`
- Cache-Hit: `p95 = 10.44 ms`
- Cache-Miss: `p95 = 138.71 ms`
- Recompute: `p95 = 15.98 ms`

## Abnahmeentscheidung

Auf Basis der vorliegenden Prüfevidenz wird `WP-004` zum Bezugsdatum `2026-05-25` als **abnahmefähig** bewertet.

**Empfohlene Freigabeformulierung im Termin:**

> Das Arbeitspaket `WP-004` ist aus fachlicher und technischer Sicht abnahmefähig. Der zentrale Authorize-Pfad, Redis-Snapshots, Invalidation und der endpointnahe Performance-Nachweis sind nachvollziehbar umgesetzt und prüfbar belegt.

## Repo-seitige Stützbelege

- Kernimplementierung:
  - [packages/auth-runtime/src/iam-authorization/authorize.ts](../../packages/auth-runtime/src/iam-authorization/authorize.ts)
  - [packages/auth-runtime/src/iam-authorization/me-permissions.ts](../../packages/auth-runtime/src/iam-authorization/me-permissions.ts)
  - [packages/auth-runtime/src/iam-authorization/permission-store.ts](../../packages/auth-runtime/src/iam-authorization/permission-store.ts)
  - [packages/auth-runtime/src/iam-authorization/permission-store.queries.ts](../../packages/auth-runtime/src/iam-authorization/permission-store.queries.ts)
  - [packages/auth-runtime/src/iam-authorization/shared-effective-permissions.ts](../../packages/auth-runtime/src/iam-authorization/shared-effective-permissions.ts)
  - [packages/auth-runtime/src/iam-authorization/redis-permission-snapshot.server.ts](../../packages/auth-runtime/src/iam-authorization/redis-permission-snapshot.server.ts)
  - [packages/auth-runtime/src/iam-authorization/snapshot-invalidation.server.ts](../../packages/auth-runtime/src/iam-authorization/snapshot-invalidation.server.ts)
- Testevidenz:
  - [packages/auth-runtime/src/iam-authorization/authorize.test.ts](../../packages/auth-runtime/src/iam-authorization/authorize.test.ts)
  - [packages/auth-runtime/src/iam-authorization/me-permissions.test.ts](../../packages/auth-runtime/src/iam-authorization/me-permissions.test.ts)
  - [packages/auth-runtime/src/iam-authorization/permission-store.test.ts](../../packages/auth-runtime/src/iam-authorization/permission-store.test.ts)
  - [packages/auth-runtime/src/iam-authorization/redis-permission-snapshot.server.test.ts](../../packages/auth-runtime/src/iam-authorization/redis-permission-snapshot.server.test.ts)
  - [packages/auth-runtime/src/iam-authorization/snapshot-invalidation.server.test.ts](../../packages/auth-runtime/src/iam-authorization/snapshot-invalidation.server.test.ts)
  - [packages/auth-runtime/src/iam-authorization/shared-effective-permissions.test.ts](../../packages/auth-runtime/src/iam-authorization/shared-effective-permissions.test.ts)
  - [packages/auth-runtime/src/iam-authorization/shared.test.ts](../../packages/auth-runtime/src/iam-authorization/shared.test.ts)
  - [packages/auth-runtime/src/iam-authorization/shared-cache-health.test.ts](../../packages/auth-runtime/src/iam-authorization/shared-cache-health.test.ts)
- Berichte und Vorgaben:
  - [docs/reports/iam-authorization-testmatrix-2026-02-28.md](./iam-authorization-testmatrix-2026-02-28.md)
  - [docs/reports/iam-authorize-baseline-2026-02-27.md](./iam-authorize-baseline-2026-02-27.md)
  - [docs/reports/iam-authorize-abac-cache-baseline-2026-02-28.md](./iam-authorize-abac-cache-baseline-2026-02-28.md)
  - [docs/reports/wp-004-permission-engine-performance-nachweis-2026-05-25.md](./wp-004-permission-engine-performance-nachweis-2026-05-25.md)
  - [docs/reports/iam-authorize-performance-2026-05-25T16-57-45Z.md](./iam-authorize-performance-2026-05-25T16-57-45Z.md)
  - [docs/reports/iam-authorize-performance-2026-05-25T16-57-45Z.json](./iam-authorize-performance-2026-05-25T16-57-45Z.json)
  - [docs/reports/iam-permission-cache-performance-report-template-2026-03-18.md](./iam-permission-cache-performance-report-template-2026-03-18.md)
  - [docs/reports/2026-03-31-iam-offer-packages-3-to-5-abnahmeartefakte.md](./2026-03-31-iam-offer-packages-3-to-5-abnahmeartefakte.md)
  - [docs/reports/cms-v2-umsetzungsstand-milestone-1-pakete-1-5-2026-03-24.md](./cms-v2-umsetzungsstand-milestone-1-pakete-1-5-2026-03-24.md)

## Restlücken

Für die finale Kundenabnahme von `WP-004` verbleiben keine repo-seitigen Blocker mehr.

- optional kann ergänzend ein separates Invalidation-Testprotokoll als operatives Delivery-Artefakt abgelegt werden
- optional kann ein Zielumgebungslauf zusätzlich archiviert werden, ist für die Repository-seitige Abnahmevorbereitung aber kein offener Pflichtpunkt mehr

## Entscheidung

Für den Projektstatus `apps/project-report/src/data/project-status.json` ist `WP-004` mit diesem Protokoll fachlich und technisch **sauber abnahmefähig**. Der Status **`acceptance`** ist damit konsistent.
