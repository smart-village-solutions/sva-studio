# Change: IAM Ownership- und Allow-only-Autorisierungsmodell umsetzen

## Why

Das aktuelle IAM-Modell enthält technische Altlasten für explizite Deny-Permissions, direkte Account-Permissions und Creator-basierte Own-Prüfungen. Das fachliche Zielbild verlangt ein tenant-lokales Allow-only-Modell mit Rollen-/Gruppen-Grants, kanonischer Content-Ownership und identischer Listen-/Detailautorisierung.

## What Changes

- **BREAKING** Direkte Account-Permissions werden aus Schema, API und Admin-Trace entfernt.
- **BREAKING** Explizite `deny`-Permission-Semantik wird entfernt; effektive Permissions sind Allow-Grants.
- Content-Ownership wird über `owner_user_id` und `owner_organization_id` modelliert.
- `Eigene` und `Aktive Organisation` werden gegen Ownership statt gegen Creator-/Organisationsapproximation geprüft.
- Listen-, Detail- und Mutationspfade nutzen dieselbe Scope-Logik.
- `System Admin` bleibt eine geschützte normale Rolle und erhält alle tenant-relevanten Permissions per Sync/Gate.

## Impact

- Affected specs: `iam-access-control`, `content-management`, `iam-auditing`, `iam-core`
- Affected code: IAM authorization contracts/runtime, content repository and projection, IAM admin user detail, database migrations and schema snapshots
- Affected arc42 sections: `08-cross-cutting-concepts`, `05-building-block-view`
