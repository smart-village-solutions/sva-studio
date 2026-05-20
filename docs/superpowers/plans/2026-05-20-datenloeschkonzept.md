# Tenant Account Deletion Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build tenant-scoped deletion rules for inactive tenant accounts, including admin-managed defaults, self-service content preference overrides, last-login-based lifecycle processing, and soft-delete tombstone handling for accounts plus `iam.contents`.

**Architecture:** Add a dedicated deletion-rules persistence layer in the IAM database, project `last_login_at` from successful login audit writes, and keep request-driven DSR flows separate from inactivity-driven lifecycle processing. Expose the feature through a new `deletion-rules` admin cockpit tab, self-service account/privacy surfaces, targeted auth-runtime endpoints, and a periodic maintenance runner that advances account/content lifecycle states without physically deleting rows.

**Tech Stack:** TypeScript strict mode, Nx, React/Vite, TanStack Router, Vitest, Playwright, PostgreSQL SQL migrations/seeds, OpenSpec, IAM DB schema snapshots, server-runtime logging

---

## File Map

### OpenSpec

- Create: `openspec/changes/add-tenant-account-deletion-rules/proposal.md`
- Create: `openspec/changes/add-tenant-account-deletion-rules/tasks.md`
- Create: `openspec/changes/add-tenant-account-deletion-rules/design.md`
- Create: `openspec/changes/add-tenant-account-deletion-rules/specs/account-ui/spec.md`
- Create: `openspec/changes/add-tenant-account-deletion-rules/specs/iam-data-subject-rights/spec.md`
- Create: `openspec/changes/add-tenant-account-deletion-rules/specs/iam-access-control/spec.md`
- Create: `openspec/changes/add-tenant-account-deletion-rules/specs/iam-auditing/spec.md`

### Database / Seeds / Schema Docs

- Create: `packages/data/migrations/0042_iam_tenant_account_deletion_rules.sql`
- Create: `packages/data/seeds/0003_iam_deletion_rules_defaults.sql`
- Modify: `packages/data/src/iam/seed-plan.ts`
- Modify: `packages/data/src/iam/seed-plan.vitest.test.ts`
- Modify: `packages/data/src/iam/seed-files.test.ts`
- Modify: `packages/data/scripts/test-seeds.sh`
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md`

### Shared Contracts / Governance

- Modify: `packages/core/src/iam/transparency-contract.ts`
- Modify: `packages/core/src/iam/index.ts`
- Create: `packages/iam-governance/src/deletion-rules.types.ts`
- Create: `packages/iam-governance/src/deletion-rules-read-models.ts`
- Create: `packages/iam-governance/src/deletion-rules-read-models.queries.ts`
- Create: `packages/iam-governance/src/deletion-rules-read-models.mappers.ts`
- Create: `packages/iam-governance/src/deletion-rules-maintenance.ts`
- Modify: `packages/iam-governance/src/index.ts`
- Create: `packages/iam-governance/src/deletion-rules-read-models.test.ts`
- Create: `packages/iam-governance/src/deletion-rules-maintenance.test.ts`

### Runtime / API / Ops

- Modify: `packages/auth-runtime/src/audit-db-sink.ts`
- Modify: `packages/auth-runtime/src/audit-db-sink.test.ts`
- Create: `packages/auth-runtime/src/iam-deletion-rules/core.ts`
- Create: `packages/auth-runtime/src/iam-deletion-rules/core.test.ts`
- Modify: `packages/auth-runtime/src/runtime-routes.ts`
- Modify: `packages/auth-runtime/src/routes.ts`
- Modify: `packages/routing/src/auth.routes.server.ts`
- Modify: `packages/routing/src/auth.routes.server.test.ts`
- Create: `scripts/ops/run-iam-account-deletion-rules.mjs`
- Modify: `package.json`

### Frontend / Routing / i18n

- Modify: `packages/routing/src/route-search.ts`
- Modify: `packages/routing/src/app.routes.test.tsx`
- Modify: `apps/sva-studio-react/src/lib/iam-viewer-access.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-viewer-access.test.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/-iam.models.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/-iam.models.test.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/-iam-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/-iam-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-profile-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-profile-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-page.test.tsx`
- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-api.test.ts`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`
- Modify: `apps/sva-studio-react/e2e/account-admin-ui.spec.ts`

### Operational / Architecture Docs

- Modify: `docs/guides/iam-data-subject-rights-runbook.md`
- Create: `docs/guides/iam-account-deletion-rules-runbook.md`
- Modify: `docs/architecture/README.md`
- Modify: `docs/architecture/iam-service-architektur.md`
- Modify: `docs/superpowers/specs/2026-05-20-datenloeschkonzept-design.md`

## Task 1: Lock the normative scope in OpenSpec before code changes

**Files:**
- Create: `openspec/changes/add-tenant-account-deletion-rules/proposal.md`
- Create: `openspec/changes/add-tenant-account-deletion-rules/tasks.md`
- Create: `openspec/changes/add-tenant-account-deletion-rules/design.md`
- Create: `openspec/changes/add-tenant-account-deletion-rules/specs/account-ui/spec.md`
- Create: `openspec/changes/add-tenant-account-deletion-rules/specs/iam-data-subject-rights/spec.md`
- Create: `openspec/changes/add-tenant-account-deletion-rules/specs/iam-access-control/spec.md`
- Create: `openspec/changes/add-tenant-account-deletion-rules/specs/iam-auditing/spec.md`
- Test: `openspec/changes/add-tenant-account-deletion-rules/**/*`

- [ ] **Step 1: Write the failing OpenSpec delta set**

```markdown
# Change: tenant account deletion rules

## Why
Inactive tenant accounts need a tenant-managed lifecycle with deactivation, pseudonymization, and soft-delete tombstones without introducing new activity tracking.

## What Changes
- add tenant deletion-rule defaults and self-service content preference overrides
- extend `/admin/iam` with `deletion-rules`
- add last-login-based maintenance processing and audit events

## Impact
- Affected specs: `account-ui`, `iam-data-subject-rights`, `iam-access-control`, `iam-auditing`
- Affected code: `packages/data/*`, `packages/iam-governance/*`, `packages/auth-runtime/*`, `apps/sva-studio-react/*`, `packages/routing/*`
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`
```

- [ ] **Step 2: Add concrete requirement deltas for UI, access control, DSR split, and auditing**

```markdown
## ADDED Requirements
### Requirement: Tenant deletion rules cockpit
The system SHALL provide a `deletion-rules` tab under `/admin/iam` for tenant-scoped lifecycle defaults.

#### Scenario: Tenant admin edits deletion defaults
- **WHEN** a tenant-scoped administrator with `iam.deletionRules.write` opens `/admin/iam?tab=deletion-rules`
- **THEN** the UI shows the configured `deactivateAfterDays`, `pseudonymizeAfterDays`, `deleteAfterDays`
- **AND** the UI allows editing the tenant default content strategy

### Requirement: Inactivity lifecycle uses last login only in v1
The system SHALL derive inactivity lifecycle thresholds from `last_login_at` and SHALL NOT require a new generic activity-tracking subsystem in v1.
```

- [ ] **Step 3: Run strict OpenSpec validation**

Run:

```bash
openspec validate add-tenant-account-deletion-rules --strict
```

Expected: `Validation passed` or only actionable formatting/spec errors to fix before implementation.

- [ ] **Step 4: Commit the approved OpenSpec change scaffold**

```bash
git add openspec/changes/add-tenant-account-deletion-rules
git commit -m "spec: add tenant account deletion rules"
```

## Task 2: Add the database model, lifecycle columns, and seeds

**Files:**
- Create: `packages/data/migrations/0042_iam_tenant_account_deletion_rules.sql`
- Create: `packages/data/seeds/0003_iam_deletion_rules_defaults.sql`
- Modify: `packages/data/src/iam/seed-plan.ts`
- Modify: `packages/data/src/iam/seed-plan.vitest.test.ts`
- Modify: `packages/data/src/iam/seed-files.test.ts`
- Modify: `packages/data/scripts/test-seeds.sh`
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md`
- Test: `packages/data/src/iam/seed-plan.vitest.test.ts`
- Test: `packages/data/src/iam/seed-files.test.ts`

- [ ] **Step 1: Write failing seed and schema tests for the new persistence objects**

```ts
it('includes deletion-rules defaults in the seed plan', () => {
  expect(iamSeedPlan.seedFiles).toContain('0003_iam_deletion_rules_defaults.sql');
});

it('expects the deletion-rules seed to create tenant defaults', () => {
  const sql = readSeed('0003_iam_deletion_rules_defaults.sql');
  expect(sql).toContain('INSERT INTO iam.instance_deletion_rules');
  expect(sql).toContain("'retain'");
});
```

- [ ] **Step 2: Run the targeted data tests and confirm they fail first**

Run:

```bash
pnpm nx run data:test:coverage --testFiles=src/iam/seed-plan.vitest.test.ts --testFiles=src/iam/seed-files.test.ts
```

Expected: FAIL with missing seed file and missing seed-plan entry.

- [ ] **Step 3: Implement the migration with dedicated rule tables and lifecycle columns**

```sql
CREATE TABLE iam.instance_deletion_rules (
  instance_id TEXT PRIMARY KEY REFERENCES iam.instances(id) ON DELETE CASCADE,
  deactivate_after_days INTEGER NOT NULL CHECK (deactivate_after_days > 0),
  pseudonymize_after_days INTEGER NOT NULL CHECK (pseudonymize_after_days > deactivate_after_days),
  delete_after_days INTEGER NOT NULL CHECK (delete_after_days > pseudonymize_after_days),
  default_content_strategy TEXT NOT NULL CHECK (
    default_content_strategy IN ('retain', 'on_deactivation', 'on_pseudonymization', 'on_deletion')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE iam.account_deletion_content_preferences (
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES iam.accounts(id) ON DELETE CASCADE,
  content_strategy TEXT NOT NULL CHECK (
    content_strategy IN ('retain', 'on_deactivation', 'on_pseudonymization', 'on_deletion')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (instance_id, account_id)
);

ALTER TABLE iam.accounts
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_lifecycle_state TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pseudonymized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_marked_at TIMESTAMPTZ;

ALTER TABLE iam.contents
  ADD COLUMN IF NOT EXISTS deletion_lifecycle_state TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deletion_lifecycle_changed_at TIMESTAMPTZ;
```

- [ ] **Step 4: Add the seed file and wire it into the seed plan**

```sql
INSERT INTO iam.instance_deletion_rules (
  instance_id,
  deactivate_after_days,
  pseudonymize_after_days,
  delete_after_days,
  default_content_strategy
)
VALUES
  ('de-musterhausen', 90, 180, 365, 'retain')
ON CONFLICT (instance_id) DO UPDATE
SET
  deactivate_after_days = EXCLUDED.deactivate_after_days,
  pseudonymize_after_days = EXCLUDED.pseudonymize_after_days,
  delete_after_days = EXCLUDED.delete_after_days,
  default_content_strategy = EXCLUDED.default_content_strategy,
  updated_at = NOW();
```

- [ ] **Step 5: Update schema snapshots and rerun the data verification commands**

Run:

```bash
pnpm nx run data:db:migrate:validate
pnpm nx run data:db:test:seeds
pnpm nx run data:test:coverage --testFiles=src/iam/seed-plan.vitest.test.ts --testFiles=src/iam/seed-files.test.ts
```

Expected: migration validation passes, seed smoke test passes, targeted tests PASS.

- [ ] **Step 6: Commit the schema and seed slice**

```bash
git add packages/data/migrations/0042_iam_tenant_account_deletion_rules.sql \
  packages/data/seeds/0003_iam_deletion_rules_defaults.sql \
  packages/data/src/iam/seed-plan.ts \
  packages/data/src/iam/seed-plan.vitest.test.ts \
  packages/data/src/iam/seed-files.test.ts \
  packages/data/scripts/test-seeds.sh \
  docs/development/studio-db-schema-final.sql \
  docs/development/studio-db-schema.md
git commit -m "feat: add tenant deletion rule schema"
```

## Task 3: Add shared contracts and governance read/write/maintenance logic

**Files:**
- Modify: `packages/core/src/iam/transparency-contract.ts`
- Modify: `packages/core/src/iam/index.ts`
- Create: `packages/iam-governance/src/deletion-rules.types.ts`
- Create: `packages/iam-governance/src/deletion-rules-read-models.ts`
- Create: `packages/iam-governance/src/deletion-rules-read-models.queries.ts`
- Create: `packages/iam-governance/src/deletion-rules-read-models.mappers.ts`
- Create: `packages/iam-governance/src/deletion-rules-maintenance.ts`
- Modify: `packages/iam-governance/src/index.ts`
- Create: `packages/iam-governance/src/deletion-rules-read-models.test.ts`
- Create: `packages/iam-governance/src/deletion-rules-maintenance.test.ts`

- [ ] **Step 1: Write failing contract and governance tests**

```ts
it('exports tenant deletion rules overview types', () => {
  const overview: IamTenantDeletionRulesOverview = {
    instanceId: 'de-test',
    deactivateAfterDays: 90,
    pseudonymizeAfterDays: 180,
    deleteAfterDays: 365,
    defaultContentStrategy: 'retain',
    canEdit: true,
  };
  expect(overview.defaultContentStrategy).toBe('retain');
});

it('maps account preference rows into self-service deletion rules view models', async () => {
  const result = await loadMyDeletionRulesOverview(client as never, {
    instanceId: 'de-test',
    accountId: '11111111-1111-1111-1111-111111111111',
  });
  expect(result.rules.deleteAfterDays).toBe(365);
  expect(result.contentPreference.effectiveStrategy).toBe('retain');
});

it('marks due accounts as deactivated before pseudonymization', async () => {
  const summary = await runDeletionRulesMaintenance(client as never, { instanceId: 'de-test', dryRun: false });
  expect(summary.deactivatedAccounts).toBe(1);
  expect(summary.pseudonymizedAccounts).toBe(0);
});
```

- [ ] **Step 2: Run targeted governance tests and confirm the new module is missing**

Run:

```bash
pnpm nx run iam-governance:test:unit --testFiles=src/deletion-rules-read-models.test.ts --testFiles=src/deletion-rules-maintenance.test.ts
```

Expected: FAIL with missing module imports and unresolved exported types.

- [ ] **Step 3: Add shared contract types for admin and self-service consumption**

```ts
export type IamDeletionContentStrategy =
  | 'retain'
  | 'on_deactivation'
  | 'on_pseudonymization'
  | 'on_deletion';

export type IamDeletionLifecycleState = 'active' | 'deactivated' | 'pseudonymized' | 'deleted';

export type IamTenantDeletionRulesOverview = {
  readonly instanceId: IamInstanceId;
  readonly deactivateAfterDays: number;
  readonly pseudonymizeAfterDays: number;
  readonly deleteAfterDays: number;
  readonly defaultContentStrategy: IamDeletionContentStrategy;
  readonly canEdit: boolean;
};

export type IamMyDeletionRulesOverview = {
  readonly instanceId: IamInstanceId;
  readonly lastLoginAt?: string;
  readonly lifecycleState: IamDeletionLifecycleState;
  readonly rules: IamTenantDeletionRulesOverview;
  readonly contentPreference: {
    readonly isOverridden: boolean;
    readonly effectiveStrategy: IamDeletionContentStrategy;
    readonly overrideStrategy?: IamDeletionContentStrategy;
  };
};
```

- [ ] **Step 4: Implement governance read models and maintenance with explicit stage ordering**

```ts
const resolveEffectiveContentStrategy = (
  tenantStrategy: IamDeletionContentStrategy,
  accountOverride: IamDeletionContentStrategy | null
) => accountOverride ?? tenantStrategy;

const shouldApplyContentTransition = (
  strategy: IamDeletionContentStrategy,
  nextState: IamDeletionLifecycleState
) =>
  (strategy === 'on_deactivation' && nextState === 'deactivated') ||
  (strategy === 'on_pseudonymization' && nextState === 'pseudonymized') ||
  (strategy === 'on_deletion' && nextState === 'deleted');

const pseudonymLabelByState: Record<Extract<IamDeletionLifecycleState, 'pseudonymized' | 'deleted'>, string> = {
  pseudonymized: 'Pseudonymisiert',
  deleted: 'Gelöscht',
};
```

- [ ] **Step 5: Include the `iam.contents` tombstone updates in the maintenance flow**

```ts
await client.query(
  `
UPDATE iam.contents
SET
  deletion_lifecycle_state = $3,
  deletion_lifecycle_changed_at = NOW(),
  author_display_name = CASE
    WHEN $3 = 'pseudonymized' THEN 'Pseudonymisiert'
    WHEN $3 = 'deleted' THEN 'Gelöscht'
    ELSE author_display_name
  END
WHERE instance_id = $1
  AND author_account_id = $2::uuid;
`,
  [input.instanceId, account.id, nextState]
);
```

- [ ] **Step 6: Run governance unit tests, typecheck, and runtime check**

Run:

```bash
pnpm nx run iam-governance:test:unit --testFiles=src/deletion-rules-read-models.test.ts --testFiles=src/deletion-rules-maintenance.test.ts
pnpm nx run iam-governance:test:types
pnpm nx run iam-governance:check:runtime
```

Expected: all PASS.

- [ ] **Step 7: Commit the governance/core slice**

```bash
git add packages/core/src/iam/transparency-contract.ts \
  packages/core/src/iam/index.ts \
  packages/iam-governance/src/deletion-rules.types.ts \
  packages/iam-governance/src/deletion-rules-read-models.ts \
  packages/iam-governance/src/deletion-rules-read-models.queries.ts \
  packages/iam-governance/src/deletion-rules-read-models.mappers.ts \
  packages/iam-governance/src/deletion-rules-maintenance.ts \
  packages/iam-governance/src/index.ts \
  packages/iam-governance/src/deletion-rules-read-models.test.ts \
  packages/iam-governance/src/deletion-rules-maintenance.test.ts
git commit -m "feat: add deletion rules governance core"
```

## Task 4: Project `last_login_at`, add runtime endpoints, and expose an ops runner

**Files:**
- Modify: `packages/auth-runtime/src/audit-db-sink.ts`
- Modify: `packages/auth-runtime/src/audit-db-sink.test.ts`
- Create: `packages/auth-runtime/src/iam-deletion-rules/core.ts`
- Create: `packages/auth-runtime/src/iam-deletion-rules/core.test.ts`
- Modify: `packages/auth-runtime/src/runtime-routes.ts`
- Modify: `packages/auth-runtime/src/routes.ts`
- Modify: `packages/routing/src/auth.routes.server.ts`
- Modify: `packages/routing/src/auth.routes.server.test.ts`
- Create: `scripts/ops/run-iam-account-deletion-rules.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests for login projection and HTTP handlers**

```ts
it('updates accounts.last_login_at on successful tenant login events', async () => {
  await persistAuthAuditEvent(client as never, {
    eventType: 'login',
    workspaceId: 'de-test',
    actorUserId: 'kc-user-1',
    outcome: 'success',
  });
  expect(queries.some((entry) => entry.text.includes('last_login_at = NOW()'))).toBe(true);
});

it('returns admin deletion rules for a tenant-scoped IAM admin', async () => {
  const response = await deletionRulesAdminHandler(new Request('http://localhost/iam/admin/deletion-rules?instanceId=de-test'));
  expect(response.status).toBe(200);
});

it('stores a self-service content preference override', async () => {
  const request = new Request('http://localhost/iam/me/deletion-rules/content-preference', {
    method: 'POST',
    body: JSON.stringify({ strategy: 'on_deletion' }),
  });
  const response = await myDeletionRulesPreferenceHandler(request);
  expect(response.status).toBe(200);
});
```

- [ ] **Step 2: Run the targeted auth-runtime and routing tests first**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/audit-db-sink.test.ts --testFiles=src/iam-deletion-rules/core.test.ts
pnpm nx run routing:test:unit --testFiles=src/auth.routes.server.test.ts --testFiles=src/app.routes.test.tsx
```

Expected: FAIL with missing handlers/routes and missing `last_login_at` projection.

- [ ] **Step 3: Extend the audit sink to persist `last_login_at` for successful tenant logins**

```ts
if (scope.kind === 'instance' && event.eventType === 'login' && event.outcome === 'success' && ensured.accountId) {
  await client.query(
    `
UPDATE iam.accounts
SET last_login_at = NOW(), updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2;
`,
    [ensured.accountId, scope.instanceId]
  );
}
```

- [ ] **Step 4: Implement dedicated runtime handlers rather than overloading DSR core**

```ts
export const deletionRulesAdminHandler = async (request: Request): Promise<Response> => {
  if (request.method === 'GET') {
    return loadAdminDeletionRulesResponse(request);
  }
  if (request.method === 'POST') {
    return saveAdminDeletionRulesResponse(request);
  }
  return textResponse('Method Not Allowed', { status: 405 });
};

export const myDeletionRulesOverviewHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (user) => {
    return withInstanceScopedDb(user.instanceId, async (client) =>
      jsonResponse(await loadMyDeletionRulesOverview(client, { instanceId: user.instanceId, accountId: user.id }))
    );
  });
```

- [ ] **Step 5: Add the maintenance script and root command**

```js
#!/usr/bin/env node
import { runDeletionRulesMaintenance } from '../../packages/iam-governance/dist/deletion-rules-maintenance.js';

console.log(JSON.stringify(await runDeletionRulesMaintenance(client, { instanceId, dryRun }), null, 2));
```

```json
{
  "scripts": {
    "iam:account-deletion-rules:run": "node --import tsx scripts/ops/run-iam-account-deletion-rules.mjs"
  }
}
```

- [ ] **Step 6: Run targeted runtime, routing, type, and runtime checks**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/audit-db-sink.test.ts --testFiles=src/iam-deletion-rules/core.test.ts
pnpm nx run auth-runtime:test:types
pnpm nx run auth-runtime:check:runtime
pnpm nx run sva-studio-react:test:types
```

Expected: PASS for auth-runtime checks; app types stay green after route contract additions.

- [ ] **Step 7: Commit the runtime/API slice**

```bash
git add packages/auth-runtime/src/audit-db-sink.ts \
  packages/auth-runtime/src/audit-db-sink.test.ts \
  packages/auth-runtime/src/iam-deletion-rules/core.ts \
  packages/auth-runtime/src/iam-deletion-rules/core.test.ts \
  packages/auth-runtime/src/runtime-routes.ts \
  packages/auth-runtime/src/routes.ts \
  packages/routing/src/auth.routes.server.ts \
  packages/routing/src/auth.routes.server.test.ts \
  scripts/ops/run-iam-account-deletion-rules.mjs \
  package.json
git commit -m "feat: add deletion rules runtime endpoints"
```

## Task 5: Extend `/admin/iam` and self-service account surfaces

**Files:**
- Modify: `packages/routing/src/route-search.ts`
- Modify: `packages/routing/src/app.routes.test.tsx`
- Modify: `apps/sva-studio-react/src/lib/iam-viewer-access.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-viewer-access.test.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/-iam.models.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/-iam.models.test.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/-iam-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/-iam-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-profile-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-profile-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-page.test.tsx`
- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-api.test.ts`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`
- Modify: `apps/sva-studio-react/e2e/account-admin-ui.spec.ts`

- [ ] **Step 1: Write the failing frontend tests first**

```ts
it('accepts deletion-rules as a valid IAM cockpit tab', () => {
  expect(normalizeIamTab('deletion-rules')).toBe('deletion-rules');
});

it('shows the deletion-rules tab for users with governance access and deletion-rules read permission', async () => {
  getAllowedIamCockpitTabsMock.mockReturnValue(['rights', 'governance', 'dsr', 'deletion-rules']);
  render(<IamViewerPage activeTab="deletion-rules" />);
  expect(screen.getByRole('tab', { name: 'Löschregeln' })).toBeTruthy();
});

it('renders the current deletion-rule defaults and content override in the privacy area', async () => {
  render(<AccountPrivacyPage />);
  expect(await screen.findByText('90 Tage')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Eigene Inhaltsregel speichern' })).toBeTruthy();
});
```

- [ ] **Step 2: Run targeted app tests to confirm the missing tab and API client gaps**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/iam-viewer-access.test.ts --testFiles=src/routes/admin/-iam.models.test.ts --testFiles=src/routes/admin/-iam-page.test.tsx --testFiles=src/routes/account/-account-profile-page.test.tsx --testFiles=src/routes/account/-account-privacy-page.test.tsx --testFiles=src/lib/iam-api.test.ts
```

Expected: FAIL with invalid tab normalization, missing API helpers, and missing UI copy.

- [ ] **Step 3: Extend the route/tab contract and API client**

```ts
export type IamCockpitTabKey = 'rights' | 'governance' | 'dsr' | 'deletion-rules';

const VALID_TABS: readonly IamCockpitTabKey[] = ['rights', 'governance', 'dsr', 'deletion-rules'];

export const getAdminDeletionRules = async (instanceId: string) =>
  requestJson<IamTenantDeletionRulesOverview>(`/iam/admin/deletion-rules?instanceId=${encodeURIComponent(instanceId)}`);

export const saveAdminDeletionRules = async (payload: {
  instanceId: string;
  deactivateAfterDays: number;
  pseudonymizeAfterDays: number;
  deleteAfterDays: number;
  defaultContentStrategy: IamDeletionContentStrategy;
}) => requestJson<IamTenantDeletionRulesOverview>('/iam/admin/deletion-rules', { method: 'POST', body: JSON.stringify(payload) });
```

- [ ] **Step 4: Add the admin tab panel and the self-service rule section**

```tsx
{activeTab === 'deletion-rules' ? (
  <section id={getTabPanelId('deletion-rules')} aria-labelledby={getTabId('deletion-rules')}>
    <h2>{t('admin.iam.deletionRules.title')}</h2>
    <p>{t('admin.iam.deletionRules.subtitle')}</p>
  </section>
) : null}
```

```tsx
<Card>
  <CardHeader>
    <CardTitle>{t('account.privacy.deletionRules.title')}</CardTitle>
    <CardDescription>{t('account.privacy.deletionRules.body')}</CardDescription>
  </CardHeader>
  <CardContent>
    <p>{t('account.privacy.deletionRules.lastLogin', { value: formatDateTime(overview?.lastLoginAt) })}</p>
  </CardContent>
</Card>
```

- [ ] **Step 5: Add i18n keys instead of hard-coded strings**

```ts
deletionRules: {
  title: 'Löschregeln',
  subtitle: 'Verwalte Fristen für Deaktivierung, Pseudonymisierung und Löschung inaktiver Tenant-Accounts.',
  fields: {
    deactivateAfterDays: 'Deaktivierung nach',
    pseudonymizeAfterDays: 'Pseudonymisierung nach',
    deleteAfterDays: 'Löschung nach',
    defaultContentStrategy: 'Standardregel für eigene Inhalte',
  },
}
```

- [ ] **Step 6: Run frontend unit, types, and focused e2e verification**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/iam-viewer-access.test.ts --testFiles=src/routes/admin/-iam.models.test.ts --testFiles=src/routes/admin/-iam-page.test.tsx --testFiles=src/routes/account/-account-profile-page.test.tsx --testFiles=src/routes/account/-account-privacy-page.test.tsx --testFiles=src/lib/iam-api.test.ts
pnpm nx run sva-studio-react:test:types
pnpm nx run sva-studio-react:test:e2e
```

Expected: unit tests PASS, app typecheck PASS, e2e suite remains green or fails only on genuinely related regressions to fix immediately.

- [ ] **Step 7: Commit the UI slice**

```bash
git add packages/routing/src/route-search.ts \
  packages/routing/src/app.routes.test.tsx \
  apps/sva-studio-react/src/lib/iam-viewer-access.ts \
  apps/sva-studio-react/src/lib/iam-viewer-access.test.ts \
  apps/sva-studio-react/src/routes/admin/-iam.models.ts \
  apps/sva-studio-react/src/routes/admin/-iam.models.test.ts \
  apps/sva-studio-react/src/routes/admin/-iam-page.tsx \
  apps/sva-studio-react/src/routes/admin/-iam-page.test.tsx \
  apps/sva-studio-react/src/routes/account/-account-profile-page.tsx \
  apps/sva-studio-react/src/routes/account/-account-profile-page.test.tsx \
  apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx \
  apps/sva-studio-react/src/routes/account/-account-privacy-page.test.tsx \
  apps/sva-studio-react/src/lib/iam-api.ts \
  apps/sva-studio-react/src/lib/iam-api.test.ts \
  apps/sva-studio-react/src/i18n/resources.ts \
  apps/sva-studio-react/e2e/account-admin-ui.spec.ts
git commit -m "feat: add admin and self-service deletion rules ui"
```

## Task 6: Finish docs, architecture updates, and full verification gates

**Files:**
- Modify: `docs/guides/iam-data-subject-rights-runbook.md`
- Create: `docs/guides/iam-account-deletion-rules-runbook.md`
- Modify: `docs/architecture/README.md`
- Modify: `docs/architecture/iam-service-architektur.md`
- Modify: `docs/superpowers/specs/2026-05-20-datenloeschkonzept-design.md`

- [ ] **Step 1: Update the runbooks and architecture notes with the final implementation shape**

```markdown
## Inaktive Tenant-Accounts

- Referenzzeitpunkt in v1: `iam.accounts.last_login_at`
- Lifecycle-Stufen: `active`, `deactivated`, `pseudonymized`, `deleted`
- Inhalte im Scope v1: nur `iam.contents`
- Physische Löschung: keine; finale Stufe ist ein Tombstone-Soft-Delete
```

- [ ] **Step 2: Add the operational command and expected output to the new runbook**

```bash
pnpm iam:account-deletion-rules:run --instanceId=de-musterhausen --dryRun
```

Expected output:

```json
{
  "instanceId": "de-musterhausen",
  "evaluatedAccounts": 0,
  "deactivatedAccounts": 0,
  "pseudonymizedAccounts": 0,
  "deletedAccounts": 0,
  "tombstonedContents": 0
}
```

- [ ] **Step 3: Run the repository-level verification gates**

Run:

```bash
pnpm check:file-placement
pnpm nx affected --target=test:unit --base=origin/main
pnpm nx affected --target=test:types --base=origin/main
pnpm test:pr
```

Expected: all PASS. If `pnpm test:pr` is too heavy for the active machine, document the failure cause and at minimum keep the two affected Nx gates green before any push.

- [ ] **Step 4: Commit the docs and verification slice**

```bash
git add docs/guides/iam-data-subject-rights-runbook.md \
  docs/guides/iam-account-deletion-rules-runbook.md \
  docs/architecture/README.md \
  docs/architecture/iam-service-architektur.md \
  docs/superpowers/specs/2026-05-20-datenloeschkonzept-design.md
git commit -m "docs: document tenant deletion rules rollout"
```

## Spec Coverage Check

- Tenant-scoped rules only: covered in Task 1, Task 3, Task 4, Task 5
- No root/platform admin support: covered in Task 1 and Task 5 permission/UI deltas
- Fristen relativ zu `zuletzt eingeloggt`: covered in Task 2 (`last_login_at`) and Task 4 (audit projection)
- Drei Stufen Deaktivierung/Pseudonymisierung/Löschung: covered in Task 2 and Task 3
- Soft-delete statt physischer Löschung: covered in Task 2, Task 3, Task 6
- Tenant default content strategy + one account-wide override: covered in Task 2, Task 3, Task 5
- `iam.contents` only in v1: covered in Task 2 and Task 3
- Admin tab `deletion-rules`: covered in Task 1 and Task 5
- Anzeige im Bereich `Mein Konto`: covered in Task 5
- Seeds for defaults: covered in Task 2
- IAM DB schema source of truth and docs updates: covered in Task 2 and Task 6

