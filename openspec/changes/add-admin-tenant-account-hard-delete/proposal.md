# Change: Admin-Hard-Delete für Tenant-Accounts ergänzen

## Why

Tenant-Administratoren können Accounts bisher nur deaktivieren oder über Datenschutzpfade eine fachliche Löschung anstoßen. Es fehlt ein expliziter Admin-Flow, mit dem berechtigte Tenant-Administratoren einen Tenant-Account inklusive Keycloak-Identität physisch löschen können, ohne das bestehende Self-Service- oder Inaktivitätsmodell umzudeuten.

## What Changes

- Es wird eine neue explizite Tenant-Permission `iam.accounts.delete` eingeführt.
- Tenant-Administratoren mit dieser Permission können Tenant-Accounts physisch löschen; `system_admin` erhält die Permission implizit über seine effektive Permission-Menge.
- Zielaccounts mit der Rolle `system_admin` sind grundsätzlich nicht löschbar. Die Rolle muss vor einer Löschung entzogen werden.
- Self-Delete bleibt verboten.
- Die Löschung entfernt den Benutzer auch in Keycloak und widerruft aktive Sessions.
- Die Behandlung eigener Inhalte folgt weiterhin den wirksamen Tenant-/Account-Regeln; referenzierende Historie darf anonymisiert erhalten bleiben.
- Der bestehende automatische Inaktivitäts-Lifecycle bleibt Tombstone-basiert; der neue Admin-Hard-Delete ist ein separater privilegierter Ausnahmefall.

## Impact

- Affected specs: `iam-core`, `iam-access-control`, `iam-data-subject-rights`, `account-ui`
- Affected code: `packages/iam-admin`, `packages/auth-runtime`, `packages/core`, `packages/data`, `apps/sva-studio-react`
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `10-quality-requirements`, `11-risks-and-technical-debt`
