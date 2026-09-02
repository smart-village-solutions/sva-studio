# Change: Keycloak-Realm-Rollenzuweisungen im Studio erweitern

## Why

Tenant-Realms enthalten neben der geschützten Studio-Sonderrolle `system_admin` auch externe Anwendungsrollen, beispielsweise für den SVA-Mainserver. Diese Rollen und ihre Benutzerzuweisungen sind heute teilweise als Rohdaten sichtbar, können im Studio aber nicht allgemein administriert werden. Dadurch müssen berechtigte Administratoren für fachlich zusammengehörige Benutzerverwaltung zusätzlich die Keycloak-Oberfläche verwenden.

Das Studio soll direkte Zuweisungen regulärer Tenant-Realm-Rollen mit der bereits vorhandenen Permission `iam.role.write` verwalten können, ohne externe Rollen in lokale IAM-Rollen zu importieren oder Keycloak-Rollen zur Quelle der Studio-Fachautorisierung zu machen.

## What Changes

- Zeige für alle im Tenant-Realm sichtbaren Benutzer, einschließlich noch nicht lokal gemappter App-Benutzer, die direkten und geerbten Keycloak-Realm-Rollen getrennt von lokalen IAM-Rollen an.
- Erlaube mit `iam.role.write` das direkte Zuweisen und Entziehen regulärer Tenant-Realm-Rollen ohne zusätzlichen Freigabeschritt.
- Halte Definitionen extern verwalteter Keycloak-Rollen im Studio read-only; nur ihre direkten Benutzerzuweisungen werden verändert.
- Schütze Keycloak-Builtins, Clientrollen, technische Service-Rollen und Root-/Plattformrollen vor tenantseitiger Zuweisung.
- Behandle `system_admin` weiterhin als zuweisbare, aber besonders geschützte Tenant-Sonderrolle mit gekoppeltem IAM-/Keycloak-Zustand, System-Admin-Gate und Letztadmin-Schutz.
- Erhalte die bestehende Autorisierungsgrenze: Externe Keycloak-Rollen gewähren keine lokalen Studio-Permissions; Studio-Gates bleiben an effektive IAM-Permissions gebunden.
- Führe Keycloak-Mutationen als eng begrenzte, idempotente Deltas aus und bestätige den resultierenden Direktzuweisungszustand durch einen kausalen Read.
- Auditiere erfolgreiche, abgelehnte und unklare Zuweisungsversuche ohne Tokens, E-Mail-Adressen oder rohe Keycloak-Subjects.

## Impact

- Affected specs:
  - `iam-core`
  - `iam-access-control`
  - `account-ui`
- Affected code:
  - `packages/core/src/iam/*`
  - `packages/iam-admin/src/*`
  - `packages/auth-runtime/src/iam-account-management/*`
  - `packages/auth-runtime/src/keycloak-admin-client/*`
  - `packages/data/src/iam/*`
  - `apps/sva-studio-react/src/routes/admin/users/*`
  - `apps/sva-studio-react/src/routes/admin/roles/*`
  - `apps/sva-studio-react/src/i18n/*`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
- Affected ADRs:
  - neue ADR zur administrierbaren Interop-Rollenzuweisung bei weiterhin lokaler Studio-Autorisierung
- Datenbankschema:
  - keine Schemaänderung geplant; Audit und bestehende IAM-Zuordnungen verwenden vorhandene Persistenzverträge
- External systems:
  - tenantlokale Keycloak Admin REST API
  - konsumierende Anwendungen wie der SVA-Mainserver bleiben für Bedeutung und Enforcement ihrer Rollen selbst verantwortlich
