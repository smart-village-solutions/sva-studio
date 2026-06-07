# IAM Platform/Tenant Role Model Refactor Implementation Plan

**Status:** Abgeschlossen im aktuellen Codestand auf `main`. Die in diesem Plan beschriebenen Root-/Tenant-Trennung, Seed-/Bootstrap-Bereinigung, permission-zentrierten Guards und die zugehörige Dokumentation wurden mit PR `#510` umgesetzt. Die Datei liegt nur noch als Umsetzungsnachweis im Archiv; offene Folgearbeit gehört in den Scope-Semantik-Folgeplan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Root- und Tenant-Rollenmodell sauber trennen, `instance_registry_admin` auf den Root-Realm begrenzen, `system_admin` als einzige geschützte Tenant-Defaultrolle beibehalten und tenantlokale Rechte von kanonischen Standardrollen entkoppeln.

**Architecture:** Die Umsetzung erfolgt in zwei Strängen, die erst am Ende zusammengeführt werden: Zuerst werden Plattform-/Tenant-Scope, Provisioning und Systemrollen normativ getrennt. Danach wird die tenantseitige Rechtebasis von Standardrollen auf individuell verwaltbare Rollen und Gruppen verlagert. `roleLevel` bleibt in dieser Phase kompatibel bestehen, wird aber aus neuen Entscheidungen herausgedrängt.

**Tech Stack:** TypeScript strict mode, Nx Monorepo, pnpm, Keycloak Admin API, Zod, TanStack Router, React, Postgres/SQL-Migrationspfade, OpenSpec, arc42-Dokumentation

---

### Task 1: Change-Guardrails und Zielbild festziehen

**Files:**
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/proposal.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/design.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/tasks.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/specs/iam-core/spec.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/specs/iam-access-control/spec.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/specs/instance-provisioning/spec.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/specs/account-ui/spec.md`

- [ ] **Step 1: OpenSpec-Change gegen aktuelle Spezifikationen spiegeln**

Prüfen:
- `openspec show iam-core --type spec`
- `openspec show iam-access-control --type spec`
- `openspec show instance-provisioning --type spec`
- `openspec show account-ui --type spec`

Erwartung:
- Root-/Tenant-Trennung, Sonderrollen, Modulrechte und UI-Gates sind widerspruchsfrei beschrieben.

- [ ] **Step 2: Strict-Validation des Changes ausführen**

Run:
```bash
openspec validate refactor-iam-platform-tenant-role-model --strict
```

Expected:
- `Validated` ohne formale Spec-Fehler.

- [ ] **Step 3: Architekturfolgen dokumentieren**

Inhaltlich fortschreiben:
- `docs/architecture/04-solution-strategy.md`
- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/09-architecture-decisions.md`

Pflichtpunkte:
- Root-Realm und Tenant-Realm sind getrennte Identitätsräume.
- `instance_registry_admin` ist Root-only.
- `system_admin` ist tenantseitige Sonderrolle.
- Modulrechte sind permission-zentriert statt standardrollen-zentriert.
- Die bewusste Abweichung zum bisherigen Konzept, wonach frühere Tenant-Standardrollen (`editor`, `designer`, `app_manager` usw.) nicht länger als geschützte System-Rollen gelten, wird explizit in einer ADR dokumentiert statt stillschweigend umgesetzt.

### Task 2: Plattform-/Tenant-Scope in Core- und Runtime-Verträgen trennen

**Files:**
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/platform-iam.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/platform-iam-roles.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/profile-handlers.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/constants.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/platform-iam.test.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/profile-handlers.test.ts`

- [ ] **Step 1: Plattformrollen-Projektion auf Root-Sonderrolle reduzieren**

Zielcode:
```ts
export const PLATFORM_ROOT_ROLE = 'instance_registry_admin';

const PLATFORM_PROFILE_ROLES = new Set([PLATFORM_ROOT_ROLE]);

export const PLATFORM_ROLE_LEVEL_BY_NAME: Readonly<Record<string, number>> = {
  [PLATFORM_ROOT_ROLE]: 90,
};
```

Wirkung:
- Plattformprojektionen kennen keine tenantseitigen Standardrollen mehr.
- `system_admin` taucht nicht mehr im Root-Profilpfad auf.

- [ ] **Step 2: Plattform-Tests zuerst rot ziehen**

Run:
```bash
pnpm nx run auth-runtime:test:unit --testFiles=packages/auth-runtime/src/iam-account-management/platform-iam.test.ts --testFiles=packages/auth-runtime/src/iam-account-management/profile-handlers.test.ts
```

Expected:
- Fails auf veralteten Erwartungen zu `system_admin` im Plattformkontext.

- [ ] **Step 3: Plattform-Projektion minimal implementieren**

Implementationspunkte:
- `mapPlatformUser(...)` projiziert nur `instance_registry_admin`, wenn vorhanden.
- `buildPlatformRoleAssignments(...)` akzeptiert nur Root-Rollen.
- Plattform-Self-Service verwendet keine tenantlokalen Rollennamen.

- [ ] **Step 4: Slice erneut ausführen**

Run:
```bash
pnpm nx run auth-runtime:test:unit --testFiles=packages/auth-runtime/src/iam-account-management/platform-iam.test.ts --testFiles=packages/auth-runtime/src/iam-account-management/profile-handlers.test.ts
```

Expected:
- PASS

### Task 3: Tenant-Seeds und Provisioning von instance_registry_admin bereinigen

**Files:**
- Modify: `packages/data/src/iam/seed-plan.ts`
- Modify: `packages/data/src/iam/seed-plan.test.ts`
- Modify: `packages/data/seeds/0001_iam_personas.sql`
- Modify: `packages/data-repositories/src/iam/seed-plan.personas.ts`
- Modify: `packages/instance-registry/src/provisioning-auth-state.ts`
- Modify: `packages/instance-registry/src/provisioning-auth-state.test.ts`
- Modify: `packages/instance-registry/src/service-keycloak-run-steps.ts`
- Modify: `packages/instance-registry/src/provisioning-auth.test.ts`
- Modify: `packages/instance-registry/src/provisioning-auth-utils.ts`
- Modify: `packages/instance-registry/src/keycloak-checklist.ts`

- [ ] **Step 1: Tenant-seitige Persona-Quelle auf system_admin als einzige geschützte Defaultrolle umstellen**

Zielrichtung:
```ts
const personas: readonly PersonaSeed[] = [
  {
    personaKey: 'system_admin',
    roleSlug: 'system_admin',
    roleLevel: 100,
    // ...
  },
  // keine tenantseitige Persona instance_registry_admin mehr
];
```

- [ ] **Step 2: Root-Realm-Seeding und Root-Control-Plane-Vertrag explizit absichern**

Prüfen:
- `packages/instance-registry/src/provisioning-auth-utils.ts`
- `packages/instance-registry/src/keycloak-checklist.ts`
- `packages/data/seeds/0001_iam_personas.sql`

Regel:
- `instance_registry_admin` verschwindet nur aus tenantseitigen Personas und Tenant-Bootstrap-Pfaden.
- Root-Realm-Seeding, Root-Checklist und Root-Control-Plane-Projektion behalten die Rolle ausdrücklich bei.

Run:
```bash
pnpm nx run instance-registry:test:unit --testFiles=packages/instance-registry/src/provisioning-auth-state.test.ts --testFiles=packages/instance-registry/src/provisioning-auth.test.ts
```

Expected:
- FAIL nur auf tenantseitigen Altannahmen, nicht auf fehlendem Root-Realm-Contract.

- [ ] **Step 3: Provisioning-Tests für Tenant-Admin-Bootstrap erst brechen**

Run:
```bash
pnpm nx run instance-registry:test:unit --testFiles=packages/instance-registry/src/provisioning-auth-state.test.ts --testFiles=packages/instance-registry/src/provisioning-auth.test.ts
```

Expected:
- Fails, weil bisher `instance_registry_admin` im Tenant-Realm erwartet wird.

- [ ] **Step 4: Tenant-Admin-Bootstrap nur noch auf system_admin ausrichten**

Zielcode:
```ts
const syncTenantAdminAccess = async (userId: string) => {
  await client.syncRoles(userId, [SYSTEM_ADMIN_ROLE]);
};

return {
  tenantAdminExists: Boolean(tenantAdmin),
  tenantAdminHasSystemAdmin: tenantAdminRoles.includes(SYSTEM_ADMIN_ROLE),
  tenantAdminHasInstanceRegistryAdmin: false,
};
```

Wichtig:
- `tenantAdminHasInstanceRegistryAdmin` entweder entfernen oder als Legacy-Diagnose klar deprecaten.
- Kein Tenant-Realm-Drift mehr wegen fehlender Plattformrolle.

- [ ] **Step 5: Slice erneut ausführen**

Run:
```bash
pnpm nx run instance-registry:test:unit --testFiles=packages/instance-registry/src/provisioning-auth-state.test.ts --testFiles=packages/instance-registry/src/provisioning-auth.test.ts
```

Expected:
- PASS

### Task 4: Root-/Tenant-Guards und UI-Zugänge auseinanderziehen

**Files:**
- Modify: `apps/sva-studio-react/src/lib/iam-admin-access.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/constants.ts`
- Modify: `packages/data/src/iam/seed-plan.ts`
- Modify: `packages/data/src/iam/seed-plan.test.ts`
- Modify: `packages/iam-admin/src/organization-read-handlers.ts`
- Modify: `packages/iam-admin/src/group-read-handlers.ts`
- Modify: `packages/iam-admin/src/group-mutation-handlers.ts`
- Modify: `packages/iam-admin/src/organization-mutation-handlers.ts`
- Modify: `packages/iam-governance/src/governance-workflow-policy.ts`
- Test: `apps/sva-studio-react/src/hooks/use-*.test.tsx`

- [ ] **Step 1: Gate-Matrix inventarisieren**

Suchmuster:
```bash
rg -n "system_admin|app_manager|instance_registry_admin|ADMIN_ROLES" packages apps -g '!**/dist/**'
```

Erwartung:
- alle Rollennamen-Gates liegen als Liste pro Pfad vor.

- [ ] **Step 2: Root-Gates hart auf instance_registry_admin begrenzen**

Zielcode:
```ts
const ROOT_ADMIN_ROLES = new Set(['instance_registry_admin']);
const TENANT_ADMIN_ROLES = new Set(['system_admin', 'app_manager']);
```

Regel:
- Root-Instanzverwaltung, Root-Panel, Provisioning, Root-IAM-Reads: nur `instance_registry_admin`
- tenantseitige Org-/Group-/Role-Reads: keine Plattformrolle

- [ ] **Step 3: Tenant-Gates nicht mehr mit Plattformrolle kurzschließen**

Zielcode:
```ts
const hasInstanceRegistryAdminRole = (user: UserWithRoles | null | undefined) =>
  Boolean(!user?.roles ? false : user.roles.some((role) => role === 'instance_registry_admin'));
```

Anwendung:
- nur auf Root-Pfaden
- nicht in tenantlokalen Rollen-/Gruppen-/Nutzerseiten

- [ ] **Step 4: `instance.registry.manage` aus tenantfähigem Katalog und Tenant-Guards entfernen**

Zielrichtung:
```ts
// tenantseitige permissionKeys enthalten kein instance.registry.manage mehr
permissionKeys: permissions.map(([, key]) => key).filter((key) => key !== 'instance.registry.manage')
```

Regel:
- keine tenantseitige Persona oder Standardrolle darf `instance.registry.manage` tragen
- tenantlokale UI-/API-Pfade dürfen das Recht nicht mehr als wirksame Tenant-Berechtigung behandeln
- Requests bleiben fail-closed, wenn eine Tenant-Rolle versucht, Root-Control-Plane-Funktionalität zu modellieren

- [ ] **Step 5: Betroffene UI-/Handler-Tests anpassen**

Run:
```bash
pnpm nx affected --target=test:unit --base=origin/main
```

Expected:
- grüne betroffene IAM-/UI-Slices oder klarer Restbefund für den nächsten Task

### Task 5: Modul-IAM-Verträge von kanonischen Standardrollen entkoppeln

**Files:**
- Modify: `packages/studio-module-iam/src/index.ts`
- Modify: `packages/studio-module-iam/src/index.test.ts`
- Modify: `packages/data-repositories/src/instance-registry/index.ts`
- Modify: `packages/data-repositories/src/instance-registry/index.test.ts`
- Modify: `packages/instance-registry/src/service-helpers.ts`
- Modify: `packages/instance-registry/src/service.test.ts`

- [ ] **Step 1: Modulvertrag um eine permission-zentrierte tenantseitige Darstellung erweitern**

Zieltyp:
```ts
export type StudioModuleIamContract = Readonly<{
  moduleId: string;
  namespace: string;
  permissionIds: readonly string[];
  tenantBootstrapRoles?: readonly StudioModuleIamBootstrapRole[];
  rootSystemRoles?: readonly StudioModuleIamSystemRole[];
}>;
```

Regel:
- bestehende `systemRoles` der Modulverträge werden fachlich als `tenantBootstrapRoles` weitergeführt
- `rootSystemRoles` bleibt für tenantbezogene Module leer oder nur für echte Root-/Plattformpfade reserviert
- `tenantBootstrapRoles` ist nur Übergangskompatibilität
- fachlich führend bleibt `permissionIds`

- [ ] **Step 2: Instanz-Registry-Seeding entkoppeln**

Zielcode:
```ts
const permissionKeys = Array.from(new Set(contracts.flatMap((contract) => contract.permissionIds)));
// keine normative Erzeugung mehr aller tenantseitigen Standardrollen aus module contracts
```

Übergangsregel:
- `system_admin` erhält weiter alle aktiven Modulrechte.
- bestehende tenantseitige Standardrollen werden nur noch optional repariert, nicht mehr als Pflichtsoll erzeugt.

- [ ] **Step 3: Failing-Tests für alte Standardrollenerwartungen anpassen**

Run:
```bash
pnpm nx run studio-module-iam:test:unit
pnpm nx run data-repositories:test:unit --testFiles=packages/data-repositories/src/instance-registry/index.test.ts
```

Expected:
- FAIL auf alten `systemRoles`-Annahmen

- [ ] **Step 4: Minimalimplementierung und Re-Run**

Run:
```bash
pnpm nx run studio-module-iam:test:unit
pnpm nx run data-repositories:test:unit --testFiles=packages/data-repositories/src/instance-registry/index.test.ts
```

Expected:
- PASS

### Task 6: Tenant-Rollen-/Benutzerverwaltung auf individuelle Rollenbasis stabilisieren

**Files:**
- Modify: `packages/iam-admin/src/actor-authorization.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/user-update-plan.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/user-create-operation.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/schemas.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/roles/-roles-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/roles/-role-detail-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/roles/*.test.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/users/*.test.tsx`

- [ ] **Step 1: instance_registry_admin aus tenantseitigen Role-Pickers und User-Flows entfernen**

UI-Regel:
- Tenant-Rollenliste zeigt `instance_registry_admin` nie.
- Tenant-User-Edit bietet `instance_registry_admin` nicht als Auswahl an.

- [ ] **Step 2: system_admin-Sonderlogik explizit lassen, Standardrollen aber normalisieren**

Zielcode:
```ts
const PROTECTED_TENANT_ROLE_KEYS = new Set(['system_admin']);
```

Regel:
- Letztadmin-Schutz bleibt nur für `system_admin`.
- `editor`, `designer`, `app_manager` usw. werden nicht mehr als kanonische Schutzrollen behandelt.

- [ ] **Step 3: Role-Validation nicht auf Standardrollennamen aufbauen**

Zielrichtung:
- direkte Zuweisung beliebiger editierbarer tenantlokaler Rollen erlauben
- Schutz nur über `system_admin`, Read-only-Markierungen und später ggf. Permission-/Governance-Regeln

- [ ] **Step 4: UI-/Hook-Slices ausführen**

Run:
```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/roles/-roles-page.test.tsx --testFiles=src/routes/admin/roles/-role-detail-page.test.tsx --testFiles=src/routes/admin/users/-user-edit-page.test.tsx
```

Expected:
- PASS

### Task 7: Datenmigration und Kompatibilitätsmodus

**Files:**
- Create: `packages/data/migrations/<next>_iam_platform_tenant_role_split.sql`
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md`
- Modify: `docs/guides/keycloak-tenant-realm-bootstrap.md`
- Modify: `docs/development/runtime-profile-betrieb.md`

- [ ] **Step 1: Bestandsanalyse für Legacy-Rollen und Tenant-Artefakte erstellen**

Run:
```bash
rg -n "instance_registry_admin|app_manager|editor|designer|moderator|feature_manager|interface_manager" packages docs
```

Analysepflicht:
- Welche tenantseitigen Seeds, Runtime-Pfade und UI-Flows erwarten noch `instance_registry_admin`?
- Welche Standardrollen sind noch implizit normativ verdrahtet?
- Welche Artefakte können sofort bereinigt werden und welche brauchen nur Markierung/Repair?

Expected:
- eine dokumentierte Voranalyse liegt vor, bevor irgendeine Cleanup-Migration geschrieben wird

- [ ] **Step 2: Migrationsstrategie als additive Cleanup-Migration schreiben**

Pflichten:
- keine harte Löschung produktiver Rollen ohne Voranalyse
- tenantseitige `instance_registry_admin`-Artefakte markieren oder bereinigen
- optionale Legacy-Standardrollen nicht sofort löschen, sondern aus Sollmodell herausnehmen

Beispiel-SQL-Skizze:
```sql
UPDATE iam.roles
SET description = COALESCE(description, '') || ' [legacy-root-role-in-tenant]'
WHERE role_key = 'instance_registry_admin';
```

Hinweis:
- endgültige SQL anhand realer Tabellen- und Constraintlage schreiben, nicht blind übernehmen.

- [ ] **Step 3: Runtime-/Ops-Dokumentation anpassen**

Dokupunkte:
- Root-Realm und Tenant-Realm sind getrennt.
- `seed:system_admin` bleibt tenantseitige Reparaturreferenz.
- `instance_registry_admin` ist Root-only und kein tenantseitiger Repair-Pfad.

- [ ] **Step 4: Schema- und Type-Gates ausführen**

Run:
```bash
pnpm check:file-placement
pnpm check:server-runtime
pnpm nx affected --target=test:types --base=origin/main
```

Expected:
- PASS

### Task 8: Abschlussverifikation und Restschulden markieren

**Files:**
- Modify: `docs/architecture/09-architecture-decisions.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`
- Modify: `openspec/changes/refactor-iam-platform-tenant-role-model/tasks.md`

- [ ] **Step 1: Kleinsten echten Gate-Pfad komplett laufen lassen**

Run:
```bash
pnpm nx affected --target=test:unit --base=origin/main
pnpm nx affected --target=test:types --base=origin/main
```

Optional vor PR:
```bash
pnpm test:pr
```

Expected:
- grüne affected Gates oder dokumentierter Restblocker

- [ ] **Step 2: Restschulden explizit festhalten**

Pflichtpunkte:
- `roleLevel` noch vorhanden, aber Rückbaukandidat
- Legacy-Standardrollen ggf. noch sichtbar, aber nicht mehr normativ führend
- verbleibende rollennamenbasierte Governance-Gates als Folgechange markieren

- [ ] **Step 3: OpenSpec-Task-Status pflegen**

Run:
```bash
openspec validate refactor-iam-platform-tenant-role-model --strict
```

Expected:
- PASS

## Spec Coverage Self-Review

- `iam-core`: Root-/Tenant-Realm-Trennung, Root-only `instance_registry_admin`, tenantseitiges `system_admin` werden in Task 2 und Task 3 umgesetzt.
- `iam-access-control`: Plattformrecht `instance.registry.manage` und entkoppelte tenantseitige Modulrechte werden in Task 4, Task 5 und Task 6 umgesetzt.
- `instance-provisioning`: tenantseitiger Bootstrap ohne `instance_registry_admin` wird in Task 3 umgesetzt.
- `account-ui`: Ausblendung der Root-Rolle in Tenant-UI und individuelle Rechtezuordnung werden in Task 4 und Task 6 umgesetzt.

## Plan-Selbstcheck

- Keine offenen Platzhalter in den Umsetzungsschritten.
- Jede Phase benennt konkrete Dateien und Verifikationskommandos.
- `roleLevel` ist bewusst nicht Teil dieses Changes, sondern als dokumentierte Folgeschuld markiert.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-02-iam-platform-tenant-role-model-refactor.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
