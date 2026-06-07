# Change: Plattform-/Tenant-Rollenmodell entkoppeln und `system_admin` als Vollzugriffsrolle normieren

## Why
Das aktuelle IAM-Modell vermischt Root-/Plattform-Rechte, tenantlokale Sonderrollen und fachliche Standardrollen. Dadurch sind `instance_registry_admin`, `system_admin`, modulbezogene Standardrollen, Gruppen wie `admins` und `roleLevel` in Seeds, Provisioning, UI-Guards und Admin-Workflows gleichzeitig verdrahtet. Die Folge ist hohe Kopplung: fachliche Rechte lassen sich nicht unabhängig von kanonischen Rollennamen verwalten, Root- und Tenant-Verantwortung sind nicht sauber getrennt, und `system_admin` liefert in laufenden Tenants nicht verlässlich den erwarteten Vollzugriff, wenn ergänzende Rollen- oder Gruppenzuweisungen fehlen.

## What Changes
- Trenne Root-/Plattform-Rollen und tenantlokale Rollen normativ auf Realm-Ebene.
- Definiere `instance_registry_admin` als einzige relevante Root-Rolle im Plattform-Realm.
- Definiere `system_admin` als einzige geschützte tenantlokale Vollzugriffs- und Defaultrolle im Tenant-Realm.
- Entferne `instance_registry_admin` und `instance.registry.manage` aus tenantlokalen Rollen-, Gruppen- und Permission-Verträgen.
- Binde alle tenantlokalen UI-, Verwaltungs- und Modul-Permissions normativ an Permissions und stelle sicher, dass `system_admin` diese vollständige Permission-Menge immer direkt bündelt.
- Entkopple modulbezogene Rechteverträge von kanonischen tenantlokalen Standardrollen (`app_manager`, `editor`, `designer`, `moderator`, `feature_manager`, `interface_manager`) und entferne diese Legacy-Standardrollen aus Seeds, Modulverträgen und Entwicklungs-Snapshots.
- Stelle tenantseitige Rechtevergabe auf individuell verwaltbare Rollen und Gruppen um; neben `system_admin` gibt es tenantseitig keine weiteren automatisch verwalteten Standardrollen mehr.
- Erhalte historische Cleanup-, Repair- und Upgrade-Pfade für Bestandsinstanzen explizit aufrecht, damit frühere Legacy-Rollen nur noch als Migrationsinput und nicht mehr als produktives Sollmodell behandelt werden.
- Migriere rollenbasierte Guards in Root und Tenant schrittweise auf explizite Plattform-/Tenant-Checks und zentralere Permission- oder Scope-Verträge.
- Halte `roleLevel` vorerst kompatibel, markiere es aber als spätere Rückbaukandidatur, sobald die Delegations- und Verwaltungsgrenzen ohne Hierarchiestufe tragfähig sind.

## Impact
- Affected specs:
  - `iam-core`
  - `iam-access-control`
  - `instance-provisioning`
  - `account-ui`
- Affected code:
  - `packages/data/src/iam/*`
  - `packages/data-repositories/src/instance-registry/*`
  - `packages/studio-module-iam/src/*`
  - `packages/instance-registry/src/*`
  - `packages/auth-runtime/src/iam-instance-registry/*`
  - `packages/auth-runtime/src/iam-account-management/*`
  - `packages/iam-admin/src/*`
  - `apps/sva-studio-react/src/lib/*`
  - `apps/sva-studio-react/src/routes/admin/*`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
