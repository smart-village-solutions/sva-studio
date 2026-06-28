# Change: Scoped Role Permissions fuer datensatzbezogene Rechte

## Why
Die bestehende Rollenverwaltung kann Rechte nur binär zuweisen. Für datensatzbezogene Module fehlt damit eine zentrale Möglichkeit, Rollenrechte fachlich auf eigene Datensätze oder Datensätze der aktiven Organisation zu begrenzen.

## What Changes
- `iam.role_permissions` erhält ein eigenes Assignment-Scope (`all|own|organization`).
- Rollen-CRUD und Read-Modelle werden von `permissionIds` auf `permissionAssignments` erweitert, bleiben für Legacy-Payloads kompatibel.
- Der zentrale Authorize-Pfad wertet Assignment-Scopes für scope-fähige Datensatzrechte aus.
- Die Rollen-Detailseite erlaubt Scope-Pflege; die Nutzeransicht zeigt den effektiven Scope transparent an.
- **BREAKING (internes API-/Schema-Modell):** Rollen-Permission-Zuordnungen tragen zusätzliche Metadaten und müssen von Backend, UI und Tests berücksichtigt werden.

## Impact
- Affected specs: `iam-access-control`, `account-ui`, `architecture-documentation`
- Affected code: `packages/core`, `packages/iam-admin`, `packages/auth-runtime`, `apps/sva-studio-react`, `packages/data/migrations`
- Affected arc42 sections: `docs/architecture/04-solution-strategy.md`, `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`, `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/09-architecture-decisions.md`
