# Change: Lokalen Dev-Auth-Bypass für Studio- und Plugin-Entwicklung ergänzen

## Why

Die lokale Entwicklung des Studios und insbesondere fachlicher Plugins wie Waste Management hängt heute oft an wiederholten OIDC-Logins oder an impliziten Mock-Auth-Abkürzungen ohne klaren UI- und Laufzeitvertrag. Das bremst UI- und Integrationsarbeit, vermischt Testhacks mit Produktpfaden und macht den Unterschied zwischen echtem Login und lokaler Abkürzung für Entwickler nicht deutlich genug.

## What Changes

- Führt einen expliziten lokalen Dev-Auth-Modus mit den Env-Flags `SVA_DEV_AUTH` und `VITE_SVA_DEV_AUTH` ein
- Behält `SVA_MOCK_AUTH` und `VITE_MOCK_AUTH` zunächst als Legacy-Aliase bei
- Ergänzt die Auth-Endpunkte `POST /auth/dev-login` und `POST /auth/dev-logout`
- Verwendet `/auth/me` weiterhin als führenden Browservertrag, liefert den Dev-Benutzer aber nur nach expliziter lokaler Aktivierung über einen Dev-Auth-Cookie
- Ergänzt in der Shell eine sichtbare lokale Aktion `Als Dev-User anmelden` und eine deutliche Kennzeichnung `Dev-Auth aktiv`
- Hält Rollen, Module und Permission-Actions des Dev-Benutzers bewusst grob und auf lokale Nutzbarkeit ausgelegt
- Trennt Dev-Auth klar von echtem OIDC, Silent-SSO, Realm-Auflösung und Forced-Reauth

## Impact

- Affected specs:
  - `local-dev-auth`
  - `routing`
  - `architecture-documentation`
- Affected code:
  - `packages/auth-runtime`
  - `packages/routing`
  - `apps/sva-studio-react`
- Affected documentation:
  - `docs/development/runtime-profile-betrieb.md`
  - `docs/development/lokaler-dev-auth-modus.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
