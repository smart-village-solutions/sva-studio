# IAM Authorize Reason-Code-Katalog (Child C + D)

## Ziel

Diese Referenz dokumentiert die stabilen `reason`-Codes für `POST /iam/authorize` inkl. RBAC-Basis (Child C) und ABAC-/Hierarchie-/Cache-Erweiterung (Child D).

## Allow-Codes

| Code | Bedeutung | Typischer Trigger |
| --- | --- | --- |
| `allowed_by_rbac` | Zugriff ist durch effektive RBAC-Permissions erlaubt. | Mindestens eine Permission matcht `action` + `resource.type` im Instanzkontext. |
| `allowed_by_abac` | Zugriff ist erlaubt und zusätzliche ABAC-Regeln wurden erfolgreich ausgewertet. | RBAC-Basis passt, ABAC-Bedingungen sind erfüllt (z. B. Geo-/Zeitfenster). |

## Denial-Codes

| Code | Bedeutung | Typischer Trigger |
| --- | --- | --- |
| `permission_missing` | Keine effektive Permission passt zum angefragten Zugriff. | Rolle/Permission für `action` und `resource.type` fehlt oder Org-Filter greift nicht. |
| `instance_scope_mismatch` | Angefragte Instanz passt nicht zum authentifizierten Benutzerkontext. | Session-Instanz und Request-`instanceId` weichen voneinander ab. |
| `context_attribute_missing` | Pflichtattribute für die Entscheidung fehlen. | ABAC-Regel verlangt Kontextdaten (z. B. Acting-As oder Geo), die nicht geliefert wurden. |
| `abac_condition_unmet` | ABAC-Bedingungen sind nicht erfüllt. | Geo-Scope oder Zeitfenster verletzt. |
| `hierarchy_restriction` | Hierarchieregel blockiert den Zugriff. | Untergeordnete Restriktionen heben geerbte Berechtigungen auf. |
| `policy_conflict_restrictive_wins` | Konflikt zwischen Regeln wurde restriktiv aufgelöst. | Erlaubnis und Verbot treffen gleichzeitig zu; Deny gewinnt deterministisch. |

## Beispiele

### Beispiel `allowed_by_abac`

```json
{
  "allowed": true,
  "reason": "allowed_by_abac",
  "instanceId": "de-musterhausen",
  "action": "content.read",
  "resourceType": "content",
  "resourceId": "article-1",
  "evaluatedAt": "2026-02-28T11:00:00.000Z"
}
```

### Beispiel `hierarchy_restriction`

```json
{
  "allowed": false,
  "reason": "hierarchy_restriction",
  "instanceId": "de-musterhausen",
  "action": "content.read",
  "resourceType": "content",
  "resourceId": "article-1",
  "evaluatedAt": "2026-02-28T11:01:00.000Z"
}
```

### Beispiel technischer Fehlerpfad (`database_unavailable`)

```json
{
  "error": "database_unavailable"
}
```

## Governance-Regel

- Bestehende Codes werden nicht semantisch umdefiniert.
- Neue Codes werden nur additiv eingeführt.
- Technische Fehler im Fail-Closed-Pfad sind API-Fehler (`error`) und keine `reason`-Codes.
- Änderungen am Katalog sind breaking für Consumer und benötigen OpenSpec-Delta + Review.
