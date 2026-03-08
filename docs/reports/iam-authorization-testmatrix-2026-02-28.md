# IAM Authorization Testmatrix (Instanz/Org/Geo/Hierarchie/Cache) – 2026-02-28

## Ziel

Diese Matrix dokumentiert die verifizierten Kombinationen für Child D (`add-iam-abac-hierarchy-cache`):

- ABAC-Regeln
- Hierarchie-Vererbung inkl. Restriktionen
- Cache-Snapshot, Recompute und Stale-Failure-Mode

## Matrix

| Fall | Schwerpunkt | Eingabe | Erwartung | Ergebnis |
| --- | --- | --- | --- | --- |
| D1 | Instanzgrenze | User Instanz A, Request Instanz B | `allowed=false`, `instance_scope_mismatch` | Grün |
| D2 | RBAC-Basis | Permission passt auf `action` + `resourceType` | `allowed=true`, `allowed_by_rbac` | Grün |
| D3 | Hierarchie-Vererbung | Parent-Permission, `organizationHierarchy` enthält Parent->Child | `allowed=true` | Grün |
| D4 | Hierarchie-Restriktion | `restrictedOrganizationIds` enthält Ziel-Org | `allowed=false`, `hierarchy_restriction` | Grün |
| D5 | ABAC Geo | `allowedGeoScopes` ohne Resource-`geoScope` | `allowed=false`, `abac_condition_unmet` | Grün |
| D6 | ABAC Pflichtattribut | `requireGeoScope=true`, aber kein Geo-Kontext | `allowed=false`, `context_attribute_missing` | Grün |
| D7 | Policy-Konflikt | `forceDeny=true` bei passender RBAC-Basis | `allowed=false`, `policy_conflict_restrictive_wins` | Grün |
| D8 | Cache-Konsistenz | Zwei gleiche `authorize`-Requests nacheinander | 2. Request aus Snapshot, gleiches Ergebnis | Grün |
| D9 | Cache-Stale-Mode | Stale Snapshot + fehlgeschlagener Recompute | `allowed=false`, `cache_stale_guard` (fail-closed) | Grün |
| D10 | Observability-Felder | Cache-/Authorize-Pfad | `workspace_id`, `component`, `environment`, `level`, `request_id`, `trace_id` vorhanden | Grün |

## Testabdeckung (Code)

- RBAC/ABAC/Hierarchie-Evaluator:
  - `packages/auth/src/iam-authorization.server.test.ts`
- Cache-Snapshot + Event-Parsing:
  - `packages/auth/src/iam-authorization.cache.test.ts`
- Handler-Flow inkl. Cache-Konsistenz:
  - `packages/auth/src/iam-authorization.handlers.test.ts`
- Integrationsnahe Denial-/Kontextfälle:
  - `packages/auth/src/iam-authorization.integration.test.ts`

## Hinweise

- Kanonischer Scope bleibt `instanceId` (ADR-011).
- Restriktivere Regel gewinnt bei Konflikten (ADR-013).
- Cache-Invalidierung erfolgt primär event-basiert (Postgres NOTIFY), Fallback über TTL/Recompute (ADR-014).
