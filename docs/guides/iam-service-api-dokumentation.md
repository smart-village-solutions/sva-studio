# IAM-Service API-Dokumentation (v1)

## Ziel

Diese Anleitung beschreibt die aktuell stabilen IAM-v1-Endpunkte, Response-Envelopes und Fehlercodes für Benutzer-, Rollen-, Gruppen- und Organisationsverwaltung.

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
  - Tenant-Scope lädt die Benutzer führend aus dem Tenant-Realm in Keycloak. Fehlende Studio-Read-Model-Zuordnungen bleiben sichtbar und werden nicht herausgefiltert.
  - Listeneinträge können additiv `mappingStatus`, `editability` und `diagnostics[]` enthalten.
- `GET /api/v1/iam/users/{userId}`
  - enthält additiv `groups[]` mit `groupId`, `groupKey`, `displayName`, `groupType`, `origin`, `validFrom`, `validTo`
- `POST /api/v1/iam/users`
- `PATCH /api/v1/iam/users/{userId}`
  - akzeptiert additiv `groupIds: string[]`
- `DELETE /api/v1/iam/users/{userId}`
- `POST /api/v1/iam/users/bulk-deactivate`
- `GET /api/v1/iam/users/me/profile`
- `PATCH /api/v1/iam/users/me/profile`

### Roles

- `GET /api/v1/iam/roles`
  - Rollenlisten verwenden Keycloak-Pagination und Keycloak-Count, wenn der aktive Scope das unterstützt.
  - Keycloak-Built-in-Rollen bleiben sichtbar, werden aber als Rollenobjekte read-only markiert.
  - Listeneinträge können additiv `editability` und `diagnostics[]` enthalten.
- `POST /api/v1/iam/roles`
- `PATCH /api/v1/iam/roles/{roleId}`
- `DELETE /api/v1/iam/roles/{roleId}`

### Groups

- `GET /api/v1/iam/groups`
- `POST /api/v1/iam/groups`
  - benötigt `Idempotency-Key`
- `GET /api/v1/iam/groups/{groupId}`
- `PATCH /api/v1/iam/groups/{groupId}`
- `DELETE /api/v1/iam/groups/{groupId}`

### Legal texts

- `GET /api/v1/iam/legal-texts`
- `POST /api/v1/iam/legal-texts`
- `PATCH /api/v1/iam/legal-texts/{legalTextVersionId}`

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
- `tenant_admin_client_not_configured`
- `internal_error`

## Keycloak-first Admin-Vertrag

- Keycloak ist für Benutzer, Realm-Rollen und Rollenzuordnungen die führende Quelle. Studio mutiert zuerst Keycloak und synchronisiert danach die Studio-Read-Models.
- Root-/Platform-Scope nutzt ausschließlich den Platform-Admin-Keycloak-Client. Tenant-Scope nutzt ausschließlich den Tenant-Admin-Keycloak-Client der Instanz; ein Fallback auf Platform- oder globale Admin-Credentials ist nicht zulässig.
- `user === null` im Frontend ist ein Loading-/Unknown-Zustand und darf keinen Platform-Scope auslösen.
- `mappingStatus` hat die stabilen Werte `mapped`, `unmapped` und `manual_review`.
- `editability` hat die stabilen Werte `editable`, `read_only` und `blocked`.
- Objektbezogene Diagnosen werden als stabile Codes übertragen, zum Beispiel `missing_instance_attribute`, `mapping_missing`, `forbidden_role_mapping`, `read_only_federated_field` und `idp_forbidden`.
- Sync- und Reconcile-Reports verwenden die Abschlusszustände `success`, `partial_failure`, `blocked` und `failed` und dürfen betroffene Objektlisten sowie Zähler additiv enthalten.
- Keycloak-Fehler werden differenziert gemappt; insbesondere `403` aus Keycloak wird als IdP-Berechtigungsproblem (`IDP_FORBIDDEN` beziehungsweise API-Diagnose `idp_forbidden`) sichtbar.

## Wichtige Vertragszusagen für Gruppen

- Gruppen sind instanzgebundene Rollenbündel mit `groupType = role_bundle`.
- `GET /api/v1/iam/groups` liefert je Eintrag `memberCount` und gebündelte Rollen (`roles[]` mit `roleId`, `roleKey`, `roleName`).
- `GET /api/v1/iam/groups/{groupId}` liefert additiv `members[]` mit Herkunft und Gültigkeitsfenstern.
- `DELETE /api/v1/iam/groups/{groupId}` deaktiviert die Gruppe (`isActive = false`) statt einen Hard-Delete zu garantieren.
- `PATCH /api/v1/iam/users/{userId}` ersetzt die aktiven Gruppenmitgliedschaften deterministisch anhand von `groupIds`; unbekannte oder instanzfremde Gruppen führen zu `invalid_request`.

## Referenzen

- `docs/api/iam-v1.yaml`
- `packages/core/src/iam/account-management-contract.ts`
- `packages/auth-runtime/src/iam-account-management/platform-handlers.ts`
- `packages/iam-admin/src/group-mutation-handlers.ts`
