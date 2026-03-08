# IAM Authorization Testmatrix (Instanz/Organisation) – 2026-02-27

## Ziel

Diese Matrix dokumentiert die verifizierten Kombinationen für `GET /iam/me/permissions` und `POST /iam/authorize` in Child C.

## Matrix

| Fall | Endpoint | User-Instanz | Request-Instanz | User-Org/Context | Erwartung | Ergebnis |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | `GET /iam/me/permissions` | A | A | ohne Org-Filter | `200`, effektive Permissions im Instanzkontext | Grün |
| M2 | `GET /iam/me/permissions` | A | B | ohne Org-Filter | `403`, `instance_scope_mismatch` | Grün |
| M3 | `GET /iam/me/permissions` | A | A | ungültige `organizationId` | `400`, `invalid_organization_id` | Grün |
| A1 | `POST /iam/authorize` | A | A | Org passt und Permission vorhanden | `200`, `allowed=true`, `allowed_by_rbac` | Grün |
| A2 | `POST /iam/authorize` | A | A | Org passt nicht / keine Permission | `200`, `allowed=false`, `permission_missing` | Grün |
| A3 | `POST /iam/authorize` | A | B | beliebig | `200`, `allowed=false`, `instance_scope_mismatch` | Grün |
| A4 | `POST /iam/authorize` | A | ungültige UUID | beliebig | `400`, `invalid_instance_id` | Grün |
| A5 | `POST /iam/authorize` | A | A | DB nicht verfügbar | `503`, `database_unavailable` | Grün |

## Testabdeckung (Code)

- Handler-Unit-Tests:
  - `packages/auth/src/iam-authorization.handlers.test.ts`
- Integrationsnahe Denial-/Kontexttests:
  - `packages/auth/src/iam-authorization.integration.test.ts`

## Hinweise

- Der Primär-Scope ist immer `instanceId` (ADR-011).
- Organisationskontext ist ein Sub-Scope innerhalb der Instanz.
