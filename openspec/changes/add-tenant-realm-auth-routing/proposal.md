# Change: Realm-spezifisches Auth-Routing pro Instanz

## Why

Die Plattform nutzt heute einen globalen OIDC-Issuer und einen globalen Keycloak-Admin-Realm. Das verhindert produktive 1:1-Isolation zwischen `instanceId` und Realm und blockiert tenant-lokale Auth-Flows.

## What Changes

- Instanz-Registry und Provisioning werden um verpflichtende Auth-Felder je Instanz erweitert.
- Runtime-Auth, Reauth und Keycloak-Admin-Pfade werden auf instanzspezifische Realm-Auflösung umgestellt.
- Provisioning erzeugt Realm- und Client-Artefakte in Keycloak für neue Instanzen.
- Runtime-Profile, Deploy-Checks und Runbooks werden vom globalen Realm-Modell auf tenant-spezifische Auth-Konfiguration umgestellt.

## Impact

- Affected specs: `deployment-topology`, `iam-core`, `architecture-documentation`
- Affected code: `packages/auth`, `packages/data`, `packages/core`, `docs/guides`, `docs/adr`
- Affected arc42 sections: `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`
