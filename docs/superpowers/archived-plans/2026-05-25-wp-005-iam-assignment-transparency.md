# WP-005 IAM Assignment Transparency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `WP-005` technisch so abschließen, dass Vererbungs-/Restriktionspfade in der Admin-UI nachvollziehbar werden und Benutzer-Rollen/-Gruppen nicht mehr destruktiv per Lösch-/Neuaufbau überschrieben werden.

**Architecture:** Der Abschluss erfolgt über einen diff-basierten Assignment-Write-Pfad im bestehenden IAM-Update-Flow, einen erweiterten User-Detail-Transparenzvertrag und eine gezielte UI-Neustrukturierung in der Benutzer- und Gruppenverwaltung. Die bestehenden Rollen-, Gruppen- und Keycloak-Pfade bleiben erhalten; erweitert werden nur die für `WP-005` relevanten Lese-, Schreib- und Abnahmepfade.

**Tech Stack:** TypeScript strict mode, Nx, Vitest, React, TanStack Router, serverseitige IAM-Handler in `auth-runtime` und `iam-admin`, SQL-basierte Detailqueries, OpenSpec, arc42-Dokumentation.

---

## File Structure

- Modify: `packages/core/src/iam/account-management-contract.ts`
  Verantwortet den User-Detailvertrag; hier werden neue Transparenzfelder für Vererbung, Restriktion und Assignment-Wirkung normiert.
- Modify: `packages/core/src/iam/account-management-contract.test.ts`
  Sichert die Vertragsform und Beispielpayloads ab.
- Modify: `packages/iam-admin/src/user-detail-query.types.ts`
  Enthält die Row-Typen für den SQL-Detailpfad; muss um Transparenzfelder ergänzt werden.
- Modify: `packages/iam-admin/src/user-detail-permission-sql.ts`
  Baut den SQL-basierten Permission-Trace; hier werden zusätzliche semantische Felder und Statusgründe projiziert.
- Modify: `packages/iam-admin/src/user-detail-permission-sql.test.ts`
  Sichert SQL-Projektion und Fallback-Verhalten ab.
- Modify: `packages/iam-admin/src/user-detail-query.mapping.ts`
  Mappt SQL-Zeilen auf den Kernvertrag.
- Modify: `packages/iam-admin/src/user-update-persistence.ts`
  Hängt heute direkt an den ersetzenden Assignment-Helpern; wird auf den diff-basierten Persistenzpfad umgestellt.
- Modify: `packages/auth-runtime/src/iam-account-management/shared-assignment.ts`
  Enthält die bisherigen Lösch-/Neuaufbau-Helper; bleibt entweder als dünne Kompatibilitätsschicht oder wird intern auf den Planner umgebogen.
- Modify: `packages/auth-runtime/src/iam-account-management/shared-assignment.test.ts`
  Bestehende Tests müssen von „replace all“ auf diff-/Erhaltungssemantik umgestellt werden.
- Create: `packages/auth-runtime/src/iam-account-management/assignment-diff.ts`
  Kapselt den diff-basierten Änderungsplan für Rollen und Gruppen.
- Create: `packages/auth-runtime/src/iam-account-management/assignment-diff.test.ts`
  Sichert Erhalt, Hinzufügen, Entfernen und fachlich relevante Metadatenänderungen ab.
- Modify: `packages/auth-runtime/src/iam-account-management/user-update-plan.ts`
  Muss den bestehenden Zustand und den gewünschten Zielzustand so vorbereiten, dass der Planner sauber arbeiten kann.
- Modify: `packages/auth-runtime/src/iam-account-management/user-update-handler.ts`
  Muss den neuen Persistenzpfad end-to-end verdrahten.
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx`
  Wird zum Transparenzzentrum für direkte, vererbte und unwirksame Pfade.
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.test.tsx`
  Sichert die neue UI-Semantik ab.
- Modify: `apps/sva-studio-react/src/routes/admin/groups/-group-detail-page.tsx`
  Bleibt operativer Membership-Pflegepfad; ergänzt sichtbare Metadaten und klare Zuständigkeit.
- Modify: `apps/sva-studio-react/src/routes/admin/groups/-group-detail-page.test.tsx`
  Sichert Membership-Transparenz und UI-Verhalten ab.
- Create or modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/{proposal.md,tasks.md,specs/...}`
  Formale OpenSpec-Änderung für Verhaltens-, Vertrags- und ggf. Schemaänderungen.
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/10-quality-requirements.md`
  Architekturdoku für den neuen Assignment-Write-Pfad und Transparenzvertrag.
- Create: `docs/reports/wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md`
  Deutsches Abnahmedokument mit normierten Konfliktfällen.

### Task 1: OpenSpec und Abnahmerahmen formalisieren

**Files:**
- Create: `openspec/changes/refactor-wp-005-iam-assignment-transparency/proposal.md`
- Create: `openspec/changes/refactor-wp-005-iam-assignment-transparency/tasks.md`
- Create: `openspec/changes/refactor-wp-005-iam-assignment-transparency/specs/account-ui/spec.md`
- Create: `openspec/changes/refactor-wp-005-iam-assignment-transparency/specs/iam-access-control/spec.md`
- Create: `openspec/changes/refactor-wp-005-iam-assignment-transparency/specs/iam-core/spec.md`
- Test: `openspec validate refactor-wp-005-iam-assignment-transparency --strict`

- [x] **Step 1: Entwurf für die OpenSpec-Änderung als Delta schreiben**

```md
# Change: WP-005 IAM-Zuweisungen und Vererbungs-Transparenz abschließen

## Why
Die aktuelle IAM-Administration verliert beim Bearbeiten von Rollen- und Gruppenzuweisungen fachliche Assignment-Metadaten und zeigt Vererbungs- und Restriktionspfade nicht vollständig nachvollziehbar an.

## What Changes
- diff-basierter Write-Pfad für Benutzer-Rollen und Benutzer-Gruppen
- strukturierter Transparenzvertrag für direkte, vererbte und blockierte Rechte
- UI-Nachschärfung für User- und Group-Detail
- normierte Konflikt- und Abnahmefälle für WP-005
```

- [x] **Step 2: Spec-Deltas mit mindestens je einem Szenario pro Requirement schreiben**

```md
## MODIFIED Requirements
### Requirement: Sichtbare Gruppenherkunft in IAM-Transparenzdaten
Das System SHALL im Benutzerdetail nicht nur Quellen, sondern auch organisations- und geo-bezogene Vererbungs- und Restriktionsgründe strukturiert bereitstellen.

#### Scenario: Geo-Vererbung mit Child-Deny bleibt nachvollziehbar
- **WHEN** eine Parent-Freigabe über eine Geo-Hierarchie wirksam wäre, aber eine untergeordnete Restriktion greift
- **THEN** zeigt das Benutzerdetail sowohl die geerbte Herkunft als auch den blockierenden Restriktionsgrund
```

- [x] **Step 3: OpenSpec-Änderung validieren**

Run:

```bash
openspec validate refactor-wp-005-iam-assignment-transparency --strict
```

Expected:

```text
Validation passed
```

- [x] **Step 4: Deutsches WP-005-Abnahmedokument als Stub anlegen**

```md
# WP-005 Abnahme: Rollen- und Rechtemanagement via Keycloak

## Nachweisrahmen

- Mehrfachherkunft direkt + Gruppe
- deaktivierte oder soft-gelöschte Gruppen
- Gültigkeitsfenster von Mitgliedschaften
- Geo Parent-Allow mit Child-Deny
- instanzfremde Gruppen- oder Geo-Daten
```

- [x] **Step 5: Änderungen committen**

```bash
git add openspec/changes/refactor-wp-005-iam-assignment-transparency docs/reports/wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md
git commit -m "spec: formalize wp-005 assignment transparency change"
```

### Task 2: Transparenzvertrag und Admin-Read-Modell erweitern

**Files:**
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `packages/core/src/iam/account-management-contract.test.ts`
- Modify: `packages/iam-admin/src/user-detail-query.types.ts`
- Modify: `packages/iam-admin/src/user-detail-permission-sql.ts`
- Modify: `packages/iam-admin/src/user-detail-permission-sql.test.ts`
- Modify: `packages/iam-admin/src/user-detail-query.mapping.ts`
- Test: `packages/core/src/iam/account-management-contract.test.ts`
- Test: `packages/iam-admin/src/user-detail-permission-sql.test.ts`

- [x] **Step 1: Failing Contract-Test für neue Transparenzfelder ergänzen**

```ts
it('supports inheritance and restriction metadata on permission trace items', () => {
  const entry: IamUserPermissionTraceItem = {
    permissionKey: 'content.read',
    action: 'content.read',
    resourceType: 'content',
    effect: 'allow',
    isEffective: false,
    status: 'disabled',
    sourceKind: 'group_role',
    inheritedFromOrganizationId: 'org-root',
    inheritedFromGeoUnitId: 'geo-root',
    restrictedByGeoUnitId: 'geo-child',
    inactiveReason: 'group_disabled',
  };

  expect(entry.inheritedFromOrganizationId).toBe('org-root');
  expect(entry.restrictedByGeoUnitId).toBe('geo-child');
});
```

- [x] **Step 2: SQL-Test für die neue Projektion schreiben**

```ts
it('projects inheritance and inactive-reason fields into the permission trace', () => {
  const sql = buildPermissionTraceRowsSql(true, true);

  expect(sql).toContain("'inherited_from_organization_id'");
  expect(sql).toContain("'inherited_from_geo_unit_id'");
  expect(sql).toContain("'restricted_by_geo_unit_id'");
  expect(sql).toContain("'inactive_reason'");
});
```

- [x] **Step 3: Vertrag und Mapping minimal erweitern**

```ts
export type IamUserPermissionTraceItem = {
  readonly permissionKey: string;
  readonly action: string;
  readonly resourceType: string;
  readonly effect: IamPermissionEffect;
  readonly isEffective: boolean;
  readonly status: IamUserPermissionTraceStatus;
  readonly sourceKind: IamUserPermissionTraceSourceKind;
  readonly inheritedFromOrganizationId?: IamUuid;
  readonly inheritedFromGeoUnitId?: IamUuid;
  readonly restrictedByGeoUnitId?: IamUuid;
  readonly inactiveReason?: 'group_disabled' | 'membership_not_started' | 'membership_expired' | 'hierarchy_restricted';
};
```

- [x] **Step 4: SQL-Projektion und Mapping auf die neuen Felder umstellen**

```ts
const mapPermissionTraceRows = (
  permissionTraceRows: UserDetailPermissionTraceRow[] | null
): IamUserPermissionTraceItem[] =>
  permissionTraceRows?.map((entry) => ({
    permissionKey: entry.permission_key,
    action: entry.action,
    resourceType: entry.resource_type,
    effect: entry.effect,
    isEffective: entry.is_effective,
    status: entry.status,
    sourceKind: entry.source_kind,
    inheritedFromOrganizationId: entry.inherited_from_organization_id ?? undefined,
    inheritedFromGeoUnitId: entry.inherited_from_geo_unit_id ?? undefined,
    restrictedByGeoUnitId: entry.restricted_by_geo_unit_id ?? undefined,
    inactiveReason: entry.inactive_reason ?? undefined,
  })) ?? [];
```

- [x] **Step 5: Gezielte Tests grün laufen lassen**

Run:

```bash
pnpm nx run core:test:unit --testFiles=src/iam/account-management-contract.test.ts
pnpm nx run iam-admin:test:unit --testFiles=src/user-detail-permission-sql.test.ts
```

Expected:

```text
PASS  packages/core/src/iam/account-management-contract.test.ts
PASS  packages/iam-admin/src/user-detail-permission-sql.test.ts
```

- [x] **Step 6: Änderungen committen**

```bash
git add packages/core/src/iam/account-management-contract.ts packages/core/src/iam/account-management-contract.test.ts packages/iam-admin/src/user-detail-query.types.ts packages/iam-admin/src/user-detail-permission-sql.ts packages/iam-admin/src/user-detail-permission-sql.test.ts packages/iam-admin/src/user-detail-query.mapping.ts
git commit -m "feat: extend wp-005 permission transparency contract"
```

### Task 3: Diff-basierten Assignment-Write-Pfad einführen

**Files:**
- Create: `packages/auth-runtime/src/iam-account-management/assignment-diff.ts`
- Create: `packages/auth-runtime/src/iam-account-management/assignment-diff.test.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/shared-assignment.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/shared-assignment.test.ts`
- Modify: `packages/iam-admin/src/user-update-persistence.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/user-update-plan.ts`
- Modify: `packages/iam-admin/src/user-update-persistence.test.ts`
- Test: `packages/auth-runtime/src/iam-account-management/assignment-diff.test.ts`
- Test: `packages/auth-runtime/src/iam-account-management/shared-assignment.test.ts`
- Test: `packages/iam-admin/src/user-update-persistence.test.ts`

- [x] **Step 1: Failing Planner-Test für Erhalt identischer Gruppenzuweisungen schreiben**

```ts
it('keeps an unchanged group assignment instead of deleting and recreating it', async () => {
  const plan = buildGroupAssignmentPlan({
    existing: [
      { groupId: 'group-1', origin: 'manual', validFrom: '2026-03-01T10:00:00.000Z', validTo: undefined },
    ],
    requestedGroupIds: ['group-1'],
  });

  expect(plan.toKeep).toEqual([
    { groupId: 'group-1', origin: 'manual', validFrom: '2026-03-01T10:00:00.000Z', validTo: undefined },
  ]);
  expect(plan.toInsert).toEqual([]);
  expect(plan.toDelete).toEqual([]);
});
```

- [x] **Step 2: Failing Persistence-Test gegen den alten Replace-All-Pfad ergänzen**

```ts
it('does not issue DELETE FROM iam.account_groups when the requested group set is unchanged', async () => {
  const { client, calls } = createClient();

  await persistGroupAssignments(client as never, {
    instanceId: 'instance-1',
    accountId: 'account-1',
    existingAssignments: [
      { groupId: 'group-1', origin: 'manual', validFrom: '2026-03-01T10:00:00.000Z' },
    ],
    requestedGroupIds: ['group-1'],
  });

  expect(calls.some((call) => call.sql.includes('DELETE FROM iam.account_groups'))).toBe(false);
});
```

- [x] **Step 3: Minimalen Planner und nicht-destruktive Persistenzfunktion implementieren**

```ts
export const buildGroupAssignmentPlan = (input: {
  existing: readonly ExistingGroupAssignment[];
  requestedGroupIds: readonly string[];
}): GroupAssignmentPlan => {
  const requestedIds = new Set(input.requestedGroupIds);
  const existingById = new Map(input.existing.map((entry) => [entry.groupId, entry] as const));

  return {
    toKeep: input.existing.filter((entry) => requestedIds.has(entry.groupId)),
    toInsert: input.requestedGroupIds.filter((groupId) => !existingById.has(groupId)),
    toDelete: input.existing.filter((entry) => !requestedIds.has(entry.groupId)).map((entry) => entry.groupId),
  };
};
```

- [x] **Step 4: User-Update-Persistenz auf Planner statt Replace-All umstellen**

```ts
if (input.payload.groupIds) {
  await deps.persistGroupAssignments(client, {
    instanceId: input.instanceId,
    accountId: input.userId,
    existingAssignments: input.existing.groups ?? [],
    requestedGroupIds: input.payload.groupIds,
    actorAccountId: input.actorAccountId,
  });
}
```

- [x] **Step 5: Gezielte Tests und frühe Runtime-/Type-Gates ausführen**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-account-management/assignment-diff.test.ts --testFiles=src/iam-account-management/shared-assignment.test.ts
pnpm nx run iam-admin:test:unit --testFiles=src/user-update-persistence.test.ts
pnpm nx run auth-runtime:test:types
pnpm nx run core:check:runtime
pnpm nx run auth-runtime:check:runtime
```

Expected:

```text
PASS  packages/auth-runtime/src/iam-account-management/assignment-diff.test.ts
PASS  packages/auth-runtime/src/iam-account-management/shared-assignment.test.ts
PASS  packages/iam-admin/src/user-update-persistence.test.ts
```

- [x] **Step 6: Änderungen committen**

```bash
git add packages/auth-runtime/src/iam-account-management/assignment-diff.ts packages/auth-runtime/src/iam-account-management/assignment-diff.test.ts packages/auth-runtime/src/iam-account-management/shared-assignment.ts packages/auth-runtime/src/iam-account-management/shared-assignment.test.ts packages/auth-runtime/src/iam-account-management/user-update-plan.ts packages/iam-admin/src/user-update-persistence.ts packages/iam-admin/src/user-update-persistence.test.ts
git commit -m "feat: preserve wp-005 user assignments with diff planning"
```

### Task 4: Handler- und Update-Flow end-to-end verdrahten

**Files:**
- Modify: `packages/auth-runtime/src/iam-account-management/user-update-handler.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/user-update-plan.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/user-update-plan.test.ts`
- Modify: `packages/iam-admin/src/user-update-handler.test.ts`
- Test: `packages/auth-runtime/src/iam-account-management/user-update-plan.test.ts`
- Test: `packages/iam-admin/src/user-update-handler.test.ts`

- [x] **Step 1: Failing Plan-Test für fail-closed bei nicht abbildbarer Assignment-Änderung schreiben**

```ts
it('rejects updates that would overwrite protected assignment metadata without an explicit mapping rule', async () => {
  await expect(
    resolveUserUpdatePlan(client, {
      instanceId: 'instance-1',
      actorSubject: 'kc-actor-1',
      actorRoles: ['system_admin'],
      userId: 'user-1',
      payload: { groupIds: ['group-1'] },
    })
  ).rejects.toThrow('assignment_metadata_conflict');
});
```

- [x] **Step 2: Handler-Test für den neuen Update-Pfad ergänzen**

```ts
it('returns the updated detail with preserved group metadata after a user update', async () => {
  const response = await updateUserInternal(request);
  const body = await response.json();

  expect(body.data.groups).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        groupId: 'group-1',
        origin: 'manual',
        validFrom: '2026-03-01T10:00:00.000Z',
      }),
    ])
  );
});
```

- [x] **Step 3: Update-Plan und Handler minimal verdrahten**

```ts
export type UserUpdatePlan = {
  existing: IamUserDetail;
  previousRoleNames: readonly string[];
  nextRoleNames?: readonly string[];
  assignmentWriteMode: 'diff_preserving';
};
```

- [x] **Step 4: End-to-end-Tests laufen lassen**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-account-management/user-update-plan.test.ts
pnpm nx run iam-admin:test:unit --testFiles=src/user-update-handler.test.ts
pnpm nx run auth-runtime:test:types
```

Expected:

```text
PASS  packages/auth-runtime/src/iam-account-management/user-update-plan.test.ts
PASS  packages/iam-admin/src/user-update-handler.test.ts
```

- [x] **Step 5: Änderungen committen**

```bash
git add packages/auth-runtime/src/iam-account-management/user-update-handler.ts packages/auth-runtime/src/iam-account-management/user-update-plan.ts packages/auth-runtime/src/iam-account-management/user-update-plan.test.ts packages/iam-admin/src/user-update-handler.test.ts
git commit -m "feat: wire wp-005 assignment-preserving update flow"
```

### Task 5: User- und Group-UI für Transparenz und Zuständigkeit nachschärfen

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/groups/-group-detail-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/groups/-group-detail-page.test.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`
- Test: `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.test.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/groups/-group-detail-page.test.tsx`

- [x] **Step 1: Failing UI-Test für Vererbungs- und Restriktionshinweise schreiben**

```tsx
it('renders inherited and blocked permission paths with explicit reasons', () => {
  useUserMock.mockReturnValue({
    user: {
      ...baseUser,
      permissionTrace: [
        {
          permissionKey: 'content.read',
          action: 'content.read',
          resourceType: 'content',
          effect: 'allow',
          isEffective: true,
          status: 'effective',
          sourceKind: 'group_role',
          inheritedFromOrganizationId: 'org-root',
          inheritedFromGeoUnitId: 'geo-root',
        },
        {
          permissionKey: 'content.publish',
          action: 'content.publish',
          resourceType: 'content',
          effect: 'deny',
          isEffective: false,
          status: 'disabled',
          sourceKind: 'group_role',
          restrictedByGeoUnitId: 'geo-child',
          inactiveReason: 'hierarchy_restricted',
        },
      ],
    },
  });

  render(<UserEditPage userId="user-1" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Berechtigungen' }));

  expect(screen.getByText(/Vererbt von Organisation: org-root/)).toBeTruthy();
  expect(screen.getByText(/Vererbt von Geo-Einheit: geo-root/)).toBeTruthy();
  expect(screen.getByText(/Blockiert durch Geo-Einheit: geo-child/)).toBeTruthy();
});
```

- [x] **Step 2: Failing UI-Test für sichtbare bestehende Assignment-Metadaten schreiben**

```tsx
it('shows preserved group membership metadata in the management section', () => {
  render(<UserEditPage userId="user-1" />);

  fireEvent.click(screen.getByRole('tab', { name: 'Verwaltung' }));

  expect(screen.getByText(/Herkunft: manual/)).toBeTruthy();
  expect(screen.getByText(/Gültig ab:/)).toBeTruthy();
});
```

- [x] **Step 3: User-Detail in getrennte Transparenzblöcke umstrukturieren**

```tsx
const effectiveInheritedTrace = effectivePermissionTrace.filter(
  (entry) => entry.inheritedFromOrganizationId || entry.inheritedFromGeoUnitId
);
const blockedTrace = inactivePermissionTrace.filter(
  (entry) => entry.restrictedByGeoUnitId || entry.inactiveReason
);
```

- [x] **Step 4: Group-Detail als Membership-Feinpflegepfad klarer markieren**

```tsx
<p className="text-sm text-muted-foreground">
  {t('admin.groups.memberships.ownershipHint')}
</p>
```

- [x] **Step 5: Route-Tests und Type-Check ausführen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routes/admin/users/-user-edit-page.test.tsx --testFiles=src/routes/admin/groups/-group-detail-page.test.tsx
pnpm nx run sva-studio-react:test:types
pnpm nx run sva-studio-react:check:i18n
```

Expected:

```text
PASS  apps/sva-studio-react/src/routes/admin/users/-user-edit-page.test.tsx
PASS  apps/sva-studio-react/src/routes/admin/groups/-group-detail-page.test.tsx
```

- [x] **Step 6: Änderungen committen**

```bash
git add apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx apps/sva-studio-react/src/routes/admin/users/-user-edit-page.test.tsx apps/sva-studio-react/src/routes/admin/groups/-group-detail-page.tsx apps/sva-studio-react/src/routes/admin/groups/-group-detail-page.test.tsx apps/sva-studio-react/src/i18n/resources.ts
git commit -m "feat: clarify wp-005 assignment and inheritance ui"
```

### Task 6: Architektur-, Abnahme- und Abschlussverifikation fertigziehen

**Files:**
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Modify: `docs/reports/wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md`
- Test: affected Nx unit/type targets

- [x] **Step 1: Architekturstellen mit dem neuen Assignment- und Transparenzpfad aktualisieren**

```md
- Benutzer-Assignments werden im IAM-Update-Pfad diff-basiert geplant und nur gezielt mutiert.
- Das Benutzerdetail liefert strukturierte Transparenzdaten für direkte, vererbte und blockierte Rechte.
```

- [x] **Step 2: WP-005-Abnahmedokument mit den normierten Nachweisen füllen**

```md
## Abgedeckte Konfliktfälle

- Mehrfachherkunft direkt + Gruppe: automatisierter Unit-/UI-Nachweis vorhanden
- deaktivierte Gruppe: automatisierter Trace- und UI-Nachweis vorhanden
- Gültigkeitsfenster: Gruppen-Detail und User-Detail zeigen unwirksame Pfade mit Grund
- Geo Parent-Allow mit Child-Deny: Engine- und Transparenznachweis vorhanden
- instanzfremde Gruppen- oder Geo-Daten: negativer Server-Test vorhanden
```

- [x] **Step 3: Vollständige betroffene Gates ausführen**

Run:

```bash
pnpm nx run core:test:unit --testFiles=src/iam/account-management-contract.test.ts --testFiles=src/iam/authorization-engine.test.ts
pnpm nx run iam-admin:test:unit --testFiles=src/user-detail-permission-sql.test.ts --testFiles=src/user-update-persistence.test.ts --testFiles=src/user-update-handler.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-account-management/assignment-diff.test.ts --testFiles=src/iam-account-management/shared-assignment.test.ts --testFiles=src/iam-account-management/user-update-plan.test.ts
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routes/admin/users/-user-edit-page.test.tsx --testFiles=src/routes/admin/groups/-group-detail-page.test.tsx
pnpm nx run core:test:types
pnpm nx run iam-admin:test:types
pnpm nx run auth-runtime:test:types
pnpm nx run sva-studio-react:test:types
pnpm nx run core:check:runtime
pnpm nx run auth-runtime:check:runtime
pnpm nx run iam-admin:check:runtime
pnpm nx run sva-studio-react:check:i18n
```

Expected:

```text
All targeted unit tests PASS
All targeted type checks PASS
Runtime checks PASS
I18n check PASS
```

- [x] **Step 4: Optionales PR-Gate für den finalen Push nachziehen**

Run:

```bash
pnpm test:pr
```

Expected:

```text
PR gate finished successfully
```

- [x] **Step 5: Abschlusscommit erstellen**

```bash
git add docs/architecture/05-building-block-view.md docs/architecture/06-runtime-view.md docs/architecture/08-cross-cutting-concepts.md docs/architecture/10-quality-requirements.md docs/reports/wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md
git commit -m "docs: finalize wp-005 assignment transparency closeout"
```

## Self-Review

- Spec coverage:
  - diff-basierter Assignment-Write-Pfad: Task 3 und 4
  - Transparenzvertrag und strukturierter Read-Pfad: Task 2
  - User-/Group-UI-Zuschnitt: Task 5
  - Abnahme- und Nachweisschicht: Task 1 und 6
- Placeholder scan:
  - keine `TODO`-/`TBD`-Marker im Plan
  - alle Schritte enthalten konkrete Dateien, Befehle und Codebeispiele
- Type consistency:
  - neue Trace-Felder sind zwischen `account-management-contract`, SQL-Row-Typen, Mapping und UI durchgängig benannt
  - diff-basierter Write-Pfad ist als eigener Planner benannt und in Persistenz/Handler konsistent referenziert
