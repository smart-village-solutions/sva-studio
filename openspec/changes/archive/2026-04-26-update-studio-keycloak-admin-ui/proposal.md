# Change: Studio als Keycloak-Admin-UI

## Why

Das Studio soll nicht nur tenantgebundene IAM-Daten verwalten, sondern als fachlich nutzbare Alternative zur Keycloak-Admin-Konsole dienen. Administratoren müssen deshalb alle relevanten Keycloak-User und -Rollen im Studio sehen, filtern, synchronisieren und bearbeiten können, ohne für Standardaufgaben in Keycloak wechseln zu müssen.

## What Changes

- Root-/Platform-IAM wird von einer read-or-sync Projektion zu einer bearbeitbaren Keycloak-Admin-Oberfläche erweitert.
- Tenant-IAM zeigt alle tenantrelevanten Keycloak-User und -Rollen, einschließlich erklärbarer Mapping- und Sync-Zustände.
- Studio wird Keycloak-first für User- und Rollenänderungen: Änderungen werden gegen Keycloak ausgeführt und anschließend in Studio-Read-Models synchronisiert.
- Sync- und Reconcile-Ergebnisse unterscheiden vollständig zwischen `success`, `partial_failure`, `blocked` und `failed` und zeigen betroffene User/Rollen mit Diagnosecodes.
- Pagination, Suche, Statusfilter und Rollenzuordnung müssen über Keycloak-Admin-APIs skalieren und dürfen nicht pro Request den gesamten Realm unkontrolliert laden.
- Bearbeitbarkeit bleibt an klare Platform- und Tenant-Admin-Rechte, Audit-Logs und Least-Privilege-Service-Accounts gebunden.

## Impact

- Affected specs: `iam-core`, `iam-access-control`, `account-ui`, `app-e2e-integration-testing`, `architecture-documentation`
- Affected code: Keycloak Admin Client, `IdentityProviderPort`, IAM Account-Management-Handler, Sync-/Reconcile-Services, React Admin-User-/Rollenlisten und Detailseiten
- Affected arc42 sections: `04-solution-strategy`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `10-quality-requirements`
