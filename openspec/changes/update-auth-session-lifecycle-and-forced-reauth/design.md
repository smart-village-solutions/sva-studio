## Kontext

SVA Studio verwendet ein BFF-Auth-Modell mit serverseitig gehaltenen OIDC-Tokens und browserseitig reinem Session-Cookie. Auf dem Branch `feat/auth-session-recovery` war bereits `returnTo`-basierte Recovery umgesetzt, aber noch kein konsistentes Session-Lifecycle-Modell, kein per Benutzer erzwungener Re-Login und kein kontrollierter Silent-SSO-Pfad vorhanden.

## Ziele

- Eine einzige fachliche Session-Wahrheit definieren.
- Re-Login pro Benutzer deterministisch erzwingen können.
- Nach `401` genau einen stillen Reauth-Versuch erlauben, ohne Logout-Semantik zu unterlaufen.
- Das datensparsame Session-Modell (`id`, `instanceId`, `roles`) beibehalten.

## Nicht-Ziele

- Keine Token-Persistenz im Browser.
- Kein permanentes Polling oder iframe-basiertes Session-Monitoring gegen den IdP.
- Kein öffentlicher Admin-Endpunkt für Forced Reauth im ersten Schnitt.

## Entscheidungen

### 1. Führende Session-Wahrheit

`Session.expiresAt` ist die fachlich führende Gültigkeitsgrenze. Access-Token-Refresh darf diese Grenze nur innerhalb der absoluten Session-Maxdauer fortschreiben. Redis-TTL und Cookie-Laufzeit werden aus der verbleibenden Sessiondauer abgeleitet.

### 2. Versionierte Session plus Benutzerzustand

Jede Session enthält `issuedAt`, `expiresAt` und `sessionVersion`. Zusätzlich wird benutzerbezogener Reauth-Zustand außerhalb der Session geführt (`minimumSessionVersion`, `forcedReauthAt`, optional Silent-SSO-Sperre). Dadurch können bestehende Sessions deterministisch invalidiert werden, ohne Session-Payloads aufzublähen.

### 3. Forced Reauth mit zwei Modi

`forceReauthUser({ userId, mode, reason })` unterstützt:

- `app_only`: invalide Studio-Sessions, Keycloak-SSO bleibt erhalten
- `app_and_idp`: invalide Studio-Sessions und beendet aktive Keycloak-User-Sessions per Admin-API

### 4. Kontrolliertes Silent SSO

Silent SSO ist kein Hintergrund-Login, sondern ein einmaliger Recovery-Versuch nach `401`. Der Flow nutzt denselben BFF-Loginpfad mit `prompt=none`, erzeugt bei Erfolg immer eine neue Session-ID und wird nach explizitem Logout durch einen Sperrmarker unterdrückt.

## Risiken / Trade-offs

- Browser mit restriktiver Third-Party-Cookie-Politik können Silent SSO verhindern; der Flow muss dann sauber auf aktiven Login zurückfallen.
- Benutzerseitig erzwungene Reauth erhöht die Komplexität im Session-Store, vermeidet aber unpräzise TTL-basierte Workarounds.
- Ein expliziter Logout darf durch Silent SSO nicht implizit rückgängig gemacht werden; deshalb wird die Suppression bewusst serverseitig gesetzt.

## Migration / Rollout

1. Session-Felder und Reauth-Zustand in `packages/auth` ergänzen.
2. Handler, Cookie-Laufzeiten und Silent-SSO-Flow aktivieren.
3. `AuthProvider` auf einmalige Silent-Recovery nach `401` umstellen.
4. Audit-Events, Arc42, ADR und Paketdoku nachziehen.
