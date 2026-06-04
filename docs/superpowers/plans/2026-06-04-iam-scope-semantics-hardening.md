# IAM Scope Semantics Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das IAM soll den kanonischen Instanz-First-Scope konsistent auswerten, organisations- und datensatzbezogene Einschränkungen nur noch explizit anwenden und dabei Runtime-, Admin- und Transparenzpfade auf dieselbe Semantik zurückführen.

**Architecture:** Die Umsetzung trennt drei Semantikklassen sauber: plattform-/root-only, tenantweit instanzbezogen und explizit record-/organizationsbezogen. Die Permission-Auflösung darf aktive Organisationskontexte nicht länger pauschal auf alle Rechte projizieren; stattdessen entscheidet zentral gepflegte Permission-Metadaten, ob ein Recht instanzweit bleibt oder zusätzlichen Org-/Ownership-Kontext benötigt. Diagnose- und UI-Read-Modelle übernehmen dieselbe Klassifikation, damit effektive Rechte und ihre Herkunft nicht widersprüchlich erscheinen.

**Tech Stack:** OpenSpec, arc42, TypeScript strict mode, Nx, pnpm, Vitest, Postgres/SQL, React, TanStack Router

---

## Zielregeln

Diese Regeln sind für alle Tasks dieses Plans normativ. Wenn bestehender Code oder Altmodelle ihnen widersprechen, ist der Plan auf die Regeln und nicht auf die Altverdrahtung auszurichten.

1. `instanceId` ist immer der führende Tenant-Scope.
2. `organizationId` ist nur ein optionaler Fachkontext innerhalb einer Instanz.
3. Die Runtime unterscheidet exakt drei Rechteklassen: Root-/Plattformrechte, tenantweite Instanzrechte und explizit datensatz-/organisationsbezogene Rechte.
4. `instance_registry_admin` ist ausschließlich Root-/Plattformrecht und darf tenantlokal keine Wirkung entfalten.
5. `system_admin` bleibt die einzige geschützte tenantlokale Sonderrolle für die initiale bzw. vollständige Instanzadministration.
6. Alle übrigen Standardrollen wie `app_manager`, `editor`, `designer`, `moderator`, `feature_manager` oder `interface_manager` sind nur Übergangskompatibilität und nicht mehr normative Rechtequelle.
7. Tenant-Fachrechte werden permission-zentriert über individuelle Rollen und Gruppen modelliert, nicht über fest verdrahtete Standardrollen.
8. Instanzweite Rechte bleiben auch bei gesetztem `activeOrganizationId` instanzweit wirksam.
9. `accessScope = all | own | organization` gilt nur für ausdrücklich scope-fähige Datensatzrechte.
10. Accounts ohne Organisationszuordnung bleiben für instanzweite Rechte voll funktionsfähig.
11. Runtime, Permission-Snapshot, Admin-API und UI-Transparenz müssen dieselbe Scope-Semantik anzeigen.
12. Bevor ein Modul fachlich `own`- oder `organization`-Scopes auswerten darf, muss sein Datenmodell die nötigen fachlichen Attribute explizit tragen.

## File Structure Map

### Spezifikation und Architektur

- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/proposal.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/design.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/tasks.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/specs/iam-core/spec.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/specs/iam-access-control/spec.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/proposal.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/tasks.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/specs/iam-core/spec.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/specs/account-ui/spec.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/04-solution-strategy.md`
- Modify: `docs/architecture/09-architecture-decisions.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Create or Modify: `docs/architecture/decisions/ADR-0xx-iam-scope-semantics-and-role-separation.md`

### Permission-Semantik und Metadaten

- Modify: `packages/iam-admin/src/managed-permissions.ts`
- Modify: `packages/iam-admin/src/managed-permissions.test.ts`
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/roles-handlers.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/roles-handlers.test.ts`

### Snapshot- und Authorize-Auflösung

- Create: `packages/auth-runtime/src/iam-authorization/permission-scope-semantics.ts`
- Create: `packages/auth-runtime/src/iam-authorization/permission-scope-semantics.test.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.queries.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/shared-effective-permissions.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.test.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/me-permissions.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/me-permissions.test.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/authorize.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/authorize.test.ts`
- Modify: `packages/auth-runtime/src/auth-route-handlers.ts`

### Modul- und Host-Call-Sites

- Modify: `packages/auth-runtime/src/iam-media/server-authorization.ts`
- Modify: `packages/auth-runtime/src/iam-media/server-authorization.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/auth.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/guard-branches.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/read-handlers.test.ts`
- Modify: `packages/auth-runtime/src/iam-contents/request-context.ts`
- Modify: `packages/auth-runtime/src/iam-contents/request-context.test.ts`

### Altmodell-Cleanup und Realm-/Bootstrap-Pfade

- Modify: `packages/auth-runtime/src/iam-account-management/platform-iam.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/platform-iam-roles.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/profile-handlers.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/constants.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/platform-iam.test.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/profile-handlers.test.ts`
- Modify: `packages/data/src/iam/seed-plan.ts`
- Modify: `packages/data/src/iam/seed-plan.test.ts`
- Modify: `packages/data-repositories/src/iam/seed-plan.personas.ts`
- Modify: `packages/instance-registry/src/provisioning-auth-state.ts`
- Modify: `packages/instance-registry/src/provisioning-auth-state.test.ts`
- Modify: `packages/instance-registry/src/service-keycloak-run-steps.ts`
- Modify: `packages/instance-registry/src/provisioning-auth.test.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-admin-access.ts`
- Modify: `packages/iam-admin/src/organization-read-handlers.ts`
- Modify: `packages/iam-admin/src/group-read-handlers.ts`
- Modify: `packages/iam-admin/src/group-mutation-handlers.ts`
- Modify: `packages/iam-admin/src/organization-mutation-handlers.ts`
- Modify: `packages/iam-governance/src/governance-workflow-policy.ts`
- Create: `packages/data/migrations/<next>_iam_scope_semantics_cleanup.sql`
- Modify: `docs/development/studio-db-schema-final.sql` (nur falls Cleanup-Migration Schema-/Constraint-Folgen hat)

### Transparenz- und Admin-Projektion

- Modify: `packages/iam-admin/src/user-detail-permission-sql.ts`
- Modify: `packages/iam-admin/src/user-detail-query.mapping.ts`
- Modify: `packages/iam-admin/src/user-detail-query.mapping.test.ts`
- Modify: `packages/iam-admin/src/user-detail-query.test.ts`
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/users/*`

### Verifikation und Doku

- Modify: `docs/guides/iam-authorization-api-contract.md`
- Modify: `docs/guides/iam-service-api-dokumentation.md`
- Modify: `docs/guides/iam-deployment-runbook.md`
- Modify: `docs/guides/iam-acceptance-runbook.md`
- Modify: `docs/guides/keycloak-tenant-realm-bootstrap.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`
- Modify: `docs/development/studio-db-schema.md` (nur falls doch ein Datenmodell-Split nötig wird; in dieser Phase nicht vorgesehen)

---

### Task 1: Zielmodell und offene Changes synchronisieren

**Files:**
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/proposal.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/design.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/specs/iam-core/spec.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/specs/iam-access-control/spec.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/proposal.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/specs/iam-core/spec.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/specs/account-ui/spec.md`

- [ ] **Step 1: Soll-Ist-Matrix gegen bestehende Spezifikationen ziehen**

Run:
```bash
openspec show refactor-iam-platform-tenant-role-model --json --deltas-only
openspec show refactor-wp-005-iam-assignment-transparency --json --deltas-only
openspec show iam-core --type spec
openspec show iam-access-control --type spec
```

Expected:
- Die aktiven Changes beschreiben Root-/Tenant-Trennung, scoped Rollen-Permissions und Transparenz bereits teilweise, aber noch nicht explizit genug für instanzweite Host-/Plugin-Rechte ohne Org-Projektion.

- [ ] **Step 2: Kombinierte Zielsemantik in die offenen Changes aufnehmen**

Zieltext:
```md
### Requirement: Tenantweite Rechte bleiben bei aktivem Organisationskontext instanzweit wirksam
Das System SHALL tenantweite Host- und Plugin-Rechte nicht allein deshalb organisationsgebunden behandeln, weil ein aktiver `organizationId`-Kontext vorhanden ist.

#### Scenario: Instanzweites Medienrecht bleibt im Org-Kontext wirksam
- **WHEN** ein Benutzer im Tenant eine instanzweite Berechtigung wie `media.read` besitzt
- **AND** die Session einen aktiven Organisationskontext trägt
- **THEN** bleibt die Berechtigung wirksam
- **AND** das System verlangt dafür weder ein datensatzbezogenes `accessScope` noch ein organisationsgebundenes Medien-Datenmodell
```

- [ ] **Step 3: Scope-Klassen normativ festziehen**

Zieltext:
```md
Die Runtime unterscheidet drei fachliche Klassen:
- Plattform-/Root-Rechte
- tenantweite Instanzrechte
- explizit record- oder organizationsbezogene Rechte
```

Wichtig:
- `content.*`, `news.*`, `events.*`, `poi.*` bleiben scope-fähig über `accessScope`.
- `media.*`, `waste-management.*`, `app.read`, `cockpit.read`, `feature.toggle`, `integration.manage` bleiben in dieser Phase instanzweit.
- organisationsgebundene Mainserver-Credentials bleiben ein separater organisationsbezogener Fachpfad und werden nicht rückwirkend als Muster für alle Rechte missbraucht.

- [ ] **Step 4: Strict-Validation der relevanten Changes ausführen**

Run:
```bash
openspec validate refactor-iam-platform-tenant-role-model --strict
openspec validate refactor-wp-005-iam-assignment-transparency --strict
```

Expected:
- PASS ohne Delta- oder Szenariofehler.

### Task 2: Permission-Metadaten um explizite Laufzeitsemantik erweitern

**Files:**
- Modify: `packages/iam-admin/src/managed-permissions.ts`
- Modify: `packages/iam-admin/src/managed-permissions.test.ts`
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/roles-handlers.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/roles-handlers.test.ts`

- [ ] **Step 1: Failing Tests für Runtime-Scope-Metadaten schreiben**

Zieltest:
```ts
expect(getManagedPermissionMetadata('media.read')).toMatchObject({
  permissionKey: 'media.read',
  runtimeScope: 'instance',
});

expect(getManagedPermissionMetadata('news.read')).toMatchObject({
  permissionKey: 'news.read',
  runtimeScope: 'record',
  isScopeAssignable: true,
});
```

Run:
```bash
pnpm nx run iam-admin:test:unit --testFiles=src/managed-permissions.test.ts
```

Expected:
- FAIL, weil `runtimeScope` noch nicht existiert.

- [ ] **Step 2: Metadatenmodell minimal erweitern**

Zielcode:
```ts
export type PermissionRuntimeScope = 'instance' | 'record' | 'organization_context';

export type ManagedPermissionMetadata = Readonly<{
  permissionKey: string;
  moduleId: string;
  description?: string;
  isScopeAssignable?: boolean;
  supportedAccessScopes?: readonly IamRolePermissionAssignmentScope[];
  runtimeScope: PermissionRuntimeScope;
}>;
```

- [ ] **Step 3: Relevante Permission-Klassen markieren**

Zielcode:
```ts
const RECORD_SCOPED_PERMISSION_KEYS = [
  'content.read',
  'content.updateMetadata',
  'content.updatePayload',
  'content.changeStatus',
  'content.archive',
  'content.restore',
  'content.delete',
  'news.read',
  'news.update',
  'news.delete',
  'events.read',
  'events.update',
  'events.delete',
  'poi.read',
  'poi.update',
  'poi.delete',
] as const;

const INSTANCE_SCOPED_PERMISSION_KEYS = [
  'app.read',
  'cockpit.read',
  'media.read',
  'media.create',
  'media.update',
  'media.reference.manage',
  'media.delete',
  'media.deliver.protected',
  'waste-management.read',
  'waste-management.master-data.manage',
  'waste-management.tours.manage',
  'waste-management.scheduling.manage',
  'waste-management.import.execute',
  'waste-management.seed.execute',
  'waste-management.reset.execute',
  'waste-management.settings.manage',
] as const;
```

- [ ] **Step 4: Vollständigkeitsgate für alle verwalteten Permissions ergänzen**

Zieltest:
```ts
it('classifies every managed permission with an explicit runtime scope', () => {
  for (const permission of listManagedPermissionMetadata()) {
    expect(permission.runtimeScope).toMatch(/^(instance|record|organization_context)$/);
  }
});
```

Regel:
- kein stiller Fallback auf `'instance'` für verwaltete Permissions
- neue Permissions brechen den Test, bis ihre Semantik explizit entschieden wurde

- [ ] **Step 5: Rollen-/Permission-Read-Modelle durchreichen**

Zielcode:
```ts
...(metadata?.runtimeScope ? { runtimeScope: metadata.runtimeScope } : {}),
```

Run:
```bash
pnpm nx run iam-admin:test:unit --testFiles=src/managed-permissions.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-account-management/roles-handlers.test.ts
```

Expected:
- PASS

### Task 3: Permission-Auflösung von pauschaler Org-Projektion lösen

**Files:**
- Create: `packages/auth-runtime/src/iam-authorization/permission-scope-semantics.ts`
- Create: `packages/auth-runtime/src/iam-authorization/permission-scope-semantics.test.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.queries.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/shared-effective-permissions.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.test.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/me-permissions.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/authorize.ts`

- [ ] **Step 1: Failing Regression-Tests für instanzweite Rechte im Org-Kontext schreiben**

Zieltests:
```ts
it('keeps media.read instance-scoped when organizationId is supplied', async () => {
  const result = await resolveEffectivePermissions({
    instanceId: 'de-test',
    keycloakSubject: 'kc-user-1',
    organizationId: 'org-1',
  });

  expect(result).toEqual(
    expect.objectContaining({
      ok: true,
      permissions: expect.arrayContaining([
        expect.objectContaining({
          action: 'media.read',
          organizationId: undefined,
        }),
      ]),
    })
  );
});
```

Run:
```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-authorization/permission-store.test.ts
```

Expected:
- FAIL, weil `organizationId` heute pauschal auf alle gefundenen Rows projiziert wird.

- [ ] **Step 2: Zentrale Semantik-Helfer einführen**

Zielcode:
```ts
export const resolvePermissionRuntimeScope = (permissionKey: string): PermissionRuntimeScope =>
  getManagedPermissionMetadata(permissionKey)?.runtimeScope ?? failForUnknownManagedPermission(permissionKey);

export const shouldProjectOrganizationContext = (input: {
  permissionKey: string;
  accessScope?: 'all' | 'own' | 'organization';
}): boolean =>
  resolvePermissionRuntimeScope(input.permissionKey) === 'organization_context' ||
  resolvePermissionRuntimeScope(input.permissionKey) === 'record' ||
  input.accessScope === 'organization';
```

- [ ] **Step 3: DB-Query und Post-Processing trennen**

Zielrichtung:
```ts
// keine blanket-Projektion "$3::uuid AS organization_id" mehr für jede Permission-Row
// stattdessen:
// 1. effektive Rows laden
// 2. Membership-/Hierarchy-Kontext getrennt lesen
// 3. org-Kontext nur für Rechte projizieren, die ihn wirklich benötigen
```

Regel:
- instanzweite Rechte behalten `organizationId: undefined`
- record-/organization-context-Rechte erhalten nur dann eine Org-Projektion, wenn der Actor im aktiven Org-Kontext zulässig ist
- Cache-Key-Dimension nach `organizationId` bleibt erhalten, weil record-/org-bezogene Rechte davon abhängen können

- [ ] **Step 4: Security-/Privacy-Regeln für Diagnose- und Transparenzfelder festziehen**

Pflichtpunkte:
- öffentliche API-Responses bleiben allowlist-basiert
- keine Roh-SQL-, Cache-Key-, Membership- oder Session-Details in UI-/API-Diagnostik
- zusätzliche Transparenzfelder wie `runtimeScope` oder `inheritedFromOrganizationId` werden auf PII- und Eskalationsrisiken geprüft
- OTEL-/Audit-Logs bleiben der einzige tiefe Debug-Pfad

- [ ] **Step 5: `/auth/me` und `GET /iam/me/permissions` gegen dieselbe Semantik stabilisieren**

Zielcode:
```ts
const resolvedPermissions = await resolveEffectivePermissions({
  instanceId,
  keycloakSubject,
  organizationId: requestOrganizationId ?? undefined,
});
```

Zusatz:
- `/auth/me` bleibt absichtlich unscoped und aggregiert nur Actions.
- Die Aggregation darf keine falsche implizite Org-Bindung suggerieren.

- [ ] **Step 6: Slice erneut ausführen**

Run:
```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-authorization/permission-store.test.ts --testFiles=src/iam-authorization/me-permissions.test.ts --testFiles=src/iam-authorization/authorize.test.ts
pnpm nx run auth-runtime:test:types
```

Expected:
- PASS

### Task 4: Altmodell-Reste in Root-/Tenant-Projektion, Seeds und Bootstrap bereinigen

**Files:**
- Modify: `packages/auth-runtime/src/iam-account-management/platform-iam.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/platform-iam-roles.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/profile-handlers.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/constants.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/platform-iam.test.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/profile-handlers.test.ts`
- Modify: `packages/data/src/iam/seed-plan.ts`
- Modify: `packages/data/src/iam/seed-plan.test.ts`
- Modify: `packages/data-repositories/src/iam/seed-plan.personas.ts`
- Modify: `packages/instance-registry/src/provisioning-auth-state.ts`
- Modify: `packages/instance-registry/src/provisioning-auth-state.test.ts`
- Modify: `packages/instance-registry/src/service-keycloak-run-steps.ts`
- Modify: `packages/instance-registry/src/provisioning-auth.test.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-admin-access.ts`
- Modify: `packages/iam-admin/src/organization-read-handlers.ts`
- Modify: `packages/iam-admin/src/group-read-handlers.ts`
- Modify: `packages/iam-admin/src/group-mutation-handlers.ts`
- Modify: `packages/iam-admin/src/organization-mutation-handlers.ts`
- Modify: `packages/iam-governance/src/governance-workflow-policy.ts`

- [ ] **Step 1: Root-/Tenant-Hotspots inventarisieren und als Abnahmeliste festhalten**

Run:
```bash
rg -n "instance_registry_admin|system_admin|app_manager|editor|designer|moderator|feature_manager|interface_manager|ADMIN_ROLES" packages apps -g '!**/dist/**'
```

Expected:
- eine konkrete Trefferliste für Plattformprojektion, Seeds, Provisioning und Tenant-UI-Gates liegt vor
- jeder Treffer wird entweder bereinigt oder bewusst als dokumentierte Restschuld markiert

- [ ] **Step 2: Plattformprojektion auf Root-Sonderrolle reduzieren**

Zielcode:
```ts
export const PLATFORM_ROOT_ROLE = 'instance_registry_admin';
const PLATFORM_PROFILE_ROLES = new Set([PLATFORM_ROOT_ROLE]);
```

Regel:
- Root-Profilpfade kennen keine tenantseitigen Standardrollen
- `system_admin` wird nicht in Plattformprojektionen injiziert

- [ ] **Step 3: Tenant-Bootstrap und Seeds von `instance_registry_admin` befreien**

Zielrichtung:
```ts
// keine tenantseitige Persona instance_registry_admin mehr
// tenant bootstrap synchronisiert nur system_admin
```

Regel:
- `system_admin` bleibt einzige geschützte tenantlokale Defaultrolle
- tenantseitige Standardrollen bleiben höchstens Übergangskompatibilität, aber kein normatives Soll mehr

- [ ] **Step 4: Tenant-UI- und Handler-Gates von Root-Rolle und kanonischen Standardrollen lösen**

Zielrichtung:
```ts
const ROOT_ADMIN_ROLES = new Set(['instance_registry_admin']);
const PROTECTED_TENANT_ROLE_KEYS = new Set(['system_admin']);
```

Regel:
- `instance_registry_admin` erscheint nie in tenantlokalen Role-Pickern
- tenantseitige Role-/Group-/User-Seiten hängen nicht mehr implizit an `app_manager`, `editor` usw.

- [ ] **Step 5: Cleanup-Slices ausführen**

Run:
```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-account-management/platform-iam.test.ts --testFiles=src/iam-account-management/profile-handlers.test.ts
pnpm nx run instance-registry:test:unit --testFiles=src/provisioning-auth-state.test.ts --testFiles=src/provisioning-auth.test.ts
pnpm nx affected --target=test:unit --base=origin/main
```

Expected:
- PASS oder explizit dokumentierte Restschuld pro Treffer

### Task 5: Modul- und Host-Autorisierung auf die neue Scope-Semantik umstellen

**Files:**
- Modify: `packages/auth-runtime/src/iam-media/server-authorization.ts`
- Modify: `packages/auth-runtime/src/iam-media/server-authorization.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/auth.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/guard-branches.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/read-handlers.test.ts`
- Modify: `packages/auth-runtime/src/iam-contents/request-context.ts`
- Modify: `packages/auth-runtime/src/iam-contents/request-context.test.ts`

- [ ] **Step 1: Media- und Waste-Regressionstests erst rot ziehen**

Zieltests:
```ts
expect(resolveEffectivePermissionsMock).toHaveBeenCalledWith({
  instanceId: 'tenant-a',
  keycloakSubject: 'kc-user-1',
});
```

für:
- `packages/auth-runtime/src/iam-media/server-authorization.test.ts`
- `packages/auth-runtime/src/waste-management/core/guard-branches.test.ts`

Run:
```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-media/server-authorization.test.ts --testFiles=src/waste-management/core/guard-branches.test.ts
```

Expected:
- FAIL, weil beide Pfade heute `activeOrganizationId` in instanzweite Modulrechte einspeisen.

- [ ] **Step 2: Media und Waste auf instanzweiten Resolve-/Authorize-Pfad zurückführen**

Zielcode:
```ts
const resolved = await resolveEffectivePermissions({
  instanceId,
  keycloakSubject: ctx.user.id,
});

const decision = evaluateAuthorizeDecision(
  {
    instanceId,
    action,
    resource: { type: 'media' },
    context: requestId ? { requestId } : undefined,
  },
  resolved.permissions
);
```

Analog für `waste-management`.

- [ ] **Step 3: Content-Pfad bewusst unverändert, aber explizit abgesichert lassen**

Zieltest:
```ts
expect(request.resource.organizationId).toBe(resource.organizationId ?? actor.activeOrganizationId);
expect(request.context?.attributes?.actorAccountId).toBeDefined();
```

Regel:
- `iam-contents` bleibt der Referenzpfad für record-scoped Rechte.
- Hier wird `activeOrganizationId` weiterhin gebraucht, weil `content/news/events/poi` fachlich scope-fähig sind.

- [ ] **Step 4: Slice erneut ausführen**

Run:
```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-media/server-authorization.test.ts --testFiles=src/waste-management/core/guard-branches.test.ts --testFiles=src/waste-management/core/read-handlers.test.ts --testFiles=src/iam-contents/request-context.test.ts
```

Expected:
- PASS

### Task 6: Transparenz- und Admin-Read-Modelle an dieselbe Semantik angleichen

**Files:**
- Modify: `packages/iam-admin/src/user-detail-permission-sql.ts`
- Modify: `packages/iam-admin/src/user-detail-query.mapping.ts`
- Modify: `packages/iam-admin/src/user-detail-query.mapping.test.ts`
- Modify: `packages/iam-admin/src/user-detail-query.test.ts`
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/users/*`

- [ ] **Step 1: Failing Transparenztests für instanzweite Rechte mit Org-Membership schreiben**

Zieltest:
```ts
expect(mapped.permissions).toContainEqual(
  expect.objectContaining({
    action: 'media.read',
    organizationId: undefined,
  })
);
```

Run:
```bash
pnpm nx run iam-admin:test:unit --testFiles=src/user-detail-query.mapping.test.ts --testFiles=src/user-detail-query.test.ts
```

Expected:
- FAIL, weil die SQL-Projektion heute `ao.organization_id` breit an Rollen-Permissions hängt.

- [ ] **Step 2: Transparenzvertrag um Semantikfelder ergänzen**

Zielcode:
```ts
readonly runtimeScope?: 'instance' | 'record' | 'organization_context';
readonly inactiveReason?: string;
readonly inheritedFromOrganizationId?: string;
```

Wichtig:
- `inheritedFromOrganizationId` bleibt nur dort gesetzt, wo eine organisationsbezogene oder record-scoped Ableitung tatsächlich fachlich relevant ist.
- instanzweite Rechte sollen im Trace nicht mehr fälschlich wie org-gebundene Rechte aussehen.

- [ ] **Step 3: SQL-Projektion entkoppeln**

Zielrichtung:
```sql
CASE
  WHEN p.permission_key = ANY($record_scoped_keys) THEN ao.organization_id::text
  ELSE NULL::text
END AS organization_id
```

oder nach demselben Prinzip über eine zentral gepflegte Schlüsselmenge im Mapping-Pfad nachziehen, falls die SQL bewusst generisch bleiben soll.

- [ ] **Step 4: User-Detail-UI lesbar nachschärfen**

Zielanzeige:
- instanzweit
- datensatzbezogen (`all|own|organization`)
- organisationsvererbt
- inaktiv / abgelaufen / deaktiviert

Run:
```bash
pnpm nx run iam-admin:test:unit --testFiles=src/user-detail-query.mapping.test.ts --testFiles=src/user-detail-query.test.ts
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/users/**/*.test.tsx
```

Expected:
- PASS

### Task 7: Cleanup-Migration, Kompatibilitätsmodus und Betriebsnachweis

**Files:**
- Create: `packages/data/migrations/<next>_iam_scope_semantics_cleanup.sql`
- Modify: `docs/development/studio-db-schema-final.sql` (falls nötig)
- Modify: `docs/development/studio-db-schema.md` (falls nötig)
- Modify: `docs/guides/keycloak-tenant-realm-bootstrap.md`
- Modify: `docs/guides/iam-deployment-runbook.md`
- Modify: `docs/guides/iam-acceptance-runbook.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`

- [ ] **Step 1: Additive Cleanup-Migration und Repair-Regeln definieren**

Pflichten:
- keine harte Löschung produktiver Rollenartefakte ohne Voranalyse
- tenantseitige `instance_registry_admin`-Artefakte als Legacy markieren oder gezielt bereinigen
- Standardrollen nicht blind löschen, sondern aus dem Sollmodell herausnehmen
- Rollback-/Repair-Pfad dokumentieren

- [ ] **Step 2: Betriebs- und Performance-Nachweise ergänzen**

Pflichtpunkte:
- Snapshot-/Cache-Pfad bleibt mit `organizationId`-dimensionierten Keys performant
- kein zusätzlicher DB-Roundtrip im `cache hit`-Pfad
- relevanter `authorize`-/Cache-Nachweis wird im Runbook bzw. Acceptance-Runbook ergänzt
- Monitoring-/Alerting-Beschreibung für neue Scope-Semantik und Drift-Fälle ist nachvollziehbar

- [ ] **Step 3: Server-Runtime- und Gate-Pfade ausführen**

Run:
```bash
pnpm check:server-runtime
pnpm nx affected --target=test:types --base=origin/main
pnpm nx affected --target=test:unit --base=origin/main
```

Expected:
- PASS

### Task 8: Dauerhafte Architektur- und Qualitätsdokumentation fortschreiben

**Files:**
- Modify: `docs/architecture/04-solution-strategy.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/09-architecture-decisions.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Create or Modify: `docs/architecture/decisions/ADR-0xx-iam-scope-semantics-and-role-separation.md`
- Modify: `docs/guides/iam-authorization-api-contract.md`
- Modify: `docs/guides/iam-service-api-dokumentation.md`

- [ ] **Step 1: Architekturentscheidungen dauerhaft verankern**

Pflichtpunkte:
- Instanz-First-Scope
- Organisation als optionaler Fachkontext
- drei Rechteklassen
- Root-only `instance_registry_admin`
- geschützte tenantlokale Sonderrolle `system_admin`
- Standardrollen nur Übergangskompatibilität

- [ ] **Step 2: Qualitätsanforderungen explizit fortschreiben**

Pflichtpunkte:
- Security: allowlist-basierte öffentliche Diagnostik, keine Scope-/PII-Leaks
- Datenschutz: Transparenzdaten bleiben fachlich nötig und datensparsam
- Performance: Cache-Hit-Pfad und Snapshot-Semantik werden nicht regressiv
- Modularität: neue Module müssen `runtimeScope` explizit klassifizieren
- Ausbaufähigkeit: spätere `own`-/`organization`-Einführung nur mit passendem Datenmodell

- [ ] **Step 3: ADR mit Migrations- und Restschuld-Entscheidungen dokumentieren**

Pflichtpunkte:
- warum `runtimeScope` explizit ist
- warum `accessScope` weiter nur für record-scoped Rechte gilt
- warum `media.*` und `waste-management.*` aktuell instanzweit bleiben
- welche Legacy-Reste bewusst in einen Folgechange verschoben werden dürfen

### Task 9: Abschlussverifikation und Restschulden markieren

**Files:**
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/tasks.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/tasks.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`

- [ ] **Step 1: Dokumentation auf explizite Scope-Klassen umstellen**

Pflichtpunkte:
- alle OpenSpec-Tasks spiegeln den tatsächlich umgesetzten Scope-/Cleanup-Stand
- dokumentierte Restschulden sind explizit als Folgechange markiert
- keine stillen Altmodellreste bleiben unkommentiert im Repo

- [ ] **Step 2: Kleinsten relevanten Gate-Pfad ausführen**

Run:
```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-authorization/permission-store.test.ts --testFiles=src/iam-authorization/me-permissions.test.ts --testFiles=src/iam-authorization/authorize.test.ts --testFiles=src/iam-media/server-authorization.test.ts --testFiles=src/waste-management/core/guard-branches.test.ts --testFiles=src/waste-management/core/read-handlers.test.ts --testFiles=src/iam-contents/request-context.test.ts
pnpm nx run iam-admin:test:unit --testFiles=src/managed-permissions.test.ts --testFiles=src/user-detail-query.mapping.test.ts --testFiles=src/user-detail-query.test.ts
pnpm nx run auth-runtime:test:types
pnpm check:server-runtime
pnpm nx affected --target=test:unit --base=origin/main
pnpm nx affected --target=test:types --base=origin/main
```

Expected:
- PASS

- [ ] **Step 3: OpenSpec und Diff-Qualität final prüfen**

Run:
```bash
openspec validate refactor-iam-platform-tenant-role-model --strict
openspec validate refactor-wp-005-iam-assignment-transparency --strict
git diff --check
```

Expected:
- PASS

## Self-Review

- Spec coverage:
  - `add-iam-scoped-role-permissions` bleibt die Baseline für `accessScope`.
  - `refactor-iam-platform-tenant-role-model` wird um die fehlende Instanz-vs-Org-Semantik ergänzt.
  - `refactor-wp-005-iam-assignment-transparency` deckt den Diagnose- und UI-Pfad ab.
  - Cleanup von Plattform-/Tenant-Resten, Seeds, Bootstrap und UI-Gates ist wieder explizit Teil des Plans.
- Placeholder scan:
  - Keine generischen "TODO"-Schritte; alle Tasks nennen Zielpfade, Commands und Erwartung.
- Type consistency:
  - Der Plan verwendet konsistent `runtimeScope = 'instance' | 'record' | 'organization_context'` als neue Metadatenklasse und belässt `accessScope = 'all' | 'own' | 'organization'` als bestehende Datensatz-Scope-Achse.
  - Verwaltete Permissions dürfen keinen stillen Fallback mehr erhalten; Klassifikation ist explizit und testpflichtig.
