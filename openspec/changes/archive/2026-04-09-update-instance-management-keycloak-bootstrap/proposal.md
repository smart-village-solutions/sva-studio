# Change: Instanzverwaltung um Keycloak-Realm-Bootstrap erweitern

## Why
Die aktuelle Instanzverwaltung pflegt nur Registry- und Lifecycle-Daten. Die für tenant-spezifische Realms notwendigen Keycloak-Grundeinstellungen, Client-Secrets, Mapper und initialen Tenant-Admins müssen weiterhin außerhalb des Studios manuell angelegt und nachgezogen werden. Das erzeugt Drift zwischen `iam.instances`, Keycloak und dem tatsächlichen Login-Verhalten.

## What Changes
- erweitert die Instanzverwaltung um editierbare Realm-Grundeinstellungen inklusive explizitem Realm-Modus `new` oder `existing`
- ergänzt einen geführten Keycloak-Control-Plane-Pfad mit Preflight, Plan, Ausführung und persistiertem Laufprotokoll für Tenant-Realm, `sva-studio`-Client, `instanceId`-Mapper und initialen Tenant-Admin
- speichert tenant-spezifische OIDC-Client-Secrets verschlüsselt in Studio
- ergänzt write-only Bootstrap-Felder für den initialen Tenant-Admin
- trennt `Registry speichern` und `Provisioning ausführen` explizit
- erweitert die Root-Host-UI `/admin/instances` zu einer operativen Control Plane für Registry-, Preflight-, Plan- und Keycloak-Laufzustand

## Impact
- Affected specs: `deployment-topology`, `iam-access-control`, `iam-core`
- Affected code: `packages/auth/src/iam-instance-registry/*`, `packages/auth/src/keycloak-admin-client/*`, `packages/data/src/instance-registry/*`, `packages/core/src/iam/account-management-contract.ts`, `apps/sva-studio-react/src/routes/admin/instances/*`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
