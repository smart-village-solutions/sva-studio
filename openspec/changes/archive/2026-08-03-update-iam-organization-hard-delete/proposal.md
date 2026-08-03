# Change: Physisches Löschen von Blatt-Organisationen

## Why
`DELETE /api/v1/iam/organizations/:organizationId` deaktiviert Organisationen derzeit nur soft, obwohl die UI bereits ein endgültiges Löschen kommuniziert. Für löschbare Blatt-Organisationen, einschließlich Seed-Organisationen, wird ein echtes Hard-Delete benötigt.

## What Changes
- `DELETE /api/v1/iam/organizations/:organizationId` löscht zulässige Blatt-Organisationen physisch.
- Vor dem Löschen werden Content-Referenzen auf die Organisation kontrolliert auf `NULL` gesetzt.
- Memberships und organisationsgebundene Mainserver-Credentials verschwinden über bestehende FK-Kaskaden mit.
- UI- und API-Benennungen werden auf `delete` statt `deactivate` ausgerichtet.

## Impact
- Affected specs: `iam-organizations`, `account-ui`
- Affected code: `packages/iam-admin`, `packages/auth-runtime`, `packages/routing`, `apps/sva-studio-react`
