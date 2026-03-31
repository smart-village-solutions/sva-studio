## 1. Implementierung

- [x] 1.1 Session-Erzeugung und Refresh auf `expiresAt` als führende Session-Grenze umstellen.
- [x] 1.2 Cookie-Laufzeit und Redis-TTL an die verbleibende Sessiondauer koppeln.
- [x] 1.3 Session-Versionierung und benutzerbezogenen Forced-Reauth-Zustand ergänzen.
- [x] 1.4 Interne Forced-Reauth-Fassade mit `app_only` und `app_and_idp` implementieren.
- [x] 1.5 Silent-SSO-Login, iframe-sicheren Callback und Logout-Suppression ergänzen.
- [x] 1.6 `AuthProvider` auf einmalige Silent-Recovery nach `401` erweitern.
- [x] 1.7 Unit-Tests und Typechecks für Auth- und React-Pfade aktualisieren.

## 2. Spezifikation und Doku

- [x] 2.1 OpenSpec-Deltas für `iam-core`, `routing` und `iam-auditing` ergänzen.
- [x] 2.2 Arc42-Abschnitte `04`, `06`, `08`, `09` auf das neue Session-Modell aktualisieren.
- [x] 2.3 Neue ADR für Session-Lifecycle, Forced Reauth und Silent SSO anlegen.
- [x] 2.4 Paketdokumentation von `@sva/auth` auf Session-Lifecycle und Silent SSO synchronisieren.
