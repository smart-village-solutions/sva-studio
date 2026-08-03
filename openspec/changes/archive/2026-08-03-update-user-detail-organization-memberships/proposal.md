# Change: Organisationszuordnungen auf der User-Detailseite verwalten

## Why
Administratoren koennen Accounts bereits Organisationen zuordnen, aber nur ueber die Organisations-Detailseite. Fuer die Benutzerverwaltung fehlt damit auf `/admin/users/:userId` ein zentraler Bedienfluss, um Organisationsmitgliedschaften eines Accounts zu sehen und zu pflegen.

## What Changes
- Fuegt auf der User-Detailseite einen neuen Tab `Organisationen` hinzu.
- Erweitert das User-Detail-Read-Model um Organisationsmitgliedschaften.
- Ermoeglicht das Zuweisen weiterer Organisationen ueber eine suchbare Auswahl noch nicht zugewiesener Organisationen.
- Ermoeglicht das Entfernen bestehender Organisationsmitgliedschaften direkt aus dem User-Kontext.
- Ergaenzt eine Mutation zum Aktualisieren von Membership-Attributen `visibility` und `isDefaultContext`.
- Nutzt dieselben Membership-Regeln auf User- und Organisations-Detailseite, damit kein zweiter fachlicher Workflow entsteht.

## Impact
- Affected specs: `account-ui`, `iam-organizations`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/users/**`
  - `apps/sva-studio-react/src/hooks/use-user.ts`
  - `apps/sva-studio-react/src/hooks/use-organizations.ts`
  - `apps/sva-studio-react/src/lib/iam-api.ts`
  - `packages/core/src/iam/account-management-contract.ts`
  - `packages/iam-admin/src/user-detail-*`
  - `packages/iam-admin/src/organization-*`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
