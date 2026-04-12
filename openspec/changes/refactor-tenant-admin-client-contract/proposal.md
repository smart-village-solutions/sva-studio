# Change: Separaten `tenantAdminClient` als Instanzvertrag einführen

## Why

Die aktuelle Tenant-Architektur trennt Login-Realm und Tenant-Kontext bereits sauber, modelliert den technischen Adminpfad einer Instanz aber noch nicht vollständig separat. Dadurch bleibt unklar, welcher Client für interaktive User-Logins und welcher Client für tenant-lokale Admin-Mutationen, Reconcile und Bootstrap verwendet werden soll.

Für eine nachhaltige Root-/Tenant-Trennung muss der Instanzvertrag deshalb den tenant-lokalen Admin-Client explizit führen und das Provisioning, die Registry, die Laufzeitauflösung und die Diagnosepfade auf diesen getrennten Vertrag umstellen.

## What Changes

- `iam.instances` und die zugehörigen Core-/API-Verträge werden um einen expliziten `tenantAdminClient` erweitert
- der bestehende Login-Client (`authClientId`) bleibt für interaktive OIDC-Flows bestehen
- Provisioning, Registry-Reconcile und lokale Seed-/Runtime-Pfade erzeugen und prüfen Login-Client und Tenant-Admin-Client getrennt
- tenant-lokale User-/Role-/Group-Mutationen lösen ihren Keycloak-Adminpfad ausschließlich über den neuen `tenantAdminClient` auf
- Health-, Doctor- und Diagnosepfade weisen Login-Realm/-Client, Tenant-Admin-Realm/-Client und Platform-Admin-Realm getrennt aus
- Break-Glass bleibt Plattformfunktion und wird nicht stillschweigend als Fallback für normale Tenant-Mutationen genutzt
- bestehende Instanzen werden per Backfill-Befehl automatisch mit einem Tenant-Admin-Client nachgerüstet
- neuer Provisioning-Intent `'provision_admin_client'` für den Backfill bestehender Instanzen
- Monitoring-Metrik `sva_instance_admin_client_drift` und zugehöriger Alert für fehlende oder gedriftete Admin-Clients

## Impact

- Affected specs:
  - `instance-provisioning`
  - `iam-access-control`
- Affected code:
  - `packages/core/src/instances/registry.ts`
  - `packages/data/src/instance-registry/index.ts`
  - `packages/data/migrations/` (neue Goose-Migration 0030+)
  - `packages/auth/src/iam-instance-registry/*`
  - `packages/auth/src/iam-account-management/shared-runtime.ts`
  - `packages/auth/src/config.ts`
  - `packages/auth/src/config-tenant-secret.ts` (neue `resolveTenantAdminClientSecret`)
  - `scripts/ops/runtime/local-instance-registry.ts`
  - `scripts/ops/instance-registry.ts`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
- Affected ADRs:
  - neuer ADR für die Trennung von Tenant-Login-Client und Tenant-Admin-Client
