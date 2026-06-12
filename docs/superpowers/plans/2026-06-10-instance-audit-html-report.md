# Instance Audit HTML Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only `studio` audit CLI that loads active instances from the registry, runs reachability, Keycloak, secret, and local IAM checks, and writes a static HTML report under `docs/reports/`.

**Architecture:** The CLI entrypoint in `scripts/ops/studio-instance-audit.ts` should stay thin and delegate to focused helpers under `scripts/ops/studio-instance-audit/`. The implementation should use a canonical audit result model, aggregate per-check statuses into per-instance and run-level summaries, and render HTML only from that result object.

**Tech Stack:** TypeScript, `tsx`, existing runtime env/profile helpers, Node `fs/path/url`, Postgres via existing runtime/db helpers, `kcadm.sh`, Vitest

---

## File Structure

### New files

- `scripts/ops/studio-instance-audit.ts`
  - CLI entrypoint, argument parsing, top-level error handling, and exit code.
- `scripts/ops/studio-instance-audit/model.ts`
  - Canonical audit result types, status enums, and aggregation helpers.
- `scripts/ops/studio-instance-audit/options.ts`
  - CLI options parsing and output path resolution.
- `scripts/ops/studio-instance-audit/runtime.ts`
  - `studio` profile validation and shared runtime prerequisites such as `kcadm.sh` lookup.
- `scripts/ops/studio-instance-audit/registry.ts`
  - Active instance discovery from `iam.instances`.
- `scripts/ops/studio-instance-audit/http-checks.ts`
  - Tenant host reachability and login endpoint checks.
- `scripts/ops/studio-instance-audit/keycloak.ts`
  - Realm, client, role, and user inspection through `kcadm.sh`.
- `scripts/ops/studio-instance-audit/secrets.ts`
  - Tenant login/admin secret readability and alignment checks.
- `scripts/ops/studio-instance-audit/local-iam.ts`
  - Local Studio-IAM checks for `system_admin`.
- `scripts/ops/studio-instance-audit/run.ts`
  - Orchestration of all per-instance checks and result assembly.
- `scripts/ops/studio-instance-audit/render-html.ts`
  - Static HTML rendering from the canonical result model.
- `scripts/ops/studio-instance-audit/write-report.ts`
  - Report file naming, directory creation, and file writing.
- `scripts/ops/studio-instance-audit.test.ts`
  - CLI-level smoke tests with mocked orchestration.
- `scripts/ops/studio-instance-audit/model.test.ts`
  - Status aggregation and result model tests.
- `scripts/ops/studio-instance-audit/render-html.test.ts`
  - HTML renderer tests.
- `scripts/ops/studio-instance-audit/options.test.ts`
  - Output path and CLI option parsing tests.

### Modified files

- `package.json`
  - Add a root script alias for the new audit command.
- `tsconfig.scripts.json`
  - Ensure the new script folder is included if the current script config requires explicit paths.

### Existing files to consult while implementing

- `scripts/ops/instance-registry.ts`
  - Reference CLI entrypoint and top-level error handling style.
- `scripts/ops/runtime-env.ts`
  - Reference runtime-profile resolution, existing rootDir helpers, and operational script conventions.
- `scripts/ops/runtime/rebuild-audit.ts`
  - Reference focused helper module style and safe artifact writing.
- `scripts/ops/runtime/rebuild-audit.test.ts`
  - Reference Vitest shape for script utilities.
- `packages/auth-runtime/src/iam-account-management/shared-runtime.ts`
  - Reference tenant admin identity provider prerequisites and tenant secret resolution assumptions.
- `packages/auth-runtime/src/config-tenant-secret.ts`
  - Reference tenant secret readability semantics.
- `packages/auth-runtime/src/config.ts`
  - Reference auth config and host/realm expectations.
- `docs/superpowers/specs/2026-06-10-instance-audit-html-report-design.md`
  - The approved design contract for scope and checks.

---

### Task 1: Scaffold the audit result model and CLI shell

**Files:**
- Create: `scripts/ops/studio-instance-audit.ts`
- Create: `scripts/ops/studio-instance-audit/model.ts`
- Create: `scripts/ops/studio-instance-audit/options.ts`
- Create: `scripts/ops/studio-instance-audit.test.ts`
- Create: `scripts/ops/studio-instance-audit/model.test.ts`

- [ ] **Step 1: Write the failing model and CLI smoke tests**

```ts
import { describe, expect, it, vi } from 'vitest';

import { aggregateAuditStatus } from './studio-instance-audit/model.ts';
import { runStudioInstanceAuditCli } from './studio-instance-audit.ts';

describe('aggregateAuditStatus', () => {
  it('returns fail when at least one check failed', () => {
    expect(aggregateAuditStatus(['pass', 'warn', 'fail'])).toBe('fail');
  });
});

describe('runStudioInstanceAuditCli', () => {
  it('returns exit code 0 when the audit succeeds', async () => {
    const executeAudit = vi.fn(async () => ({
      outputPath: '/tmp/report.html',
      result: { generatedAt: '2026-06-10T12:00:00.000Z', status: 'pass', instances: [] },
    }));

    await expect(
      runStudioInstanceAuditCli([], {
        executeAudit,
        logger: { error: vi.fn(), info: vi.fn() },
      }),
    ).resolves.toBe(0);
  });
});
```

- [ ] **Step 2: Run the script-targeted tests and verify they fail**

Run:

```bash
pnpm exec vitest run \
  scripts/ops/studio-instance-audit.test.ts \
  scripts/ops/studio-instance-audit/model.test.ts
```

Expected:
- FAIL because the new audit files do not exist yet

- [ ] **Step 3: Add the minimal result model and CLI shell**

```ts
export type AuditCheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

export const aggregateAuditStatus = (statuses: readonly AuditCheckStatus[]): Exclude<AuditCheckStatus, 'skip'> => {
  if (statuses.includes('fail')) {
    return 'fail';
  }
  if (statuses.includes('warn')) {
    return 'warn';
  }
  return 'pass';
};
```

```ts
import { pathToFileURL } from 'node:url';

import { executeStudioInstanceAudit } from './studio-instance-audit/run.ts';

type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

export const runStudioInstanceAuditCli = async (
  argv: readonly string[],
  deps: {
    executeAudit?: typeof executeStudioInstanceAudit;
    logger?: Logger;
  } = {},
): Promise<number> => {
  const executeAudit = deps.executeAudit ?? executeStudioInstanceAudit;
  const logger = deps.logger ?? console;

  const audit = await executeAudit(argv);
  logger.info('Studio instance audit completed', {
    output_path: audit.outputPath,
    status: audit.result.status,
  });
  return audit.result.status === 'fail' ? 2 : 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runStudioInstanceAuditCli(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Add minimal CLI option parsing**

```ts
import { resolve } from 'node:path';

export type StudioInstanceAuditOptions = Readonly<{
  outputDir: string;
}>;

export const parseStudioInstanceAuditOptions = (
  argv: readonly string[],
  rootDir: string,
): StudioInstanceAuditOptions => {
  const outputDirArgIndex = argv.findIndex((entry) => entry === '--output-dir');
  const outputDir =
    outputDirArgIndex >= 0 && argv[outputDirArgIndex + 1]
      ? argv[outputDirArgIndex + 1]!
      : resolve(rootDir, 'docs/reports');

  return { outputDir };
};
```

- [ ] **Step 5: Run the targeted tests and make them pass**

Run:

```bash
pnpm exec vitest run \
  scripts/ops/studio-instance-audit.test.ts \
  scripts/ops/studio-instance-audit/model.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit the scaffold**

```bash
git add \
  scripts/ops/studio-instance-audit.ts \
  scripts/ops/studio-instance-audit/model.ts \
  scripts/ops/studio-instance-audit/options.ts \
  scripts/ops/studio-instance-audit.test.ts \
  scripts/ops/studio-instance-audit/model.test.ts
git commit -m "feat: scaffold studio instance audit cli"
```

---

### Task 2: Implement runtime prerequisites and registry discovery

**Files:**
- Create: `scripts/ops/studio-instance-audit/runtime.ts`
- Create: `scripts/ops/studio-instance-audit/registry.ts`
- Modify: `scripts/ops/studio-instance-audit/model.ts`
- Test: `scripts/ops/studio-instance-audit.test.ts`

- [ ] **Step 1: Write a failing discovery test for active `studio` instances**

```ts
import { describe, expect, it, vi } from 'vitest';

import { loadAuditTargets } from './studio-instance-audit/registry.ts';

describe('loadAuditTargets', () => {
  it('returns only active instances with required host and realm fields', async () => {
    const query = vi.fn(async () => ({
      rows: [
        { instance_id: 'bb-guben', status: 'active', primary_hostname: 'bb-guben.studio.smart-village.app', auth_realm: 'bb-guben', auth_client_id: 'sva-studio' },
        { instance_id: 'archived-x', status: 'archived', primary_hostname: 'archived.example', auth_realm: 'archived-x', auth_client_id: 'sva-studio' },
      ],
    }));

    await expect(loadAuditTargets({ query } as never)).resolves.toEqual([
      expect.objectContaining({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        authRealm: 'bb-guben',
      }),
    ]);
  });
});
```

- [ ] **Step 2: Run the registry/discovery test and verify it fails**

Run:

```bash
pnpm exec vitest run scripts/ops/studio-instance-audit.test.ts
```

Expected:
- FAIL because `runtime.ts` and `registry.ts` are not implemented

- [ ] **Step 3: Implement runtime prerequisite checks for the `studio` profile**

```ts
import { resolve } from 'node:path';

export const assertStudioAuditRuntime = (input: {
  commandExists: (name: string) => boolean;
  env: NodeJS.ProcessEnv;
  rootDir: string;
}) => {
  if ((input.env['SVA_RUNTIME_PROFILE'] ?? 'studio') !== 'studio') {
    throw new Error('Das Instanz-Audit darf nur gegen das studio-Profil laufen.');
  }
  if (!input.commandExists('kcadm.sh')) {
    throw new Error('kcadm.sh ist nicht verfügbar.');
  }
  return {
    profile: 'studio',
    rootDir: input.rootDir,
    reportsDir: resolve(input.rootDir, 'docs/reports'),
  } as const;
};
```

- [ ] **Step 4: Implement active registry target loading**

```ts
export type AuditRegistryTarget = Readonly<{
  instanceId: string;
  primaryHostname: string;
  parentDomain: string;
  authRealm: string;
  authClientId: string;
  status: string;
}>;

export const loadAuditTargets = async (client: {
  query: (sql: string) => Promise<{ rows: readonly Record<string, string>[] }>;
}): Promise<readonly AuditRegistryTarget[]> => {
  const result = await client.query(`
SELECT
  instance_id,
  primary_hostname,
  parent_domain,
  auth_realm,
  auth_client_id,
  status
FROM iam.instances
WHERE status = 'active'
ORDER BY instance_id ASC;
`);

  return result.rows.map((row) => ({
    instanceId: String(row['instance_id']),
    primaryHostname: String(row['primary_hostname']),
    parentDomain: String(row['parent_domain']),
    authRealm: String(row['auth_realm']),
    authClientId: String(row['auth_client_id']),
    status: String(row['status']),
  }));
};
```

- [ ] **Step 5: Extend the result model with registry target context**

```ts
export type AuditInstanceSummary = Readonly<{
  instanceId: string;
  primaryHostname: string;
  authRealm: string;
  authClientId: string;
  status: 'pass' | 'warn' | 'fail';
}>;
```

- [ ] **Step 6: Run the targeted tests and make them pass**

Run:

```bash
pnpm exec vitest run scripts/ops/studio-instance-audit.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit runtime and registry discovery**

```bash
git add \
  scripts/ops/studio-instance-audit/runtime.ts \
  scripts/ops/studio-instance-audit/registry.ts \
  scripts/ops/studio-instance-audit/model.ts \
  scripts/ops/studio-instance-audit.test.ts
git commit -m "feat: add studio audit runtime and registry discovery"
```

---

### Task 3: Implement HTTP reachability checks

**Files:**
- Create: `scripts/ops/studio-instance-audit/http-checks.ts`
- Modify: `scripts/ops/studio-instance-audit/model.ts`
- Modify: `scripts/ops/studio-instance-audit/run.ts`
- Test: `scripts/ops/studio-instance-audit.test.ts`

- [ ] **Step 1: Write the failing HTTP check test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { runHttpChecks } from './studio-instance-audit/http-checks.ts';

describe('runHttpChecks', () => {
  it('marks root reachability as pass when the tenant host returns 200', async () => {
    const fetcher = vi.fn(async () => new Response('ok', { status: 200 }));

    const result = await runHttpChecks(
      { instanceId: 'bb-guben', primaryHostname: 'bb-guben.studio.smart-village.app' } as never,
      { fetch: fetcher },
    );

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkId: 'reachability.root', status: 'pass' }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run the HTTP check test and verify it fails**

Run:

```bash
pnpm exec vitest run scripts/ops/studio-instance-audit.test.ts
```

Expected:
- FAIL because `runHttpChecks` is not implemented

- [ ] **Step 3: Implement tenant root and login URL checks**

```ts
const okStatus = (status: number) => status >= 200 && status < 400;

export const runHttpChecks = async (
  target: { instanceId: string; primaryHostname: string },
  deps: { fetch: typeof fetch },
) => {
  const origin = `https://${target.primaryHostname}`;
  const rootResponse = await deps.fetch(`${origin}/`, { redirect: 'manual' });
  const loginResponse = await deps.fetch(`${origin}/auth/login`, { redirect: 'manual' });

  return {
    checks: [
      {
        checkId: 'reachability.root',
        title: 'Tenant root URL antwortet',
        status: okStatus(rootResponse.status) ? 'pass' : 'fail',
        summary: `GET / -> ${rootResponse.status}`,
      },
      {
        checkId: 'reachability.login',
        title: 'Login-Einstieg antwortet',
        status: okStatus(loginResponse.status) ? 'pass' : 'warn',
        summary: `GET /auth/login -> ${loginResponse.status}`,
      },
    ] as const,
  };
};
```

- [ ] **Step 4: Wire HTTP checks into the run orchestrator**

```ts
const httpResult = await runHttpChecks(target, { fetch });
const checks = [...httpResult.checks];
```

- [ ] **Step 5: Run the targeted tests and make them pass**

Run:

```bash
pnpm exec vitest run scripts/ops/studio-instance-audit.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit HTTP checks**

```bash
git add \
  scripts/ops/studio-instance-audit/http-checks.ts \
  scripts/ops/studio-instance-audit/run.ts \
  scripts/ops/studio-instance-audit.test.ts \
  scripts/ops/studio-instance-audit/model.ts
git commit -m "feat: add studio audit reachability checks"
```

---

### Task 4: Implement Keycloak, client, and secret checks

**Files:**
- Create: `scripts/ops/studio-instance-audit/keycloak.ts`
- Create: `scripts/ops/studio-instance-audit/secrets.ts`
- Modify: `scripts/ops/studio-instance-audit/run.ts`
- Test: `scripts/ops/studio-instance-audit.test.ts`

- [ ] **Step 1: Write the failing Keycloak inspection test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { inspectRealmAndClients } from './studio-instance-audit/keycloak.ts';

describe('inspectRealmAndClients', () => {
  it('reports realm and login client as pass when both are present', async () => {
    const runKcadm = vi.fn(async (args: readonly string[]) => {
      if (args.join(' ').includes('get realms/bb-guben')) {
        return { stdout: JSON.stringify({ realm: 'bb-guben' }) };
      }
      return { stdout: JSON.stringify([{ id: 'client-1', clientId: 'sva-studio', rootUrl: 'https://bb-guben.studio.smart-village.app' }]) };
    });

    const result = await inspectRealmAndClients(
      { authClientId: 'sva-studio', authRealm: 'bb-guben', primaryHostname: 'bb-guben.studio.smart-village.app' } as never,
      { runKcadm },
    );

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkId: 'keycloak.realm.exists', status: 'pass' }),
        expect.objectContaining({ checkId: 'keycloak.client.login.exists', status: 'pass' }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run the Keycloak/secret tests and verify they fail**

Run:

```bash
pnpm exec vitest run scripts/ops/studio-instance-audit.test.ts
```

Expected:
- FAIL because Keycloak and secret helper modules do not exist

- [ ] **Step 3: Implement `kcadm.sh` wrapper and realm/client inspection**

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const runKcadmCommand = async (args: readonly string[]) => {
  const result = await execFileAsync('kcadm.sh', args, { maxBuffer: 1024 * 1024 });
  return { stdout: result.stdout };
};

export const inspectRealmAndClients = async (
  target: { authClientId: string; authRealm: string; primaryHostname: string },
  deps: { runKcadm: typeof runKcadmCommand },
) => {
  const realm = JSON.parse((await deps.runKcadm(['get', `realms/${target.authRealm}`])).stdout) as { realm: string };
  const clients = JSON.parse(
    (await deps.runKcadm(['get', 'clients', '-r', target.authRealm, '-q', `clientId=${target.authClientId}`])).stdout,
  ) as readonly { clientId: string; rootUrl?: string }[];

  return {
    checks: [
      {
        checkId: 'keycloak.realm.exists',
        title: 'Tenant-Realm existiert',
        status: realm.realm === target.authRealm ? 'pass' : 'fail',
        summary: realm.realm,
      },
      {
        checkId: 'keycloak.client.login.exists',
        title: 'Login-Client existiert',
        status: clients.some((client) => client.clientId === target.authClientId) ? 'pass' : 'fail',
        summary: target.authClientId,
      },
    ] as const,
  };
};
```

- [ ] **Step 4: Implement tenant secret readability and alignment checks**

```ts
import { resolveTenantAdminClientSecret, resolveTenantAuthClientSecret } from '../../packages/auth-runtime/src/config-tenant-secret.ts';

export const inspectTenantSecrets = async (
  instanceId: string,
  deps: {
    resolveAuthSecret?: typeof resolveTenantAuthClientSecret;
    resolveAdminSecret?: typeof resolveTenantAdminClientSecret;
  } = {},
) => {
  const authSecret = await (deps.resolveAuthSecret ?? resolveTenantAuthClientSecret)(instanceId, { allowGlobalFallback: false });
  const adminSecret = await (deps.resolveAdminSecret ?? resolveTenantAdminClientSecret)(instanceId);

  return {
    checks: [
      {
        checkId: 'secrets.login.readable',
        title: 'Login-Client-Secret ist lesbar',
        status: authSecret.readable ? 'pass' : 'fail',
        summary: authSecret.reason ?? authSecret.source,
      },
      {
        checkId: 'secrets.tenantAdmin.readable',
        title: 'Tenant-Admin-Client-Secret ist lesbar',
        status: adminSecret.readable ? 'pass' : 'fail',
        summary: adminSecret.reason ?? adminSecret.source,
      },
    ] as const,
    secrets: { authSecret, adminSecret },
  };
};
```

- [ ] **Step 5: Add `system_admin` Keycloak role and active-user checks**

```ts
const roles = JSON.parse((await deps.runKcadm(['get', 'roles', '-r', target.authRealm])).stdout) as readonly { name: string }[];
const users = JSON.parse((await deps.runKcadm(['get', 'users', '-r', target.authRealm, '-q', 'enabled=true'])).stdout) as readonly { id: string; username?: string; enabled?: boolean }[];
```

Add checks for:
- `keycloak.role.system_admin.exists`
- `keycloak.user.system_admin.exists`
- `keycloak.user.system_admin.not_instance_registry_admin`

- [ ] **Step 6: Wire Keycloak and secret checks into the orchestrator**

```ts
const keycloakResult = await inspectRealmAndClients(target, { runKcadm: runKcadmCommand });
const secretResult = await inspectTenantSecrets(target.instanceId);
checks.push(...keycloakResult.checks, ...secretResult.checks);
```

- [ ] **Step 7: Run the targeted tests and make them pass**

Run:

```bash
pnpm exec vitest run scripts/ops/studio-instance-audit.test.ts
```

Expected:
- PASS

- [ ] **Step 8: Commit Keycloak and secret checks**

```bash
git add \
  scripts/ops/studio-instance-audit/keycloak.ts \
  scripts/ops/studio-instance-audit/secrets.ts \
  scripts/ops/studio-instance-audit/run.ts \
  scripts/ops/studio-instance-audit.test.ts
git commit -m "feat: add studio audit keycloak and secret checks"
```

---

### Task 5: Implement local Studio-IAM checks and per-instance aggregation

**Files:**
- Create: `scripts/ops/studio-instance-audit/local-iam.ts`
- Modify: `scripts/ops/studio-instance-audit/run.ts`
- Modify: `scripts/ops/studio-instance-audit/model.ts`
- Test: `scripts/ops/studio-instance-audit/model.test.ts`

- [ ] **Step 1: Write the failing local IAM check test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { inspectLocalStudioIam } from './studio-instance-audit/local-iam.ts';

describe('inspectLocalStudioIam', () => {
  it('passes when at least one local account has system_admin', async () => {
    const query = vi.fn(async () => ({
      rows: [{ account_id: 'a1', role_key: 'system_admin' }],
    }));

    const result = await inspectLocalStudioIam('bb-guben', { query } as never);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkId: 'local_iam.system_admin.exists', status: 'pass' }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run the local IAM test and verify it fails**

Run:

```bash
pnpm exec vitest run scripts/ops/studio-instance-audit/model.test.ts
```

Expected:
- FAIL because `local-iam.ts` does not exist

- [ ] **Step 3: Implement the local `system_admin` query**

```ts
export const inspectLocalStudioIam = async (
  instanceId: string,
  client: { query: (sql: string, values: readonly unknown[]) => Promise<{ rows: readonly Record<string, unknown>[] }> },
) => {
  const result = await client.query(
    `
SELECT ar.account_id, r.role_key
FROM iam.account_roles ar
JOIN iam.roles r ON r.id = ar.role_id
WHERE ar.instance_id = $1
  AND r.role_key = 'system_admin'
  AND ar.valid_from <= NOW()
  AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
`,
    [instanceId],
  );

  return {
    checks: [
      {
        checkId: 'local_iam.system_admin.exists',
        title: 'Lokaler system_admin existiert',
        status: result.rows.length > 0 ? 'pass' : 'fail',
        summary: `${result.rows.length} aktive lokale system_admin-Zuweisungen`,
      },
    ] as const,
  };
};
```

- [ ] **Step 4: Implement per-instance result assembly**

```ts
export type AuditInstanceResult = Readonly<{
  instanceId: string;
  primaryHostname: string;
  authRealm: string;
  authClientId: string;
  checks: readonly AuditCheckResult[];
  status: 'pass' | 'warn' | 'fail';
}>;
```

```ts
const status = aggregateAuditStatus(checks.map((check) => check.status));
return {
  instanceId: target.instanceId,
  primaryHostname: target.primaryHostname,
  authRealm: target.authRealm,
  authClientId: target.authClientId,
  checks,
  status,
};
```

- [ ] **Step 5: Run the model/local IAM tests and make them pass**

Run:

```bash
pnpm exec vitest run \
  scripts/ops/studio-instance-audit/model.test.ts \
  scripts/ops/studio-instance-audit.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit local IAM checks and aggregation**

```bash
git add \
  scripts/ops/studio-instance-audit/local-iam.ts \
  scripts/ops/studio-instance-audit/run.ts \
  scripts/ops/studio-instance-audit/model.ts \
  scripts/ops/studio-instance-audit/model.test.ts
git commit -m "feat: add studio audit local iam checks"
```

---

### Task 6: Render and write the HTML report

**Files:**
- Create: `scripts/ops/studio-instance-audit/render-html.ts`
- Create: `scripts/ops/studio-instance-audit/write-report.ts`
- Modify: `scripts/ops/studio-instance-audit/run.ts`
- Test: `scripts/ops/studio-instance-audit/render-html.test.ts`
- Test: `scripts/ops/studio-instance-audit/options.test.ts`

- [ ] **Step 1: Write the failing HTML renderer test**

```ts
import { describe, expect, it } from 'vitest';

import { renderStudioInstanceAuditHtml } from './studio-instance-audit/render-html.ts';

describe('renderStudioInstanceAuditHtml', () => {
  it('renders status summary and instance details', () => {
    const html = renderStudioInstanceAuditHtml({
      generatedAt: '2026-06-10T12:00:00.000Z',
      profile: 'studio',
      status: 'warn',
      instances: [
        {
          instanceId: 'bb-guben',
          primaryHostname: 'bb-guben.studio.smart-village.app',
          authRealm: 'bb-guben',
          authClientId: 'sva-studio',
          status: 'warn',
          checks: [{ checkId: 'reachability.root', title: 'Tenant root URL antwortet', status: 'pass', summary: 'GET / -> 200' }],
        },
      ],
    } as never);

    expect(html).toContain('Studio Instanz-Audit');
    expect(html).toContain('bb-guben');
    expect(html).toContain('reachability.root');
  });
});
```

- [ ] **Step 2: Run the renderer test and verify it fails**

Run:

```bash
pnpm exec vitest run \
  scripts/ops/studio-instance-audit/render-html.test.ts \
  scripts/ops/studio-instance-audit/options.test.ts
```

Expected:
- FAIL because the renderer and report writer do not exist

- [ ] **Step 3: Implement static HTML rendering**

```ts
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export const renderStudioInstanceAuditHtml = (result: StudioInstanceAuditResult): string => `
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>Studio Instanz-Audit</title>
    <style>
      body { font-family: sans-serif; margin: 24px; color: #0f172a; }
      .status-pass { color: #166534; }
      .status-warn { color: #92400e; }
      .status-fail { color: #991b1b; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 8px; border-bottom: 1px solid #cbd5e1; vertical-align: top; }
    </style>
  </head>
  <body>
    <h1>Studio Instanz-Audit</h1>
    <p>Profil: ${escapeHtml(result.profile)}</p>
    <p>Erstellt: ${escapeHtml(result.generatedAt)}</p>
    ${result.instances
      .map(
        (instance) => `
      <section>
        <h2 class="status-${instance.status}">${escapeHtml(instance.instanceId)} (${escapeHtml(instance.status)})</h2>
        <p>${escapeHtml(instance.primaryHostname)} · Realm ${escapeHtml(instance.authRealm)}</p>
        <table>
          <thead><tr><th>Check</th><th>Status</th><th>Zusammenfassung</th></tr></thead>
          <tbody>
            ${instance.checks
              .map(
                (check) => `
              <tr>
                <td>${escapeHtml(check.checkId)}</td>
                <td class="status-${check.status}">${escapeHtml(check.status)}</td>
                <td>${escapeHtml(check.summary)}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </section>`,
      )
      .join('')}
  </body>
</html>
`;
```

- [ ] **Step 4: Implement dated report writing**

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const writeStudioInstanceAuditReport = (outputDir: string, html: string, now = new Date()) => {
  mkdirSync(outputDir, { recursive: true });
  const fileName = `studio-instance-audit-${now.toISOString().replaceAll(':', '-')}.html`;
  const outputPath = join(outputDir, fileName);
  writeFileSync(outputPath, html, 'utf8');
  return outputPath;
};
```

- [ ] **Step 5: Wire rendering and file writing into the run orchestrator**

```ts
const html = renderStudioInstanceAuditHtml(result);
const outputPath = writeStudioInstanceAuditReport(options.outputDir, html);
return { outputPath, result };
```

- [ ] **Step 6: Run the renderer tests and make them pass**

Run:

```bash
pnpm exec vitest run \
  scripts/ops/studio-instance-audit/render-html.test.ts \
  scripts/ops/studio-instance-audit/options.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit report rendering**

```bash
git add \
  scripts/ops/studio-instance-audit/render-html.ts \
  scripts/ops/studio-instance-audit/write-report.ts \
  scripts/ops/studio-instance-audit/run.ts \
  scripts/ops/studio-instance-audit/render-html.test.ts \
  scripts/ops/studio-instance-audit/options.test.ts
git commit -m "feat: render studio instance audit html report"
```

---

### Task 7: Add package script, full test pass, and script typecheck verification

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.scripts.json`
- Test: `scripts/ops/studio-instance-audit.test.ts`
- Test: `scripts/ops/studio-instance-audit/model.test.ts`
- Test: `scripts/ops/studio-instance-audit/render-html.test.ts`

- [ ] **Step 1: Add the root package script**

```json
{
  "scripts": {
    "ops:audit:studio-instances": "tsx scripts/ops/studio-instance-audit.ts"
  }
}
```

- [ ] **Step 2: Ensure the scripts TypeScript config includes the new audit files**

```json
{
  "include": [
    "scripts/**/*.ts",
    "scripts/**/*.mts"
  ]
}
```

- [ ] **Step 3: Run the focused audit tests**

Run:

```bash
pnpm exec vitest run \
  scripts/ops/studio-instance-audit.test.ts \
  scripts/ops/studio-instance-audit/model.test.ts \
  scripts/ops/studio-instance-audit/render-html.test.ts
```

Expected:
- PASS

- [ ] **Step 4: Run the script typecheck**

Run:

```bash
pnpm exec tsc -p tsconfig.scripts.json --noEmit
```

Expected:
- PASS

- [ ] **Step 5: Run the smallest relevant gate for ops script work**

Run:

```bash
pnpm exec vitest run \
  scripts/ops/studio-instance-audit.test.ts \
  scripts/ops/studio-instance-audit/model.test.ts \
  scripts/ops/studio-instance-audit/render-html.test.ts \
  scripts/ops/studio-instance-audit/options.test.ts
pnpm exec tsc -p tsconfig.scripts.json --noEmit
```

Expected:
- PASS

- [ ] **Step 6: Commit the runnable CLI integration**

```bash
git add \
  package.json \
  tsconfig.scripts.json \
  scripts/ops/studio-instance-audit.ts \
  scripts/ops/studio-instance-audit \
  docs/reports
git commit -m "feat: add studio instance audit report command"
```

---

## Self-Review

### Spec coverage

- Automatic registry discovery: covered in Task 2.
- `studio` profile enforcement: covered in Task 2.
- Reachability checks: covered in Task 3.
- Realm, client, secret, and `system_admin` Keycloak checks: covered in Task 4.
- Local Studio-IAM `system_admin` check: covered in Task 5.
- Canonical result model and status aggregation: covered in Tasks 1 and 5.
- Static HTML report output under `docs/reports/`: covered in Task 6.
- Runnable CLI alias and script typecheck verification: covered in Task 7.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” markers remain.
- Each task names exact files, commands, and expected outcomes.
- Each code-touching step includes concrete code snippets.

### Type consistency

- Status values are consistently `pass | warn | fail | skip`.
- The canonical run result is consistently named `StudioInstanceAuditResult`.
- The CLI entrypoint consistently calls `executeStudioInstanceAudit`.

## Notes for the implementing agent

- Keep the first version strictly read-only. Do not reuse any helper that can mutate registry or Keycloak state.
- Do not log secrets or full Keycloak credential payloads.
- Treat missing prerequisites as explicit failures with safe summaries, not as silent skips.
- Prefer reusing existing runtime helpers over re-deriving `studio` profile behavior in the script.

Plan complete and saved to `docs/superpowers/plans/2026-06-10-instance-audit-html-report.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
