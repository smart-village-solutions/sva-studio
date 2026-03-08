# IAM Authorization API Contract (Child C + D)

## Ziel

Diese Spezifikation definiert den stabilen API-Vertrag für:

- `GET /iam/me/permissions`
- `POST /iam/authorize`

Die Contract-Typen liegen in `@sva/core` unter `packages/core/src/iam/authorization-contract.ts`.

## Endpunkt: GET `/iam/me/permissions`

Liefert die effektiven Berechtigungen für den aktuell authentifizierten Benutzer im aktiven Instanzkontext.

### Query-Parameter

- `instanceId` (optional, UUID): Überschreibt den Session-Kontext nur, wenn identisch zur User-Instanz
- `organizationId` (optional, UUID): Filtert Berechtigungen auf Organisationskontext
- `actingAsUserId` (optional, String): Effektives Ziel-Subjekt für Admin-Analyse, nur mit aktiver Impersonation-Session

### Erfolgsantwort (`200`)

```json
{
  "instanceId": "11111111-1111-1111-8111-111111111111",
  "organizationId": "22222222-2222-2222-8222-222222222222",
  "permissions": [
    {
      "action": "content.read",
      "resourceType": "content",
      "organizationId": "22222222-2222-2222-8222-222222222222",
      "sourceRoleIds": ["aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa"]
    }
  ],
  "subject": {
    "actorUserId": "keycloak:user-admin",
    "effectiveUserId": "keycloak:user-target",
    "isImpersonating": true
  },
  "evaluatedAt": "2026-02-28T11:00:00.000Z",
  "requestId": "req-123",
  "traceId": "trace-abc"
}
```

### Fehlerantwort (`4xx/5xx`)

```json
{
  "error": "invalid_instance_id"
}
```

## Endpunkt: POST `/iam/authorize`

Führt eine deterministische Autorisierungsentscheidung für `action` + `resource` durch.

### Request-Body

```json
{
  "instanceId": "11111111-1111-1111-8111-111111111111",
  "action": "content.read",
  "resource": {
    "type": "content",
    "id": "article-1",
    "organizationId": "22222222-2222-2222-8222-222222222222",
    "attributes": {
      "geoScope": "de-bw"
    }
  },
  "context": {
    "organizationId": "22222222-2222-2222-8222-222222222222",
    "requestId": "req-123",
    "traceId": "trace-abc",
    "attributes": {
      "instanceId": "11111111-1111-1111-8111-111111111111",
      "organizationHierarchy": [
        "11111111-1111-1111-8111-111111111111",
        "22222222-2222-2222-8222-222222222222"
      ],
      "allowedGeoScopes": ["de-bw"],
      "timeWindow": {
        "start": "07:00",
        "end": "19:00"
      }
    }
  }
}
```

### Erfolgsantwort (`200`)

```json
{
  "allowed": true,
  "reason": "allowed_by_abac",
  "instanceId": "11111111-1111-1111-8111-111111111111",
  "action": "content.read",
  "resourceType": "content",
  "resourceId": "article-1",
  "evaluatedAt": "2026-02-28T11:00:00.000Z",
  "requestId": "req-123",
  "traceId": "trace-abc"
}
```

### Fehlerantwort (`4xx/5xx`)

```json
{
  "error": "invalid_request"
}
```

## Reason-Codes (Authorize)

- `allowed_by_rbac`
- `allowed_by_abac`
- `permission_missing`
- `instance_scope_mismatch`
- `context_attribute_missing`
- `abac_condition_unmet`
- `hierarchy_restriction`
- `policy_conflict_restrictive_wins`
- `cache_stale_guard`

## Error-Codes (API)

- `unauthorized`
- `invalid_request`
- `invalid_instance_id`
- `invalid_organization_id`
- `instance_scope_mismatch`
- `impersonation_not_active`
- `impersonation_expired`
- `database_unavailable`

## Stabilitätszusage für SDK-Nutzung

- Contract-Änderungen an Feldern, Semantik oder Codes sind breaking und benötigen OpenSpec-Delta + Review.
- Reason-Codes werden nur additiv erweitert; bestehende Codes werden nicht semantisch umdefiniert.
- `instanceId` bleibt Primär-Scope gemäß ADR-011.

## Architekturreferenzen

- `docs/adr/ADR-011-instanceid-kanonischer-mandanten-scope.md`
- `docs/adr/ADR-013-rbac-abac-hybridmodell.md`
- `docs/adr/ADR-014-postgres-notify-cache-invalidierung.md`

## Ergänzende Artefakte

- Reason-Code-Katalog: `docs/guides/iam-authorization-reason-codes.md`
- OpenAPI 3.0: `docs/guides/iam-authorization-openapi-3.0.yaml`
- Testmatrix: `docs/reports/iam-authorization-testmatrix-2026-02-28.md`
