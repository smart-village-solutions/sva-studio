# Keycloak Service-Account Setup für IAM-User-Management

## Ziel

Diese Anleitung beschreibt die minimale Keycloak-Konfiguration für den IAM-Service des SVA Studio (`sva-studio-iam-service`).

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

Keine zusätzlichen Admin-Rollen vergeben.

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

## 5. Token-Lebensdauer

Für den Service-Account die Access-Token-Lebensdauer auf 5 Minuten setzen.

Empfehlung:

- Realm Settings -> Tokens -> Access Token Lifespan auf `5 Minutes`.
- Falls ein dedizierter Client-Token-Override genutzt wird, dort ebenfalls `5 Minutes` setzen.

## 6. Secret-Rotation (90 Tage, Dual-Secret)

Die Rotation erfolgt spätestens alle 90 Tage (BSI-Grundschutz ORP.4) im Dual-Secret-Verfahren:

1. Neues Secret erzeugen (`secret_v2`) und im Secrets-Manager als neue aktive Version hinterlegen.
2. Deployment mit `secret_v2` ausrollen, `secret_v1` bleibt im Overlap-Fenster gültig.
3. Funktionstest der IAM-Admin-Calls (`list users`, `create user`) durchführen.
4. Nach erfolgreicher Stabilitätsphase (`24h` empfohlen) `secret_v1` in Keycloak deaktivieren/löschen.
5. Rotation mit Zeitstempel und Verantwortlichem im Betriebsprotokoll dokumentieren.

## 7. Operative Checks nach Setup/Rotation

- IAM-Health-Check (`/health/ready`) meldet Keycloak als `healthy`.
- Keine `401`/`403`-Fehler bei Keycloak-Admin-Aufrufen.
- Keine Secrets oder Tokens in Logs.
