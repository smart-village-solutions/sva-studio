# Lokaler Dev-Auth-Modus

Dieser Modus dient ausschließlich der lokalen Plugin- und UI-Entwicklung, wenn kein echter Keycloak-Login benötigt wird.

## Zweck

- schneller lokaler Einstieg ohne wiederholten OIDC-Login
- nutzbare Studio- und Plugin-Oberflächen für Fachentwicklung
- bewusst grobe Rechteabbildung für typische Admin-Flows wie Waste Management

Der Modus ist **kein** Ersatz für echte IAM-, Session- oder Realm-Tests.

## Aktivierung

Serverseitig:

```bash
SVA_DEV_AUTH=true
```

Browserseitig:

```bash
VITE_SVA_DEV_AUTH=true
```

Legacy-kompatibel werden auch weiterhin akzeptiert:

```bash
SVA_MOCK_AUTH=true
VITE_MOCK_AUTH=true
```

Empfohlen ist für neue lokale Setups ausschließlich `SVA_DEV_AUTH` plus `VITE_SVA_DEV_AUTH`.

## Verhalten

- Der Browser bleibt zunächst unauthentifiziert.
- Die Shell zeigt einen expliziten Button `Als Dev-User anmelden`.
- `POST /auth/dev-login` aktiviert lokal eine Dev-Auth-Session über ein Cookie.
- `/auth/me` liefert danach einen synthetischen Benutzerkontext.
- `POST /auth/dev-logout` entfernt die lokale Dev-Auth-Session wieder.
- Solange der Modus aktiv ist, kennzeichnet die Shell den Zustand sichtbar als `Dev-Auth aktiv`.

## Standardkontext

Ohne zusätzliche Overrides wird folgender Benutzer simuliert:

- `id`: `dev:local-admin`
- `instanceId`: `de-musterhausen`
- Rollen: breites Admin-/Editor-Set für lokale Entwicklung
- Module: inklusive `waste-management`

## Grenzen

- nur lokal und nur bei explizitem Opt-in
- kein echter Keycloak- oder Callback-Flow
- keine Aussagekraft für Forced-Reauth, Silent-SSO, Realm-Auflösung oder feingranulare Permissions
- Staging-, Demo- und Shared-Dev-Umgebungen verwenden weiterhin den regulären Login-Pfad
