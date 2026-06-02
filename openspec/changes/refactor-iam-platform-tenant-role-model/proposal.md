# Change: Plattform-/Tenant-Rollenmodell entkoppeln und Standardrollen flexibilisieren

## Why
Das aktuelle IAM-Modell vermischt Root-/Plattform-Rechte, tenantlokale Sonderrollen und fachliche Standardrollen. Dadurch sind `instance_registry_admin`, `system_admin`, modulbezogene Standardrollen und `roleLevel` in Seeds, Provisioning, UI-Guards und Admin-Workflows gleichzeitig verdrahtet. Die Folge ist hohe Kopplung: fachliche Rechte lassen sich nicht unabhängig von kanonischen Rollennamen verwalten, Root- und Tenant-Verantwortung sind nicht sauber getrennt, und künftige Custom-Rollen bleiben unnötig an Standardrollen gebunden.

## What Changes
- Trenne Root-/Plattform-Rollen und tenantlokale Rollen normativ auf Realm-Ebene.
- Definiere `instance_registry_admin` als einzige relevante Root-Rolle im Plattform-Realm.
- Definiere `system_admin` als einzige geschützte tenantlokale Defaultrolle im Tenant-Realm.
- Entferne `instance_registry_admin` und `instance.registry.manage` aus tenantlokalen Rollen-, Gruppen- und Permission-Verträgen.
- Entkopple modulbezogene Rechteverträge von kanonischen tenantlokalen Standardrollen (`app_manager`, `editor`, `designer`, `moderator`, `feature_manager`, `interface_manager`).
- Stelle tenantseitige Rechtevergabe auf individuell verwaltbare Rollen und Gruppen um; Standardrollen bleiben höchstens als Übergangskompatibilität bestehen.
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
