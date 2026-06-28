# Change: WP-005 IAM-Zuweisungen und Vererbungs-Transparenz abschließen

## Why

Die aktuelle IAM-Administration bildet `WP-005` fachlich nur noch teilweise ab. Diff-basierte Benutzer-Updates, strukturierte Transparenzfelder und die Root-/Tenant-Bereinigung sind im Codestand inzwischen vorhanden; offen bleibt vor allem die konsistente Scope-Semantik zwischen Runtime, Admin-Read-Modellen und UI.

## What Changes

- explizite `runtimeScope`-Semantik für verwaltete Permissions und Permission-Traces
- saubere Trennung zwischen instanzweiten und organisations-/record-bezogenen Permission-Projektionen
- UI-Nachschärfung für Benutzer- und Gruppendetail, damit `instanzweit` vs. `organisationsbezogen` sichtbar wird
- normierter Abnahme- und Nachweisrahmen für Konflikt-, Gruppen-, Vererbungs-, Geo- und Scope-Szenarien

## Impact

- Affected specs:
  - `account-ui`
  - `iam-access-control`
  - `iam-core`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/users/`
  - `packages/core/src/iam/account-management-contract.ts`
  - `packages/iam-admin/src/user-detail-*`
  - `packages/auth-runtime/src/iam-authorization/`
  - `packages/auth-runtime/src/iam-media/`
  - `packages/auth-runtime/src/waste-management/`
- Affected arc42 sections:
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`
