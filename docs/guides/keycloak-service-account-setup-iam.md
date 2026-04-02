# Keycloak Service-Account Setup für IAM-User- und Rollen-Management

## Ziel

Diese Anleitung beschreibt die minimale Keycloak-Konfiguration für den IAM-Service des SVA Studio (`sva-studio-iam-service`).
Sie deckt sowohl User-Management als auch den Studio-verwalteten Rollen-Katalog-Sync nach Keycloak ab.

## Unterstützte Keycloak-Version

- Mindestversion: **Keycloak 22.0**

## 1. Client anlegen

1. Im gewünschten Realm einen neuen Client mit ID `sva-studio-iam-service` erstellen.
2. Client-Typ: `Confidential`.
3. `Service Accounts Enabled` aktivieren.
4. Standard-Flow/Direct-Access nur aktivieren, wenn betrieblich zwingend notwendig.

## 2. Rollen und Rechte (Least Privilege)

Dem Service-Account ausschließlich folgende `realm-management`-Rollen zuweisen:

- `manage-users`
- `view-users`
- `view-realm`
- `manage-realm`

Begründung und Scope:

| Rolle | Erlaubte Operationen | Nicht damit begründete Operationen |
| --- | --- | --- |
| `manage-users` | User anlegen, aktualisieren, deaktivieren; Rollenzuweisungen an User schreiben | Realm-Rollenkatalog ändern |
| `view-users` | User lesen, Detailansichten laden | Schreibzugriffe auf User oder Rollen |
| `view-realm` | Realm-Metadaten und Rollenbestand lesen | Änderungen an Rollen, Clients oder Flows |
| `manage-realm` | Studio-verwaltete Realm-Rollen anlegen, aktualisieren und löschen | Clients, Identity Provider oder Auth-Flows verwalten |

Explizit verboten:

- `realm-admin`
- `manage-clients`
- `view-clients`
- `manage-identity-providers`
- `manage-events`
- zusätzliche globale Admin-Rollen außerhalb von `realm-management`

## 3. Secret-Handling

- Das Client-Secret wird ausschließlich über einen Secrets-Manager bereitgestellt (z. B. Vault, Kubernetes Secret, Cloud Secret Manager).
- Das Secret darf nicht in `.env`-Dateien oder im Repository gespeichert werden.
- Für lokale Entwicklung kann ein temporäres Secret in `.env.local` gesetzt werden, diese Datei bleibt unversioniert.

## 4. Umgebungsvariablen

Folgende Variablen werden für den IAM-Admin-Client benötigt:

```env
KEYCLOAK_ADMIN_BASE_URL=https://keycloak.example.com
KEYCLOAK_ADMIN_REALM=sva-studio
KEYCLOAK_ADMIN_CLIENT_ID=sva-studio-iam-service
KEYCLOAK_ADMIN_CLIENT_SECRET=<injected-via-secrets-manager>
```

Wichtig:

- `KEYCLOAK_ADMIN_REALM` bezeichnet nur den Realm, in dem der technische Service-Account sein Access-Token holt.
- Der fachliche Ziel-Realm für User-, Rollen- und Provisioning-Operationen wird pro Instanz aus `iam.instances.authRealm` aufgelöst.
- Neue produktive Instanzen benötigen deshalb in der Registry mindestens `authRealm` und `authClientId`.

Für den geplanten Reconcile-Lauf zusätzlich:

```env
IAM_ROLE_RECONCILE_INTERVAL_MS=900000
IAM_ROLE_RECONCILE_INSTANCE_IDS=<uuid-1>,<uuid-2>
```

## 5. Token-Lebensdauer

Für den Service-Account die Access-Token-Lebensdauer auf 5 Minuten setzen.

Empfehlung:

- Realm Settings -> Tokens -> Access Token Lifespan auf `5 Minutes`.
- Falls ein dedizierter Client-Token-Override genutzt wird, dort ebenfalls `5 Minutes` setzen.

## 6. Secret-Rotation (90 Tage, Dual-Secret)

Die Rotation erfolgt spätestens alle 90 Tage (BSI-Grundschutz ORP.4) im Dual-Secret-Verfahren:

1. Neues Secret erzeugen (`secret_v2`) und im Secrets-Manager als neue aktive Version hinterlegen.
2. Deployment mit `secret_v2` ausrollen, `secret_v1` bleibt im Overlap-Fenster gültig.
3. Funktionstest der IAM-Admin-Calls (`list users`, `create user`, `create role`, `reconcile roles`) durchführen.
4. Nach erfolgreicher Stabilitätsphase (`24h` empfohlen) `secret_v1` in Keycloak deaktivieren/löschen.
5. Rotation mit Zeitstempel und Verantwortlichem im Betriebsprotokoll dokumentieren.

## 7. Operative Checks nach Setup/Rotation

- IAM-Health-Check (`/health/ready`) meldet Keycloak als `healthy`.
- `POST /api/v1/iam/roles`, `PATCH /api/v1/iam/roles/:id` und `DELETE /api/v1/iam/roles/:id` liefern keinen `keycloak_unavailable`-Fehler.
- `POST /api/v1/iam/admin/reconcile` erzeugt keinen Berechtigungsfehler im Keycloak-Adapter.
- Keine `401`/`403`-Fehler bei Keycloak-Admin-Aufrufen.
- Keine Secrets oder Tokens in Logs; Audit-Events enthalten nur `workspace_id`, `operation`, `result`, `error_code?`, `request_id`, `trace_id?`, `span_id?`.
