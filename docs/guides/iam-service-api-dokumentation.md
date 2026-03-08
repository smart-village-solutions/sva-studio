# IAM-Service API-Dokumentation (v1)

## Ziel

Diese Anleitung beschreibt die im Change `add-account-user-management-ui` genutzten IAM-v1-Endpunkte, Response-Envelopes und Fehlercodes.

## Basis

- Prefix: `/api/v1/iam`
- Authentifizierung: Session-Cookie
- Mutierende Requests (`POST`, `PATCH`, `DELETE`) benötigen Header:
  - `X-Requested-With: XMLHttpRequest`
- Idempotente Create-/Bulk-Endpunkte benötigen zusätzlich:
  - `Idempotency-Key`

## Response-Format

### Item-Envelope

```json
{
  "data": {},
  "requestId": "optional-request-id"
}
```

### List-Envelope

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 123
  },
  "requestId": "optional-request-id"
}
```

### Error-Envelope

```json
{
  "error": {
    "code": "forbidden",
    "message": "missing_admin_role",
    "details": {}
  },
  "requestId": "optional-request-id"
}
```

## Endpunkte

### Users

- `GET /api/v1/iam/users`
  - Query: `page`, `pageSize`, `status`, `role`, `search`
- `GET /api/v1/iam/users/{userId}`
- `POST /api/v1/iam/users`
- `PATCH /api/v1/iam/users/{userId}`
- `DELETE /api/v1/iam/users/{userId}`
- `POST /api/v1/iam/users/bulk-deactivate`
- `GET /api/v1/iam/users/me/profile`
- `PATCH /api/v1/iam/users/me/profile`

### Roles

- `GET /api/v1/iam/roles`
- `POST /api/v1/iam/roles`
- `PATCH /api/v1/iam/roles/{roleId}`
- `DELETE /api/v1/iam/roles/{roleId}`

### Admin

- `POST /api/v1/iam/admin/reconcile` (Platzhalter, `501`)

### Health

- `GET /health/live`
- `GET /health/ready`

## Relevante Error-Codes

- `unauthorized`
- `forbidden`
- `not_found`
- `invalid_request`
- `rate_limited`
- `csrf_validation_failed`
- `idempotency_key_required`
- `idempotency_key_reuse`
- `idempotency_in_progress`
- `invalid_instance_id`
- `keycloak_unavailable`
- `database_unavailable`
- `last_admin_protection`
- `self_protection`
- `feature_disabled`
- `conflict`
- `internal_error`

## Referenzen

- `docs/api/iam-v1.yaml`
- `packages/core/src/iam/account-management-contract.ts`
- `packages/auth/src/iam-account-management.server.ts`
