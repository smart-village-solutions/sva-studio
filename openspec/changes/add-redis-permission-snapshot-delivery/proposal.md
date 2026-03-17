# Change: Redis-basierte Permission-Snapshots und Delivery-Nachweis für High-Performance-AuthZ

## Why

Paket 4 verlangt einen Redis-basierten Permission-Cache, belastbare Invalidation und einen messbaren Laufzeitnachweis der zentralen Berechtigungsprüfung. Der aktuelle Stand nutzt noch einen In-Memory-Snapshot-Cache und hat offene Restarbeiten bei Invalidation und endpoint-naher Performance-Verifikation.

## What Changes

- Redis als führenden Laufzeit-Cache für Permission-Snapshots spezifizieren
- Snapshot-Key, Serialisierung, Versionierung und Recompute-Regeln für Redis festlegen
- Ereignisbasierte Invalidation für Rollen-, Gruppen-, Membership- und Hierarchiemutationen abschließen
- Endpoint-nahe Performance- und Lastnachweise als verbindliche Lieferartefakte spezifizieren

## Impact

- Affected specs:
  - `iam-access-control`
  - `iam-core`
- Affected code:
  - `packages/auth`
  - `packages/core`
  - `packages/data`
  - `docs/reports`
  - `docs/guides`
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `07-deployment-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`

## Dependencies

- Baut auf `add-iam-permission-inheritance-engine` auf
- Muss mit vorhandenem Redis-Betriebsprofil und `health/ready` kompatibel bleiben

## Risiken und Gegenmaßnahmen

- Stale Decisions bei Eventverlust: TTL-, Versionierungs- und Recompute-Regeln bleiben verpflichtend
- Redis-Ausfall als kritischer Pfad: fail-closed Verhalten und Readiness-/Alerting-Anforderungen werden explizit gemacht
- Zu optimistische Mikro-Benchmarks: nur endpoint-nahe Lastmessungen gelten als Liefernachweis

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte bestätigt sein:

1. Redis wird für Permission-Snapshots verbindlich und ersetzt den rein lokalen In-Memory-Hit-Pfad.
2. Invalidation muss Rollen-, Permissions-, Membership-, Gruppen- und Hierarchiemutationen abdecken.
3. Die Abnahme basiert auf endpoint-nahen Messungen unter vereinbartem Lastprofil.
4. Bei Redis- oder Recompute-Problemen bleibt der Autorisierungspfad fail-closed.
