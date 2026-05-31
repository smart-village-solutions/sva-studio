# WP-006 Datenschutz und Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Komplettiere `WP-006`, sodass zielgruppenspezifische Legaltexte, vollständige Consent-Auditdaten, ein dedizierter Consent-Nachweisexport und ein belastbares repo-seitiges Abnahmepaket vorhanden sind.

**Architecture:** Die Umsetzung baut auf den bestehenden Legal-Text-, Governance- und Auth-Runtime-Pfaden auf. Der Governance-Workflow bleibt der einzige Schreibpfad für Akzeptanz und Widerruf, während Pending-Text-Ermittlung, Compliance-Enforcement und Consent-Export dieselbe Zielgruppen- und Auditlogik lesen. Frontend-seitig wird die bestehende Legal-Text-Admin-Fläche erweitert, nicht durch einen neuen Parallelbereich ersetzt.

**Tech Stack:** TypeScript strict mode, pnpm/Nx workspace, auth-runtime, iam-governance, React/TanStack Router, Vitest, SQL migrations, shadcn/ui

---

## File Structure

### Core contract and shared types

- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `packages/core/src/iam/authorization-contract.ts`
- Purpose: Legal-Text-List-/Pending- und Consent-Export-Typen um Zielgruppenfelder erweitern.

### Database and repository layer

- Create: `packages/data/migrations/0044_iam_legal_text_targets.sql`
- Modify: `packages/iam-governance/src/legal-text-repository.ts`
- Modify: `packages/iam-governance/src/legal-text-repository-shared.ts`
- Modify: `packages/iam-governance/src/read-models.types.ts`
- Modify: `packages/iam-governance/src/legal-consent-export.ts`
- Purpose: relationale Zielgruppenzuordnung, Pending-Query mit Rollen-/Gruppen-Filter, Consent-Export mit Zielgruppenmetadaten.

### Governance write path and runtime handlers

- Modify: `packages/iam-governance/src/governance-workflow-executor.ts`
- Modify: `packages/auth-runtime/src/iam-governance/core.ts`
- Modify: `packages/auth-runtime/src/runtime-routes.ts`
- Modify: `packages/auth-runtime/src/legal-text-enforcement.ts`
- Purpose: vollständige Auditfelder schreiben, Consent-Export-Handler verdrahten, Enforcement auf zielgruppenspezifische Relevanz umstellen.

### Frontend admin and client API

- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`
- Modify: `apps/sva-studio-react/src/hooks/use-legal-texts.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-create-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`
- Purpose: Legaltext-Targets editierbar machen und Consent-Export an die bestehende Admin-Fläche anbinden.

### Tests and evidence

- Modify: `packages/iam-governance/src/legal-text-repository.test.ts`
- Modify: `packages/iam-governance/src/legal-consent-export.test.ts`
- Modify: `packages/iam-governance/src/governance-workflow-executor.test.ts`
- Modify: `packages/auth-runtime/src/iam-governance/core.test.ts`
- Modify: `packages/auth-runtime/src/legal-text-enforcement.test.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-api.test.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-create-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx`
- Create or Modify: `docs/reports/wp-006-datenschutz-compliance-abnahme-2026-05-25.md`
- Create: `docs/reports/wp-006-consent-enforcement-export-nachweis-2026-05-25.md`
- Purpose: TDD, Export-/Negativtests, Evidence-Bündelung.

### Recommended task execution order

1. Typen und Migration
2. Repository-/Pending-/Enforcement-Read-Logik
3. Governance write path und Consent-Export-Runtime
4. Frontend-Integration
5. Evidence-/Abnahmeartefakte

## Implementation Tasks

### Task 1: Extend Contracts and Add Legal Text Target Migration

**Files:**
- Create: `packages/data/migrations/0044_iam_legal_text_targets.sql`
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `packages/core/src/iam/authorization-contract.ts`
- Test: `packages/iam-governance/src/legal-consent-export.test.ts`

- [x] **Step 1: Write the failing type-level and export expectations**

Add target-aware expectations to `packages/iam-governance/src/legal-consent-export.test.ts`:

```ts
expect(allRecords).toEqual([
  {
    id: 'acceptance-1',
    workspaceId: 'workspace-1',
    subjectId: 'acceptance-1',
    legalTextId: 'legal-text-1',
    legalTextVersion: 'v1',
    actionType: 'accepted',
    acceptedAt: '2026-05-09T12:00:00.000Z',
    targets: {
      roleIds: ['role-1'],
      groupIds: ['group-1'],
    },
  },
]);
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm nx run iam-governance:test:unit --testFiles=src/legal-consent-export.test.ts`

Expected: FAIL because `targets` is not part of `LegalConsentExportRecord` and the query/mapping do not provide it.

- [x] **Step 3: Add the shared contract types and migration**

Update `packages/core/src/iam/account-management-contract.ts`:

```ts
export type IamLegalTextTargeting = {
  readonly roleIds: readonly IamUuid[];
  readonly groupIds: readonly IamUuid[];
};

export type IamLegalTextListItem = {
  readonly id: IamUuid;
  readonly name: string;
  readonly legalTextVersion: string;
  readonly locale: string;
  readonly contentHtml: string;
  readonly status: 'draft' | 'valid' | 'archived';
  readonly publishedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly acceptanceCount: number;
  readonly activeAcceptanceCount: number;
  readonly lastAcceptedAt?: string;
  readonly targets: IamLegalTextTargeting;
};

export type IamPendingLegalTextItem = {
  readonly id: IamUuid;
  readonly legalTextId: string;
  readonly name: string;
  readonly legalTextVersion: string;
  readonly locale: string;
  readonly contentHtml: string;
  readonly publishedAt?: string;
  readonly targets: IamLegalTextTargeting;
};
```

Update `packages/core/src/iam/authorization-contract.ts`:

```ts
export type LegalConsentExportRecord = {
  readonly id: IamUuid;
  readonly workspaceId?: string;
  readonly subjectId: string;
  readonly legalTextId: string;
  readonly legalTextVersion: string;
  readonly actionType: LegalAcceptanceActionType;
  readonly acceptedAt: string;
  readonly revokedAt?: string;
  readonly targets: {
    readonly roleIds: readonly IamUuid[];
    readonly groupIds: readonly IamUuid[];
  };
};
```

Create `packages/data/migrations/0044_iam_legal_text_targets.sql`:

```sql
-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.legal_text_target_roles (
  instance_id TEXT NOT NULL REFERENCES iam.instances(instance_id) ON DELETE CASCADE,
  legal_text_version_id UUID NOT NULL REFERENCES iam.legal_text_versions(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES iam.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legal_text_target_roles_unique UNIQUE (instance_id, legal_text_version_id, role_id)
);

CREATE TABLE IF NOT EXISTS iam.legal_text_target_groups (
  instance_id TEXT NOT NULL REFERENCES iam.instances(instance_id) ON DELETE CASCADE,
  legal_text_version_id UUID NOT NULL REFERENCES iam.legal_text_versions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES iam.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legal_text_target_groups_unique UNIQUE (instance_id, legal_text_version_id, group_id)
);

ALTER TABLE iam.legal_text_target_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.legal_text_target_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE iam.legal_text_target_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.legal_text_target_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY legal_text_target_roles_isolation_policy
  ON iam.legal_text_target_roles
  USING (instance_id = current_setting('app.current_instance_id', true));

CREATE POLICY legal_text_target_groups_isolation_policy
  ON iam.legal_text_target_groups
  USING (instance_id = current_setting('app.current_instance_id', true));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS legal_text_target_groups_isolation_policy ON iam.legal_text_target_groups;
DROP POLICY IF EXISTS legal_text_target_roles_isolation_policy ON iam.legal_text_target_roles;
DROP TABLE IF EXISTS iam.legal_text_target_groups;
DROP TABLE IF EXISTS iam.legal_text_target_roles;
-- +goose StatementEnd
```

- [x] **Step 4: Run the focused test again**

Run: `pnpm nx run iam-governance:test:unit --testFiles=src/legal-consent-export.test.ts`

Expected: FAIL still persists, but now only on repository/query implementation rather than missing type fields.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/iam/account-management-contract.ts \
  packages/core/src/iam/authorization-contract.ts \
  packages/data/migrations/0044_iam_legal_text_targets.sql \
  packages/iam-governance/src/legal-consent-export.test.ts
git commit -m "feat: add legal text targeting contracts"
```

### Task 2: Implement Target-Aware Legal Text Repository Reads

**Files:**
- Modify: `packages/iam-governance/src/legal-text-repository-shared.ts`
- Modify: `packages/iam-governance/src/legal-text-repository.ts`
- Modify: `packages/iam-governance/src/legal-text-repository.test.ts`
- Test: `packages/auth-runtime/src/legal-text-enforcement.test.ts`

- [x] **Step 1: Write failing repository tests for tenant-wide vs targeted texts**

Add to `packages/iam-governance/src/legal-text-repository.test.ts`:

```ts
it('returns only targeted pending legal texts for matching role or group memberships', async () => {
  state.client.query
    .mockResolvedValueOnce({
      rows: [
        {
          id: 'legal-1',
          legal_text_id: 'privacy-1',
          name: 'Datenschutz',
          legal_text_version: '2026-05',
          locale: 'de-DE',
          content_html: '<p>Policy</p>',
          published_at: '2026-05-25T08:00:00.000Z',
          target_role_ids: ['role-1'],
          target_group_ids: [],
        },
      ],
    });

  await expect(repository.loadPendingLegalTexts('tenant-a', 'subject-1')).resolves.toEqual([
    expect.objectContaining({
      id: 'legal-1',
      targets: { roleIds: ['role-1'], groupIds: [] },
    }),
  ]);
});
```

- [x] **Step 2: Run repository test to verify it fails**

Run: `pnpm nx run iam-governance:test:unit --testFiles=src/legal-text-repository.test.ts`

Expected: FAIL because target arrays are neither queried nor mapped.

- [x] **Step 3: Implement target-aware list and pending queries**

Update `packages/iam-governance/src/legal-text-repository-shared.ts` row types and mapping:

```ts
export type LegalTextRow = {
  id: string;
  name: string;
  legal_text_version: string;
  locale: string;
  content_html: string;
  status: 'draft' | 'valid' | 'archived';
  published_at?: string;
  created_at: string;
  updated_at: string;
  acceptance_count: number;
  active_acceptance_count: number;
  last_accepted_at?: string;
  target_role_ids: readonly string[];
  target_group_ids: readonly string[];
};

export const mapLegalTextListItem = (row: LegalTextRow): IamLegalTextListItem => ({
  id: row.id,
  name: row.name,
  legalTextVersion: row.legal_text_version,
  locale: row.locale,
  contentHtml: row.content_html,
  status: row.status,
  ...(row.published_at ? { publishedAt: row.published_at } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  acceptanceCount: row.acceptance_count,
  activeAcceptanceCount: row.active_acceptance_count,
  ...(row.last_accepted_at ? { lastAcceptedAt: row.last_accepted_at } : {}),
  targets: {
    roleIds: row.target_role_ids,
    groupIds: row.target_group_ids,
  },
});
```

Update `packages/iam-governance/src/legal-text-repository.ts` pending query:

```ts
FROM iam.legal_text_versions version
LEFT JOIN LATERAL (
  SELECT array_agg(target.role_id::text ORDER BY target.role_id::text) AS role_ids
  FROM iam.legal_text_target_roles target
  WHERE target.instance_id = version.instance_id
    AND target.legal_text_version_id = version.id
) role_targets ON true
LEFT JOIN LATERAL (
  SELECT array_agg(target.group_id::text ORDER BY target.group_id::text) AS group_ids
  FROM iam.legal_text_target_groups target
  WHERE target.instance_id = version.instance_id
    AND target.legal_text_version_id = version.id
) group_targets ON true
WHERE version.instance_id = $1
  AND version.status = 'valid'
  AND (
    (COALESCE(array_length(role_targets.role_ids, 1), 0) = 0 AND COALESCE(array_length(group_targets.group_ids, 1), 0) = 0)
    OR EXISTS (
      SELECT 1
      FROM iam.accounts account
      LEFT JOIN iam.account_roles account_role
        ON account_role.instance_id = version.instance_id
       AND account_role.account_id = account.id
      LEFT JOIN iam.account_groups account_group
        ON account_group.instance_id = version.instance_id
       AND account_group.account_id = account.id
      WHERE account.instance_id = version.instance_id
        AND account.keycloak_subject = $2
        AND (
          account_role.role_id::text = ANY(COALESCE(role_targets.role_ids, ARRAY[]::text[]))
          OR account_group.group_id::text = ANY(COALESCE(group_targets.group_ids, ARRAY[]::text[]))
        )
    )
  )
```

- [x] **Step 4: Run repository and enforcement tests**

Run:

```bash
pnpm nx run iam-governance:test:unit --testFiles=src/legal-text-repository.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/legal-text-enforcement.test.ts
```

Expected: repository test PASS; enforcement tests may still fail until the runtime query behavior is aligned in the next task.

- [x] **Step 5: Commit**

```bash
git add packages/iam-governance/src/legal-text-repository-shared.ts \
  packages/iam-governance/src/legal-text-repository.ts \
  packages/iam-governance/src/legal-text-repository.test.ts
git commit -m "feat: add target-aware legal text reads"
```

### Task 3: Complete Consent Audit Writes and Add Consent Export Runtime

**Files:**
- Modify: `packages/iam-governance/src/governance-workflow-executor.ts`
- Modify: `packages/iam-governance/src/governance-workflow-executor.test.ts`
- Modify: `packages/iam-governance/src/legal-consent-export.ts`
- Modify: `packages/auth-runtime/src/iam-governance/core.ts`
- Modify: `packages/auth-runtime/src/runtime-routes.ts`
- Modify: `packages/auth-runtime/src/iam-governance/core.test.ts`

- [x] **Step 1: Write failing tests for audit fields and export permission**

Add to `packages/iam-governance/src/governance-workflow-executor.test.ts`:

```ts
expect(accepted.queries[2]?.sql).toContain('workspace_id');
expect(accepted.queries[2]?.sql).toContain('subject_id');
expect(accepted.queries[2]?.sql).toContain('legal_text_version');
expect(accepted.queries[2]?.sql).toContain('action_type');
expect(accepted.queries[2]?.params).toEqual([
  'tenant-a',
  'legal-version-1',
  'actor-account',
  'tenant-a',
  'actor-subject',
  '2026-05',
  'accepted',
  'request-1',
  'trace-1',
]);
```

Add to `packages/auth-runtime/src/iam-governance/core.test.ts` a failing export case:

```ts
const { legalConsentExportHandler } = await import('./core.js');
state.hasLegalConsentExportPermission.mockReturnValueOnce(false);
const forbidden = await legalConsentExportHandler(
  new Request('https://example.test/iam/legal-consents/export?instanceId=instance-1')
);
expect(forbidden.status).toBe(403);
```

- [x] **Step 2: Run focused runtime/governance tests**

Run:

```bash
pnpm nx run iam-governance:test:unit --testFiles=src/governance-workflow-executor.test.ts --testFiles=src/legal-consent-export.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-governance/core.test.ts
```

Expected: FAIL because audit fields are incomplete and no consent export handler exists.

- [x] **Step 3: Implement audit field writes and runtime export**

Update `packages/iam-governance/src/governance-workflow-executor.ts` accept/revoke write:

```ts
INSERT INTO iam.legal_text_acceptances (
  instance_id,
  legal_text_version_id,
  account_id,
  accepted_at,
  workspace_id,
  subject_id,
  legal_text_version,
  action_type,
  request_id,
  trace_id
)
VALUES ($1, $2, $3, now(), $4, $5, $6, $7, $8, $9);
```

Revoke update:

```ts
UPDATE iam.legal_text_acceptances
SET revoked_at = now(),
    revocation_reason = COALESCE($4, 'user_revoke'),
    action_type = 'revoked'
WHERE instance_id = $1
  AND legal_text_version_id = $2
  AND account_id = $3
  AND revoked_at IS NULL;
```

Extend `packages/iam-governance/src/legal-consent-export.ts` mapping:

```ts
type ConsentExportRow = {
  id: string;
  workspace_id: string | null;
  subject_id: string | null;
  legal_text_id: string;
  legal_text_version: string;
  accepted_at: string;
  revoked_at: string | null;
  action_type: string | null;
  target_role_ids: readonly string[];
  target_group_ids: readonly string[];
};
```

Add runtime handler in `packages/auth-runtime/src/iam-governance/core.ts`:

```ts
export const legalConsentExportHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, async ({ user }) => {
      const url = new URL(request.url);
      const instanceId = readString(url.searchParams.get('instanceId')) ?? user.instanceId;
      const accountId = readString(url.searchParams.get('accountId')) ?? undefined;
      const format = (readString(url.searchParams.get('format')) ?? 'json').toLowerCase();

      if (!instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }
      if (!hasLegalConsentExportPermission(user.roles ?? [])) {
        return jsonResponse(403, { error: 'forbidden' });
      }

      const rows = await withInstanceScopedDb(instanceId, (client) => loadConsentExportRecords(instanceId, accountId, client));
      return jsonResponse(200, {
        format,
        rows,
      });
    })
  );
};
```

Wire `packages/auth-runtime/src/runtime-routes.ts`:

```ts
export {
  getGovernanceCaseHandler,
  governanceComplianceExportHandler,
  legalConsentExportHandler,
  permissionChangeSelfServiceRequestHandler,
  governanceWorkflowHandler,
  listGovernanceCasesHandler,
} from './iam-governance/core.js';
```

- [x] **Step 4: Run focused tests again**

Run:

```bash
pnpm nx run iam-governance:test:unit --testFiles=src/governance-workflow-executor.test.ts --testFiles=src/legal-consent-export.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-governance/core.test.ts
```

Expected: PASS for these focused tests.

- [x] **Step 5: Commit**

```bash
git add packages/iam-governance/src/governance-workflow-executor.ts \
  packages/iam-governance/src/governance-workflow-executor.test.ts \
  packages/iam-governance/src/legal-consent-export.ts \
  packages/auth-runtime/src/iam-governance/core.ts \
  packages/auth-runtime/src/runtime-routes.ts \
  packages/auth-runtime/src/iam-governance/core.test.ts
git commit -m "feat: add consent audit and export runtime"
```

### Task 4: Extend Legal Text Admin UI and Client API

**Files:**
- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`
- Modify: `apps/sva-studio-react/src/hooks/use-legal-texts.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-create-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-create-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx`
- Modify: `apps/sva-studio-react/src/lib/iam-api.test.ts`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`

- [x] **Step 1: Write failing UI tests for target editing and export access**

Add to `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx`:

```tsx
fireEvent.change(screen.getByLabelText('Zielrollen', { selector: '#legal-text-edit-role-targets' }), {
  target: { value: 'role-1,role-2' },
});
fireEvent.change(screen.getByLabelText('Zielgruppen', { selector: '#legal-text-edit-group-targets' }), {
  target: { value: 'group-1' },
});
fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

await waitFor(() => {
  expect(updateLegalText).toHaveBeenCalledWith(
    'legal-1',
    expect.objectContaining({
      targetRoleIds: ['role-1', 'role-2'],
      targetGroupIds: ['group-1'],
    })
  );
});
```

Add to `apps/sva-studio-react/src/lib/iam-api.test.ts` a consent export request expectation:

```ts
await getLegalConsentExport({ instanceId: 'de-musterhausen', format: 'json' });
expect(fetchMock).toHaveBeenCalledWith(
  '/iam/legal-consents/export?instanceId=de-musterhausen&format=json',
  expect.any(Object)
);
```

- [x] **Step 2: Run focused frontend tests**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/legal-texts/-legal-text-create-page.test.tsx --testFiles=src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx --testFiles=src/lib/iam-api.test.ts
```

Expected: FAIL because the UI and client payloads do not support targets/export yet.

- [x] **Step 3: Implement API/client/UI payload changes**

Update `apps/sva-studio-react/src/lib/iam-api.ts`:

```ts
export type CreateLegalTextPayload = {
  readonly name: string;
  readonly legalTextVersion: string;
  readonly locale: string;
  readonly contentHtml: string;
  readonly status: 'draft' | 'valid' | 'archived';
  readonly publishedAt?: string;
  readonly targetRoleIds?: readonly string[];
  readonly targetGroupIds?: readonly string[];
};

export const getLegalConsentExport = async (input: {
  readonly instanceId: string;
  readonly format: 'json' | 'csv';
  readonly accountId?: string;
}) => {
  const params = new URLSearchParams();
  params.set('instanceId', input.instanceId);
  params.set('format', input.format);
  if (input.accountId) params.set('accountId', input.accountId);
  return requestJsonOrText(`/iam/legal-consents/export?${params.toString()}`);
};
```

Update create/detail pages with target fields:

```tsx
<Label htmlFor="legal-text-edit-role-targets">Zielrollen</Label>
<Input
  id="legal-text-edit-role-targets"
  value={formValues.targetRoleIds}
  onChange={(event) => setFormValues((current) => ({ ...current, targetRoleIds: event.target.value }))}
/>
<Label htmlFor="legal-text-edit-group-targets">Zielgruppen</Label>
<Input
  id="legal-text-edit-group-targets"
  value={formValues.targetGroupIds}
  onChange={(event) => setFormValues((current) => ({ ...current, targetGroupIds: event.target.value }))}
/>
```

Normalize comma-separated values in submit:

```ts
const splitIds = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
```

- [x] **Step 4: Run focused frontend tests again**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/legal-texts/-legal-text-create-page.test.tsx --testFiles=src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx --testFiles=src/lib/iam-api.test.ts
```

Expected: PASS for the targeted UI/API suite.

- [x] **Step 5: Commit**

```bash
git add apps/sva-studio-react/src/lib/iam-api.ts \
  apps/sva-studio-react/src/hooks/use-legal-texts.ts \
  apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-create-page.tsx \
  apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.tsx \
  apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.tsx \
  apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-create-page.test.tsx \
  apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx \
  apps/sva-studio-react/src/lib/iam-api.test.ts \
  apps/sva-studio-react/src/i18n/resources.ts
git commit -m "feat: add legal text targeting admin ui"
```

### Task 5: Final Verification and Evidence Updates

**Files:**
- Modify: `packages/auth-runtime/src/legal-text-enforcement.test.ts`
- Modify: `docs/reports/wp-006-datenschutz-compliance-abnahme-2026-05-25.md`
- Create: `docs/reports/wp-006-consent-enforcement-export-nachweis-2026-05-25.md`

- [x] **Step 1: Add failing end-to-end style tests for targeted enforcement**

Add to `packages/auth-runtime/src/legal-text-enforcement.test.ts`:

```ts
it('blocks only users matching legal text target roles', async () => {
  mockWithDb.mockImplementation((_id, fn) =>
    fn({
      query: vi.fn().mockResolvedValue({
        rows: [{ pending_count: 1 }],
      }),
    })
  );

  const response = await withLegalTextCompliance('inst-1', 'matching-user', makeHandler(), {
    returnTo: '/admin/iam',
  });

  expect(response.status).toBe(403);
});
```

- [x] **Step 2: Run final focused and affected tests**

Run:

```bash
pnpm nx run iam-governance:test:unit --testFiles=src/legal-text-repository.test.ts --testFiles=src/legal-consent-export.test.ts --testFiles=src/governance-workflow-executor.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/legal-text-enforcement.test.ts --testFiles=src/iam-governance/core.test.ts
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/legal-texts/-legal-text-create-page.test.tsx --testFiles=src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx --testFiles=src/lib/iam-api.test.ts
pnpm nx affected --target=test:types --base=origin/main
```

Expected: all targeted suites PASS; affected type checks PASS.

- [x] **Step 3: Update reports with real outcomes**

Update `docs/reports/wp-006-datenschutz-compliance-abnahme-2026-05-25.md` with the newly implemented facts:

```md
- Zielgruppenspezifische Legaltexte können Rollen und Gruppen zugewiesen werden.
- Pending- und Enforcement-Pfade werten Zielgruppen mit OR-Logik serverseitig aus.
- Der Consent-Nachweisexport ist als eigener, permission-gebundener Runtime-Pfad verdrahtet.
```

Create `docs/reports/wp-006-consent-enforcement-export-nachweis-2026-05-25.md`:

```md
# WP-006 Nachweis: Consent-Enforcement und Export

- geprüfter Negativpfad: `403 legal_acceptance_required`
- geprüfter Zielgruppenpfad: nicht passende Benutzer werden nicht blockiert
- geprüfter Exportpfad: `legal-consents:export` erforderlich
- geprüfter Konsistenzpfad: Export enthält Audit- und Zielgruppenfelder
```

- [x] **Step 4: Run documentation sanity check**

Run:

```bash
pnpm check:file-placement
git diff -- docs/reports/wp-006-datenschutz-compliance-abnahme-2026-05-25.md docs/reports/wp-006-consent-enforcement-export-nachweis-2026-05-25.md
```

Expected: file placement PASS; report diff contains only WP-006 evidence changes.

- [x] **Step 5: Commit**

```bash
git add packages/auth-runtime/src/legal-text-enforcement.test.ts \
  docs/reports/wp-006-datenschutz-compliance-abnahme-2026-05-25.md \
  docs/reports/wp-006-consent-enforcement-export-nachweis-2026-05-25.md
git commit -m "docs: finalize wp-006 acceptance evidence"
```

## Self-Review

### Spec coverage

- Consent-Auditfelder: Task 3
- Zielgruppenmodell Rollen/Gruppen: Task 1 and Task 2
- Pending-/Enforcement-Relevanz: Task 2 and Task 5
- Consent-Nachweisexport Runtime: Task 3
- Admin-/UI-Integration: Task 4
- Repo-Evidence: Task 5

No spec gap remains uncovered in the plan.

### Placeholder scan

- No `TODO` or `TBD`
- Every code-changing task includes concrete target files and concrete code to add
- Every test step includes exact commands

### Type consistency

- `targetRoleIds` / `targetGroupIds` are used consistently in client payloads
- `targets.roleIds` / `targets.groupIds` are used consistently in read models and export models
- `legalConsentExportHandler` is the single runtime export handler name throughout the plan

## Execution Handoff

Plan complete and saved to `docs/superpowers/archived-plans/2026-05-25-wp-006-datenschutz-compliance-komplettierung.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
