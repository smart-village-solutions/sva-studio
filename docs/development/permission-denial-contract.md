# Vertrag für fehlende Berechtigungen

Studio-Guards und serverseitige Autorisierungsgrenzen können einen sicheren, additiven Kontext zu einem `403 forbidden` liefern:

```json
{
  "required_permissions": ["iam.user.write"],
  "requirement_mode": "allOf",
  "denial_reason": "permission_missing"
}
```

`required_permissions` enthält höchstens 16 vollständig qualifizierte Action-IDs. `allOf` benennt die tatsächlich fehlenden Rechte, `anyOf` die zulässigen Alternativen. Der Browser validiert den Kontext erneut, dedupliziert ihn und verwirft unbekannte Modi oder Gründe.

Eine Action darf nur genannt werden, wenn der Guard oder die serverseitige Autorisierungsentscheidung sie eindeutig belegt. Rollenfehler, fehlender Instanzkontext, technische Ausfälle, Principal-Konflikte und alte Antworten ohne diesen Vertrag bleiben generisch. Rollen, Gruppen, Grants und interne Policy-Details werden nicht veröffentlicht.

## Beschriftungen

Core- und Host-Permissions besitzen deutsche und englische Titel im Studio. Plugin-Permissions verwenden den `titleKey` ihrer Build-time-Registry. Die sichtbare Meldung enthält den Titel und zusätzlich die stabile Action-ID, zum Beispiel `Benutzer bearbeiten (iam.user.write)`. Für unbekannte, aber syntaktisch gültige Actions bleibt die Action-ID der sichere Fallback.

Neue autorisierbare Actions müssen fully-qualified sein, im Permission-Katalog beziehungsweise in der Plugin-Registry registriert werden und einen übersetzten Titel erhalten. API-Clients müssen `details` unverändert bis zum gemeinsamen Formatter transportieren.
