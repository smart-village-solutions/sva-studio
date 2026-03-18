# IAM Authorization API Contract (Child C + D)

## Ziel

Diese Spezifikation definiert den stabilen API-Vertrag für:

- `GET /iam/me/permissions`
- `POST /iam/authorize`
- `GET /iam/governance/workflows`
- `GET /iam/me/data-subject-rights/requests`
- `GET /iam/admin/data-subject-rights/cases`
- `GET /api/v1/iam/users/:userId/timeline`
- `GET /api/v1/iam/legal-texts`
- `POST /api/v1/iam/legal-texts`
- `PATCH /api/v1/iam/legal-texts/:legalTextVersionId`

Die Contract-Typen liegen in `@sva/core` unter `packages/core/src/iam/authorization-contract.ts`
sowie für die Rechtstext-Verwaltung unter
`packages/core/src/iam/account-management-contract.ts`.

## Endpunkt: GET `/iam/me/permissions`

Liefert die effektiven Berechtigungen für den aktuell authentifizierten Benutzer im aktiven Instanzkontext.

### Query-Parameter

- `instanceId` (optional, String): Überschreibt den Session-Kontext nur, wenn identisch zur User-Instanz
- `organizationId` (optional, UUID): Filtert Berechtigungen auf Organisationskontext
- `actingAsUserId` (optional, String): Effektives Ziel-Subjekt für Admin-Analyse, nur mit aktiver Impersonation-Session

### Erfolgsantwort (`200`)

```json
{
  "instanceId": "de-musterhausen",
  "organizationId": "22222222-2222-2222-8222-222222222222",
  "permissions": [
    {
      "action": "content.read",
      "resourceType": "content",
      "resourceId": "article-1",
      "organizationId": "22222222-2222-2222-8222-222222222222",
      "effect": "allow",
      "scope": {
        "geoScope": "de-bw"
      },
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

### Zusätzliche Zusagen für Transparenz-UI

- `resourceId`, `effect`, `scope`, `sourceRoleIds` und `subject` sind Teil des stabilen Read-Modells für das Rights-Tab in `/admin/iam`.
- Diagnosefelder bleiben allowlist-basiert. Die UI zeigt keine Roh-Policy-Dumps, Secrets oder Ciphertexte an.
- `instanceId` bleibt der fachliche String-Scope. Ein technisches UUID-Format ist für Clients nicht vorausgesetzt.

### Fehlerantwort (`4xx/5xx`)

```json
{
  "error": "invalid_instance_id",
  "message": "Öffentliche Diagnoseinformation",
  "requestId": "req-123"
}
```

Zusätzlich setzt der Server best effort den Header `X-Request-Id`, damit Browser-, Proxy- und Server-Sicht korreliert werden können.

## Endpunkt: POST `/iam/authorize`

Führt eine deterministische Autorisierungsentscheidung für `action` + `resource` durch.

### Request-Body

```json
{
  "instanceId": "de-musterhausen",
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
      "instanceId": "de-musterhausen",
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
  "instanceId": "de-musterhausen",
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
  "error": "invalid_request",
  "message": "Öffentliche Diagnoseinformation",
  "requestId": "req-123"
}
```

Der Fehlervertrag bleibt additiv: `error` ist und bleibt der maschinenlesbare String-Code; `message` ist optional und nicht für Client-Logik gedacht.

## Endpunkt: GET `/iam/governance/workflows`

Liefert den normalisierten Governance-Feed für das Governance-Tab in `/admin/iam`.

### Query-Parameter

- `page` (optional, Number, Default `1`)
- `pageSize` (optional, Number, Default `20`)
- `type` (optional, Enum): `permission_change|delegation|impersonation|legal_acceptance`
- `status` (optional, String)
- `search` (optional, String)

### Erfolgsantwort (`200`)

```json
{
  "data": [
    {
      "id": "workflow-1",
      "type": "delegation",
      "status": "approved",
      "title": "Delegation für Redaktion",
      "summary": "Temporäre Delegation für Alice Admin",
      "actorAccountId": "aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa",
      "actorDisplayName": "Alice Admin",
      "targetAccountId": "bbbbbbbb-bbbb-bbbb-8bbb-bbbbbbbbbbbb",
      "targetDisplayName": "Bob Editor",
      "createdAt": "2026-03-16T10:00:00.000Z",
      "metadata": {}
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

## Endpunkt: GET `/iam/me/data-subject-rights/requests`

Liefert das Self-Service-Read-Modell für `/account/privacy`.

### Erfolgsantwort (`200`)

```json
{
  "data": {
    "instanceId": "de-musterhausen",
    "accountId": "aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa",
    "processingRestrictedAt": "2026-03-16T10:00:00.000Z",
    "processingRestrictionReason": "legal_hold",
    "nonEssentialProcessingOptOutAt": "2026-03-15T09:00:00.000Z",
    "nonEssentialProcessingAllowed": false,
    "legalHolds": [],
    "requests": [],
    "exportJobs": []
  }
}
```

### Kanonische DSR-Statuswerte

- `accepted -> queued`
- `processing -> in_progress`
- `blocked_legal_hold -> blocked`
- `completed -> completed`
- `failed -> failed`
- `escalated -> in_progress`

## Endpunkt: GET `/iam/admin/data-subject-rights/cases`

Liefert den normalisierten Admin-Feed für das DSR-Tab in `/admin/iam`.

### Query-Parameter

- `page` (optional, Number, Default `1`)
- `pageSize` (optional, Number, Default `20`)
- `type` (optional, Enum): `request|export_job|legal_hold|profile_correction|recipient_notification`
- `status` (optional, Enum): `queued|in_progress|completed|blocked|failed`
- `search` (optional, String)

## Endpunkte: Rechtstext-Verwaltung

Die Admin-Oberfläche `/admin/legal-texts` nutzt eigene Read-/Write-Endpunkte
für technische Rechtstext-Versionen. Persistiert werden aktuell:
`legalTextId`, `legalTextVersion`, `locale`, `contentHash`, `isActive`,
`publishedAt` sowie aggregierte Akzeptanzzähler.

### GET `/api/v1/iam/legal-texts`

Liefert alle verwalteten Rechtstext-Versionen der aktuellen Instanz.

#### Erfolgsantwort (`200`)

```json
{
  "data": [
    {
      "id": "11111111-1111-1111-8111-111111111111",
      "legalTextId": "privacy_policy",
      "legalTextVersion": "2026-03",
      "locale": "de-DE",
      "contentHash": "sha256:abc123",
      "isActive": true,
      "publishedAt": "2026-03-16T09:00:00.000Z",
      "createdAt": "2026-03-16T08:55:00.000Z",
      "acceptanceCount": 4,
      "activeAcceptanceCount": 3,
      "lastAcceptedAt": "2026-03-16T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 1,
    "total": 1
  }
}
```

### POST `/api/v1/iam/legal-texts`

Legt eine neue Rechtstext-Version für die aktuelle Instanz an.

#### Request-Body

```json
{
  "legalTextId": "terms_of_use",
  "legalTextVersion": "2026-04",
  "locale": "en-GB",
  "contentHash": "sha256:def456",
  "isActive": false,
  "publishedAt": "2026-04-01T12:00:00.000Z"
}
```

#### Zusagen

- `Idempotency-Key` ist für `POST` verpflichtend.
- Doppelte Kombinationen aus `legalTextId + legalTextVersion + locale` führen zu `409 conflict`.
- Der eigentliche Textkörper ist bewusst nicht Teil dieses Vertrags.

### PATCH `/api/v1/iam/legal-texts/:legalTextVersionId`

Aktualisiert `contentHash`, `isActive` und/oder `publishedAt` einer bestehenden
Rechtstext-Version.

## Endpunkt: GET `/api/v1/iam/users/:userId/timeline`

Liefert die vereinte Actor+Target-Historie für `/admin/users/:userId`.

### Erfolgsantwort (`200`)

```json
{
  "data": [
    {
      "id": "governance:workflow-1",
      "category": "governance",
      "eventType": "delegation",
      "title": "Delegation für Redaktion",
      "description": "Temporäre Delegation für Alice Admin",
      "occurredAt": "2026-03-16T10:00:00.000Z",
      "perspective": "actor_and_target",
      "relatedEntityId": "workflow-1",
      "metadata": {
        "status": "approved"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 100,
    "total": 1
  }
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
- `instanceId` bleibt Primär-Scope gemäß ADR-011 und wird als fachlicher String-Schlüssel geführt.

## Architekturreferenzen

- `docs/adr/ADR-011-instanceid-kanonischer-mandanten-scope.md`
- `docs/adr/ADR-013-rbac-abac-hybridmodell.md`
- `docs/adr/ADR-014-postgres-notify-cache-invalidierung.md`

## Ergänzende Artefakte

- Reason-Code-Katalog: `docs/guides/iam-authorization-reason-codes.md`
- OpenAPI 3.0: `docs/guides/iam-authorization-openapi-3.0.yaml`
- Testmatrix: `docs/reports/iam-authorization-testmatrix-2026-02-28.md`
