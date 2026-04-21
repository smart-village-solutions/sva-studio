# Change: Platform-IAM auf dem Root-Host

## Why

`studio.smart-village.app` ist der kanonische Platform-/Root-Host, verwendet aber noch tenantgebundene IAM-Handler, die ohne `instanceId` mit `invalid_instance_id` abbrechen. Gleichzeitig müssen Root-User, Root-Rollen und Root-Sync fachlich im Platform-Scope verwaltbar sein.

## What Changes

- IAM-v1-User- und Rollen-Endpunkte werden scope-aware: Root nutzt `platform`, Tenant-Hosts nutzen weiter `instance`.
- Platform-User/Rollen werden über den Plattform-Keycloak-Adminpfad gelesen und synchronisiert, ohne Pseudo-Instanz in `iam.instances`.
- Tenant-Sync-Befunde (`partial_failure`, `IDP_FORBIDDEN`) werden in Doku, Diagnose und Testliste explizit getrennt nach User-Sync und Rollen-Reconcile behandelt.
- Root- und Tenant-Smokes werden dokumentiert getrennt.

## Impact

- Affected specs: `iam-core`, `iam-access-control`, `deployment-topology`, `app-e2e-integration-testing`
- Affected code: IAM Account-Management-Handler, React Admin-User-/Rollenlisten, IAM API-Typen und Doku
- Affected arc42 sections: `04-solution-strategy`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `10-quality-requirements`
