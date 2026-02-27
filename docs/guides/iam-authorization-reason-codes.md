# IAM Authorize Reason-Code-Katalog (Child C)

## Ziel

Diese Referenz dokumentiert die stabilen `reason`-Codes für `POST /iam/authorize` mit konkreten Allow-/Denial-Beispielen.

## Allow-Codes

| Code | Bedeutung | Typischer Trigger |
| --- | --- | --- |
| `allowed_by_rbac` | Zugriff ist durch effektive RBAC-Permissions erlaubt. | Mindestens eine Permission matcht `action` + `resource.type` im Instanzkontext. |

### Beispiel `allowed_by_rbac`

```json
{
  "allowed": true,
  "reason": "allowed_by_rbac",
  "instanceId": "11111111-1111-1111-8111-111111111111",
  "action": "content.read",
  "resourceType": "content",
  "resourceId": "article-1",
  "evaluatedAt": "2026-02-27T12:00:00.000Z"
}
```

## Denial-Codes

| Code | Bedeutung | Typischer Trigger |
| --- | --- | --- |
| `permission_missing` | Keine effektive Permission passt zum angefragten Zugriff. | Rolle/Permission für `action` und `resource.type` fehlt oder Org-Filter greift nicht. |
| `instance_scope_mismatch` | Angefragte Instanz passt nicht zum authentifizierten Benutzerkontext. | Session-Instanz und Request-`instanceId` weichen voneinander ab. |

### Beispiel `permission_missing`

```json
{
  "allowed": false,
  "reason": "permission_missing",
  "instanceId": "11111111-1111-1111-8111-111111111111",
  "action": "content.delete",
  "resourceType": "content",
  "resourceId": "article-1",
  "evaluatedAt": "2026-02-27T12:01:00.000Z"
}
```

### Beispiel `instance_scope_mismatch`

```json
{
  "allowed": false,
  "reason": "instance_scope_mismatch",
  "instanceId": "11111111-1111-1111-8111-111111111111",
  "action": "content.read",
  "resourceType": "content",
  "resourceId": "article-1",
  "evaluatedAt": "2026-02-27T12:02:00.000Z"
}
```

## Governance-Regel

- Bestehende Codes werden nicht semantisch umdefiniert.
- Neue Codes werden nur additiv eingeführt.
- Änderungen am Katalog sind breaking für Consumer und benötigen OpenSpec-Delta + Review.
