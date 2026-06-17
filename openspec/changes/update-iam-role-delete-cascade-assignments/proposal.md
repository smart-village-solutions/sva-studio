# Change: Rollenlöschung kaskadiert über Benutzer- und Gruppen-Zuordnungen

## Why

Der aktuelle Rollenlöschpfad blockiert Custom-Rollen, solange direkte Benutzerzuordnungen bestehen. Das erzeugt unnötige Reibung in der Administration, obwohl die gewünschte Fachsemantik lautet, dass beim bestätigten Löschen auch die bestehenden Rollenzuordnungen entfernt werden.

## What Changes

- `DELETE /api/v1/iam/roles/:id` entfernt vor dem eigentlichen Rollendelete alle direkten Benutzerzuordnungen und Gruppenzuordnungen der Rolle im aktiven Tenant.
- Die Rollenverwaltung weist im Bestätigungsdialog darauf hin, dass Rollenzuordnungen und die Rolle selbst gelöscht werden.
- Tests, API-Doku und Betriebsdokumentation werden auf die neue Löschsemantik angepasst.

## Impact

- Affected specs: `iam-core`, `account-ui`
- Affected code: `packages/iam-admin/src/role-mutation-persistence.ts`, `packages/iam-admin/src/role-delete-handler.ts`, `apps/sva-studio-react/src/routes/admin/roles/-roles-page.tsx`
- Affected arc42 sections: `docs/architecture/06-runtime-view.md`
