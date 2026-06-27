import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const readRepoFile = (relativePath: string) => readFileSync(resolve(testDirectory, '..', '..', relativePath), 'utf8');

test('@sva/data stays a db-operations and compatibility package', () => {
  const indexSource = readRepoFile('data/src/index.ts').trim();
  const serverSource = readRepoFile('data/src/server.ts').trim();
  const iamCreateRepositorySource = readRepoFile('data/src/iam/repositories/create-repository.ts').trim();
  const iamStatementsSource = readRepoFile('data/src/iam/repositories/statements.ts').trim();
  const iamTypesSource = readRepoFile('data/src/iam/repositories/types.ts').trim();
  const instanceIntegrationsSource = readRepoFile('data/src/integrations/instance-integrations.ts').trim();
  const instanceIntegrationsServerSource = readRepoFile('data/src/integrations/instance-integrations.server.ts').trim();
  const readmeSource = readRepoFile('data/README.md');
  const packageJsonSource = readRepoFile('data/package.json');
  const projectJsonSource = readRepoFile('data/project.json');

  assert.equal(
    indexSource,
    "export { createDataClient } from '@sva/data-client';\nexport type { DataClientOptions } from '@sva/data-client';\nexport * from '@sva/data-repositories';"
  );
  assert.equal(serverSource, "export * from '@sva/data-repositories/server';");
  assert.equal(iamCreateRepositorySource, "export { createIamSeedRepository } from '@sva/data-repositories';");
  assert.equal(iamStatementsSource, "export { iamSeedStatements } from '@sva/data-repositories';");
  assert.match(iamTypesSource, /from '@sva\/data-repositories';/);
  assert.match(instanceIntegrationsSource, /createCachedInstanceIntegrationLoader/);
  assert.match(instanceIntegrationsSource, /from '@sva\/data-repositories';/);
  assert.equal(
    instanceIntegrationsServerSource,
    "export {\n  loadInstanceIntegrationRecord,\n  resetInstanceIntegrationServerState,\n  saveInstanceIntegrationRecord,\n} from '@sva/data-repositories/server';\n\nexport type { InstanceIntegrationServerLoaderOptions } from '@sva/data-repositories/server';"
  );

  assert.match(readmeSource, /Dünne Kompatibilitätsshims und Boundary-Tests/);
  assert.match(readmeSource, /Nicht erlaubt:/);
  assert.match(readmeSource, /neue führende Persistenzimplementierungen/);
  assert.match(readmeSource, /neue fachliche Orchestrierung/);
  assert.match(readmeSource, /neue Sammelimporte als Bequemlichkeits-Fassade/);
  assert.match(packageJsonSource, /"svaPackageRoles": \[\s*"db-operations",\s*"compat"\s*\]/);
  assert.match(projectJsonSource, /"role:db-operations"/);
  assert.match(projectJsonSource, /"role:compat"/);
});

test('geo hierarchy migration validates only paths affected by the new edge', () => {
  const sql = readRepoFile('data/migrations/0016_iam_geo_hierarchy.sql');

  assert.match(sql, /max_result_depth INTEGER/);
  assert.match(sql, /parent\.descendant_id = NEW\.ancestor_id/);
  assert.match(sql, /child\.ancestor_id = NEW\.descendant_id/);
  assert.doesNotMatch(sql, /WHERE h\.ancestor_id = NEW\.ancestor_id\s+OR h\.descendant_id = NEW\.descendant_id/);
});

test('bootstrap script validates usernames and uses identifier-safe grants', () => {
  const script = readRepoFile('data/scripts/bootstrap-app-user.sh');

  assert.match(script, /IAM_DATABASE_URL username must match \^\[a-zA-Z0-9_\]\{1,63\}\$\./);
  assert.match(script, /POSTGRES_DB must match \^\[a-zA-Z0-9_\]\{1,63\}\$\./);
  assert.match(script, /-v postgres_db="\$\{POSTGRES_DB\}" -v app_user="\$\{app_user\}" -v app_password="\$\{app_password\}"/);
  assert.match(script, /GRANT CONNECT ON DATABASE :"postgres_db" TO :"app_user";/);
  assert.match(script, /GRANT CREATE ON DATABASE :"postgres_db" TO :"app_user";/);
  assert.match(script, /GRANT USAGE, CREATE ON SCHEMA public TO :"app_user";/);
  assert.match(script, /GRANT iam_app TO :"app_user";/);
  assert.match(script, /\\if :role_exists/);
  assert.doesNotMatch(script, /DO \\\$\\\$/);
  assert.doesNotMatch(script, /GRANT iam_app TO "\$\{app_user\}"/);
});

test('migration script supports profile-specific postgres targets', () => {
  const script = readRepoFile('data/scripts/run-migrations.sh');

  assert.match(script, /POSTGRES_SERVICE="\$\{POSTGRES_SERVICE:-postgres\}"/);
  assert.match(script, /POSTGRES_PASSWORD="\$\{POSTGRES_PASSWORD:-sva_local_dev_password\}"/);
  assert.match(script, /SVA_LOCAL_POSTGRES_CONTAINER_NAME="\$\{SVA_LOCAL_POSTGRES_CONTAINER_NAME:-\}"/);
  assert.match(script, /GOOSE_WRAPPER="\$\{GOOSE_WRAPPER:-packages\/data\/scripts\/goosew\.sh\}"/);
  assert.match(script, /Invalid goose command: '\$\{GOOSE_COMMAND\}'/);
  assert.match(script, /db_string="postgres:\/\/\$\{POSTGRES_USER\}@\$\{POSTGRES_HOST\}:\$\{POSTGRES_PORT\}\/\$\{POSTGRES_DB\}\?sslmode=disable"/);
  assert.match(script, /exec env PGPASSWORD="\$\{POSTGRES_PASSWORD\}" "\$\{GOOSE_WRAPPER\}"/);
});

test('destructive integration scripts isolate themselves from the default local development database', () => {
  const seedScript = readRepoFile('data/scripts/test-seeds.sh');
  const rlsScript = readRepoFile('data/scripts/test-rls.sh');
  const encryptionScript = readRepoFile('data/scripts/test-encryption.sh');

  for (const script of [seedScript, rlsScript, encryptionScript]) {
    assert.match(script, /PROTECTED_DB_NAMES_REGEX="\$\{PROTECTED_DB_NAMES_REGEX:-\^\(sva_studio\|postgres\)\$\}"/);
    assert.match(script, /TEST_DB_NAME="\$\{TEST_DB_NAME:-\$\{sanitized_db_name:0:63\}\}"/);
    assert.match(script, /Refusing to run .* against protected database/);
    assert.match(script, /DROP DATABASE IF EXISTS "\$\{TEST_DB_NAME\}";/);
  }

  assert.match(seedScript, /POSTGRES_DB="\$\{TEST_DB_NAME\}" bash packages\/data\/scripts\/run-migrations\.sh up/);
  assert.match(seedScript, /POSTGRES_DB="\$\{TEST_DB_NAME\}" bash packages\/data\/scripts\/run-seeds\.sh/);

  assert.match(rlsScript, /POSTGRES_DB="\$\{TEST_DB_NAME\}" bash packages\/data\/scripts\/run-migrations\.sh up-to 22/);

  assert.match(
    encryptionScript,
    /IAM_DATABASE_URL="\$\{IAM_DATABASE_URL:-postgres:\/\/sva:sva_local_dev_password@localhost:5432\/\$\{TEST_DB_NAME\}\}"/
  );
  assert.match(encryptionScript, /POSTGRES_DB="\$\{TEST_DB_NAME\}" bash packages\/data\/scripts\/run-seeds\.sh/);
});

test('self-service permission change migration keeps admin inserts and rollback fail-closed', () => {
  const sql = readRepoFile('data/migrations/0042_iam_self_service_permission_change_requests.sql');

  assert.match(sql, /ADD COLUMN IF NOT EXISTS request_origin TEXT NOT NULL DEFAULT 'admin'/);
  assert.match(sql, /UPDATE iam\.permission_change_requests[\s\S]*SET request_note = COALESCE\(request_note, ''\)/);
  assert.match(sql, /IF EXISTS \(\s*SELECT 1[\s\S]*WHERE role_id IS NULL[\s\S]*RAISE EXCEPTION 'Cannot restore role_id NOT NULL/);
  assert.doesNotMatch(sql, /ALTER TABLE iam\.permission_change_requests\s+ALTER COLUMN role_id SET NOT NULL;[\s\S]*ALTER TABLE iam\.permission_change_requests\s+ALTER COLUMN request_note DROP NOT NULL/);
});

test('sidebar application permission migration adds navigation permissions for existing roles', () => {
  const sql = readRepoFile('data/migrations/0046_iam_sidebar_application_permissions.sql');

  assert.match(sql, /'app\.read', 'app\.read', 'app', 'Show the app link in the sidebar'/);
  assert.match(sql, /'cockpit\.read', 'cockpit\.read', 'cockpit', 'Show the cockpit link in the sidebar'/);
  assert.match(
    sql,
    /WHERE role_key IN \('system_admin', 'instance_registry_admin'\)/
  );
  assert.match(sql, /grant_origin_kind,\s*access_scope/);
  assert.match(sql, /'seed',\s*'all'/);
  assert.match(sql, /DELETE FROM iam\.role_permissions[\s\S]*permission_key IN \('app\.read', 'cockpit\.read'\)/);
  assert.match(sql, /DELETE FROM iam\.permissions[\s\S]*permission_key IN \('app\.read', 'cockpit\.read'\)/);
});

test('sidebar application permission cache invalidation migration notifies affected instances', () => {
  const sql = readRepoFile('data/migrations/0047_iam_sidebar_application_permission_cache_invalidation.sql');

  assert.match(sql, /iam_permission_snapshot_invalidation/);
  assert.match(sql, /json_build_object\(/);
  assert.match(sql, /'instanceId',\s*instance_id/);
  assert.match(sql, /'reason',\s*'sidebar_application_permissions_migrated'/);
  assert.match(sql, /'reason',\s*'sidebar_application_permissions_rolled_back'/);
  assert.match(sql, /SELECT pg_notify/);
});

test('platform tenant role split migration neutralizes tenant-side root role artifacts additively', () => {
  const sql = readRepoFile('data/migrations/0050_iam_platform_tenant_role_split.sql');
  const touchedInstancesOccurrences = sql.match(/WITH touched_instances AS \(/g) ?? [];

  assert.match(sql, /CREATE TEMP TABLE migration_0050_touched_instances ON COMMIT DROP AS/);
  assert.match(sql, /DELETE FROM iam\.account_roles/);
  assert.match(sql, /DELETE FROM iam\.group_roles/);
  assert.match(sql, /DELETE FROM iam\.role_permissions[\s\S]*permission_key = 'instance\.registry\.manage'/);
  assert.match(sql, /\[legacy-root-role-in-tenant\]/);
  assert.match(sql, /\[legacy-bootstrap-role\]/);
  assert.match(sql, /is_system_role = false/);
  assert.match(sql, /platform_tenant_role_split_migrated/);
  assert.match(sql, /FROM migration_0050_touched_instances;/);
  assert.equal(touchedInstancesOccurrences.length, 2);
});

test('permission gate backfill migration seeds the new permission model for tenant governance paths', () => {
  const sql = readRepoFile('data/migrations/0051_iam_permission_gate_backfill.sql');

  assert.match(sql, /'iam\.legalText\.read'/);
  assert.match(sql, /'iam\.governance\.write'/);
  assert.match(sql, /'iam\.dsr\.export'/);
  assert.match(sql, /'iam\.deletionRules\.write'/);
  assert.match(sql, /'iam\.monitoring\.read'/);
  assert.doesNotMatch(sql, /'app_manager', 'iam\.legalText\.read'/);
  assert.match(sql, /'support_admin', 'iam\.dsr\.write'/);
  assert.match(sql, /'security_admin', 'iam\.governance\.export'/);
  assert.match(sql, /grant_origin_kind,\s*access_scope/);
  assert.match(sql, /ON CONFLICT \(instance_id, permission_key\) DO UPDATE/);
  assert.match(sql, /iam_permission_snapshot_invalidation/);
  assert.match(sql, /permission_gate_backfill_migrated/);
  assert.match(sql, /permission_gate_backfill_rolled_back/);
});

test('experimental shell permission migration backfills the additive ui gate for existing roles', () => {
  const sql = readRepoFile('data/migrations/0052_iam_experimental_shell_permission.sql');

  assert.match(sql, /'experimental\.read'/);
  assert.match(sql, /'experimental',\s*NULL,\s*'allow'/);
  assert.match(sql, /permission_key IN \('app\.read', 'cockpit\.read', 'iam\.monitoring\.read', 'feature\.toggle'\)/);
  assert.match(sql, /grant_origin_kind,\s*access_scope/);
  assert.match(sql, /'seed',\s*'all'/);
  assert.match(sql, /iam_permission_snapshot_invalidation/);
  assert.match(sql, /experimental_shell_permission_migrated/);
  assert.match(sql, /DELETE FROM iam\.permissions[\s\S]*permission_key = 'experimental\.read'/);
});

test('legacy standard role grant cleanup migration removes historical seed grants from deprecated tenant defaults', () => {
  const sql = readRepoFile('data/migrations/0053_iam_legacy_standard_role_grant_cleanup.sql');

  assert.match(sql, /migration_0053_touched_instances/);
  assert.match(sql, /grant_origin_kind = 'seed'/);
  assert.match(sql, /role_key IN \(\s*'app_manager',\s*'feature-manager',\s*'interface-manager',\s*'designer',\s*'editor',\s*'moderator'\s*\)/);
  assert.match(sql, /permission_key IN \(\s*'app\.read',\s*'cockpit\.read',\s*'experimental\.read'/);
  assert.match(sql, /'iam\.monitoring\.write'/);
  assert.match(sql, /INSERT INTO iam\.role_permissions \(instance_id, role_id, permission_id, grant_origin_kind, access_scope\)/);
  assert.match(sql, /legacy_standard_role_grants_cleaned/);
  assert.match(sql, /legacy_standard_role_grants_restored/);
});

test('categories permission migration backfills additive plugin permissions without deleting existing tenant data', () => {
  const sql = readRepoFile('data/migrations/0054_iam_categories_permissions.sql');

  assert.match(sql, /'categories\.read'/);
  assert.match(sql, /'categories\.create'/);
  assert.match(sql, /'categories\.update'/);
  assert.match(sql, /'categories\.delete'/);
  assert.match(sql, /ON CONFLICT \(instance_id, permission_key\) DO UPDATE/);
  assert.match(sql, /'system_admin', 'categories\.read'/);
  assert.match(sql, /'system_admin', 'categories\.delete'/);
  assert.match(sql, /INSERT INTO iam\.role_permissions \(instance_id, role_id, permission_id, grant_origin_kind, access_scope\)/);
  assert.match(sql, /ON CONFLICT \(instance_id, role_id, permission_id\) DO NOTHING/);
  assert.match(sql, /iam_permission_snapshot_invalidation/);
  assert.match(sql, /categories_permissions_migrated/);
  assert.match(sql, /non-destructive rollback intentionally omitted/i);
  assert.doesNotMatch(sql, /DELETE FROM iam\.permissions/);
  assert.doesNotMatch(sql, /DELETE FROM iam\.role_permissions/);
});

test('categories instance-module migration backfills additive module assignments for mainserver content tenants', () => {
  const sql = readRepoFile('data/migrations/0055_iam_categories_instance_modules.sql');

  assert.match(sql, /INSERT INTO iam\.instance_modules \(instance_id, module_id\)/);
  assert.match(sql, /SELECT DISTINCT/);
  assert.match(sql, /'categories'/);
  assert.match(sql, /module_id IN \('news', 'events', 'poi'\)/);
  assert.match(sql, /ON CONFLICT \(instance_id, module_id\) DO NOTHING/);
  assert.match(sql, /non-destructive rollback intentionally omitted/i);
  assert.doesNotMatch(sql, /DELETE FROM iam\.instance_modules/);
});

test('system admin core permission backfill migration restores missing tenant iam account-management grants additively', () => {
  const sql = readRepoFile('data/migrations/0056_iam_system_admin_core_permissions.sql');

  assert.match(sql, /'iam\.user\.read'/);
  assert.match(sql, /'iam\.user\.write'/);
  assert.match(sql, /'iam\.role\.read'/);
  assert.match(sql, /'iam\.role\.write'/);
  assert.match(sql, /'iam\.org\.read'/);
  assert.match(sql, /'iam\.org\.write'/);
  assert.match(sql, /'system_admin', 'iam\.user\.read'/);
  assert.match(sql, /'system_admin', 'iam\.org\.write'/);
  assert.match(sql, /ON CONFLICT \(instance_id, permission_key\) DO UPDATE/);
  assert.match(sql, /INSERT INTO iam\.role_permissions \(instance_id, role_id, permission_id, grant_origin_kind, access_scope\)/);
  assert.match(sql, /ON CONFLICT \(instance_id, role_id, permission_id\) DO NOTHING/);
  assert.match(sql, /iam_permission_snapshot_invalidation/);
  assert.match(sql, /system_admin_core_permissions_migrated/);
  assert.match(sql, /non-destructive rollback intentionally omitted/i);
  assert.doesNotMatch(sql, /DELETE FROM iam\.permissions/);
  assert.doesNotMatch(sql, /DELETE FROM iam\.role_permissions/);
});

test('iam ownership authorization model migration replaces legacy ownership, direct permissions and deny effects', () => {
  const sql = readRepoFile('data/migrations/0061_iam_content_ownership_authorization_model.sql');

  assert.match(sql, /ADD COLUMN IF NOT EXISTS owner_user_id UUID NULL/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS owner_organization_id UUID NULL/);
  assert.doesNotMatch(sql, /owner_user_id = creator_account_id/);
  assert.doesNotMatch(sql, /owner_organization_id = organization_id/);
  assert.match(sql, /Existing rows without canonical owner columns remain ownerless intentionally/);
  assert.match(sql, /ALTER TABLE iam\.content_list_projection[\s\S]*ADD COLUMN IF NOT EXISTS owner_user_id UUID NULL/);
  assert.match(sql, /ALTER TABLE iam\.content_list_projection[\s\S]*ADD COLUMN IF NOT EXISTS owner_organization_id UUID NULL/);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS content_list_projection_scope_key/);
  assert.match(sql, /UNIQUE NULLS NOT DISTINCT[\s\S]*owner_user_id[\s\S]*owner_organization_id/);
  assert.match(sql, /DROP TABLE IF EXISTS iam\.account_permissions/);
  assert.match(sql, /DROP COLUMN IF EXISTS effect/);
  assert.match(sql, /RAISE EXCEPTION 'iam\.permissions contains deny rows/);
  assert.doesNotMatch(sql, /DELETE FROM iam\.permissions/);
  assert.match(sql, /DROP INDEX IF EXISTS iam\.idx_permissions_instance_action_resource_effect/);
});

test('runtime artifact verification runs workspace node helper via bash', () => {
  const script = readFileSync(resolve(testDirectory, '..', '..', '..', 'scripts/ci/verify-runtime-artifact.sh'), 'utf8');

  assert.match(script, /bash "\$\{WORKSPACE_ROOT\}\/scripts\/ci\/run-workspace-node\.sh" <<'NODE'/);
  assert.match(script, /KEYCLOAK_PORT="\$\{KEYCLOAK_PORT\}" bash "\$\{WORKSPACE_ROOT\}\/scripts\/ci\/run-workspace-node\.sh" <<'NODE'/);
  assert.doesNotMatch(script, /(^|[^[:alnum:]_])"\$\{WORKSPACE_ROOT\}\/scripts\/ci\/run-workspace-node\.sh" <<'NODE'/);
});

test('runtime artifact checks avoid stale images and dev JSX false positives', () => {
  const imageVerifyScript = readFileSync(
    resolve(testDirectory, '..', '..', '..', 'scripts/ci/verify-studio-image.sh'),
    'utf8'
  );
  const runtimeVerifyScript = readFileSync(
    resolve(testDirectory, '..', '..', '..', 'scripts/ci/verify-runtime-artifact.sh'),
    'utf8'
  );
  const portainerDockerfile = readFileSync(
    resolve(testDirectory, '..', '..', '..', 'deploy/portainer/Dockerfile'),
    'utf8'
  );
  const patchRuntimeArtifact = readFileSync(
    resolve(testDirectory, '..', '..', '..', 'scripts/ci/patch-runtime-artifact.ts'),
    'utf8'
  );
  const syncInjectedWorkspacePackages = readFileSync(
    resolve(testDirectory, '..', '..', '..', 'scripts/ci/sync-injected-workspace-packages.ts'),
    'utf8'
  );
  const studioProjectJson = readFileSync(resolve(testDirectory, '..', '..', '..', 'apps/sva-studio-react/project.json'), 'utf8');

  assert.match(imageVerifyScript, /docker pull "\$\{IMAGE_REF\}"/);
  assert.doesNotMatch(imageVerifyScript, /skipped-local/);
  assert.doesNotMatch(imageVerifyScript, /docker image inspect "\$\{IMAGE_REF\}"/);
  assert.match(imageVerifyScript, /run_postgres_sql_with_retry\(\)/);
  assert.match(imageVerifyScript, /for _ in \$\(seq 1 10\); do/);
  assert.match(imageVerifyScript, /run_postgres_sql_with_retry "sva_studio"/);

  assert.match(runtimeVerifyScript, /grep -E -q 'jsxDEV\|jsx-dev-runtime'/);
  assert.match(runtimeVerifyScript, /"\$\{SERVER_INDEX_PATH\}"/);
  assert.match(runtimeVerifyScript, /"\$\{PATCHED_SERVER_ENTRY_PATH\}"/);
  assert.match(runtimeVerifyScript, /"\$\{SERVER_CHUNK_PATH\}"/);
  assert.match(runtimeVerifyScript, /NITRO_SERVICE_ENTRY_PATH="\$\{APP_DIR\}\/\.output\/server\/_libs\/_\.mjs"/);
  assert.match(runtimeVerifyScript, /grep -Fq '\.\/_chunks\/ssr-renderer\.mjs' "\$\{SERVER_INDEX_PATH\}"/);
  assert.match(runtimeVerifyScript, /grep -Fq '\.\/_libs\/_\.mjs' "\$\{SERVER_INDEX_PATH\}"/);
  assert.match(runtimeVerifyScript, /grep -Fq '\.\.\/_ssr\/ssr\.mjs' "\$\{NITRO_SERVICE_ENTRY_PATH\}"/);
  assert.match(runtimeVerifyScript, /run_postgres_sql_with_retry\(\)/);
  assert.match(runtimeVerifyScript, /for _ in \$\(seq 1 10\); do/);
  assert.match(runtimeVerifyScript, /run_postgres_sql_with_retry "sva_studio"/);
  assert.doesNotMatch(runtimeVerifyScript, /grep -R -E 'jsxDEV\|jsx-dev-runtime' "\$\{APP_DIR\}\/\.output\/server"/);

  assert.match(
    portainerDockerfile,
    /find \/workspace\/apps\/sva-studio-react\/\.output\/server -type f[\s\S]*-name '\*\.js'[\s\S]*-name '\*\.mjs'[\s\S]*-name '\*\.cjs'/
  );
  assert.match(portainerDockerfile, /! -name '\*\.map'/);
  assert.match(portainerDockerfile, /! -path '\*\/node_modules\/\*'/);
  assert.match(portainerDockerfile, /-exec grep -E -l 'jsxDEV\|jsx-dev-runtime' \{\} \+ \| grep -q \./);
  assert.doesNotMatch(portainerDockerfile, /--include='\*\.mjs'/);
  assert.doesNotMatch(portainerDockerfile, /--exclude-dir='node_modules'/);

  assert.match(patchRuntimeArtifact, /findPnpmPackageDir/);
  assert.match(patchRuntimeArtifact, /path\.join\(pnpmDir, entry\.name, 'node_modules', \.\.\.packageSegments\)/);
  assert.match(patchRuntimeArtifact, /path\.join\(currentDir, 'node_modules', \.\.\.packageSegments\)/);
  assert.match(patchRuntimeArtifact, /finalServerEntrySource\.includes\(nitroSsrServiceImportPath\)/);
  assert.match(patchRuntimeArtifact, /finalServerEntrySource\.includes\(nitroSsrRendererImportPath\)/);
  assert.doesNotMatch(patchRuntimeArtifact, /node_modules', '\.pnpm', 'node_modules'/);
  assert.doesNotMatch(patchRuntimeArtifact, /requireFromApp\.resolve/);

  assert.match(syncInjectedWorkspacePackages, /node_modules', '\.pnpm'/);
  assert.match(syncInjectedWorkspacePackages, /await cp\(workspacePackage\.distDir, targetDistDir, \{ force: true, recursive: true \}\)/);
  assert.match(syncInjectedWorkspacePackages, /if \(injectedCopy\.realDir === workspacePackage\.realDir\)/);

  assert.match(
    studioProjectJson,
    /pnpm exec vite build && bash \.\.\/\.\.\/scripts\/ci\/run-workspace-node\.sh --import tsx \.\.\/\.\.\/scripts\/ci\/patch-runtime-artifact\.ts \./
  );
  assert.doesNotMatch(
    studioProjectJson,
    /patch-runtime-artifact\.ts \. && bash \.\.\/\.\.\/scripts\/ci\/run-workspace-node\.sh --import tsx \.\.\/\.\.\/scripts\/ci\/sync-injected-workspace-packages\.ts \./
  );
  assert.match(runtimeVerifyScript, /"injected-workspace-sync": "\$\{INJECTED_WORKSPACE_SYNC_STATUS\}"/);
  assert.match(runtimeVerifyScript, /- \\`injected-workspace-sync\\`: \\`\$\{INJECTED_WORKSPACE_SYNC_STATUS\}\\`/);
});

test('portable docker runtime guard only fails when a JSX dev runtime match is present', () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'runtime-guard-'));
  const noMatchDir = resolve(tempRoot, 'no-match');
  const matchDir = resolve(tempRoot, 'match');
  const guardScript = `if find "$TARGET_DIR" -type f \\
  \\( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \\) \\
  ! -name '*.map' \\
  ! -path '*/node_modules/*' \\
  -exec grep -E -l 'jsxDEV|jsx-dev-runtime' {} + | grep -q .; then
  exit 1
fi`;

  try {
    execFileSync('mkdir', ['-p', noMatchDir, matchDir]);
    writeFileSync(resolve(noMatchDir, 'server.js'), 'export const server = "prod-runtime";\n');
    writeFileSync(resolve(matchDir, 'server.js'), 'const runtime = "jsxDEV";\n');

    execFileSync('sh', ['-c', guardScript], {
      env: {
        ...process.env,
        TARGET_DIR: noMatchDir,
      },
    });

    assert.throws(
      () =>
        execFileSync('sh', ['-c', guardScript], {
          env: {
            ...process.env,
            TARGET_DIR: matchDir,
          },
        }),
      /Command failed/,
    );
  } finally {
    rmSync(tempRoot, { force: true, recursive: true });
  }
});

test('injected workspace sync copies dist into pnpm store package copies', () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'sync-injected-workspace-'));
  const appDir = resolve(tempRoot, 'apps', 'demo-app');
  const sourcePackageDir = resolve(tempRoot, 'packages', 'demo-lib');
  const sourceDistDir = resolve(sourcePackageDir, 'dist');
  const injectedPackageDir = resolve(
    tempRoot,
    'node_modules',
    '.pnpm',
    '@sva+demo-lib@file+packages+demo-lib',
    'node_modules',
    '@sva',
    'demo-lib'
  );
  const syncScriptPath = resolve(testDirectory, '..', '..', '..', 'scripts', 'ci', 'sync-injected-workspace-packages.ts');
  const workspaceNodeScriptPath = resolve(testDirectory, '..', '..', '..', 'scripts', 'ci', 'run-workspace-node.sh');

  try {
    mkdirSync(sourceDistDir, { recursive: true });
    mkdirSync(appDir, { recursive: true });
    mkdirSync(injectedPackageDir, { recursive: true });

    writeFileSync(resolve(tempRoot, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n  - packages/*\n');
    writeFileSync(resolve(appDir, 'package.json'), JSON.stringify({ name: 'demo-app' }));
    writeFileSync(resolve(sourcePackageDir, 'package.json'), JSON.stringify({ name: '@sva/demo-lib', type: 'module' }));
    writeFileSync(resolve(sourceDistDir, 'index.js'), 'export const synced = true;\n');
    writeFileSync(resolve(injectedPackageDir, 'package.json'), JSON.stringify({ name: '@sva/demo-lib', type: 'module' }));

    execFileSync('bash', [workspaceNodeScriptPath, '--import', 'tsx', syncScriptPath, appDir], {
      cwd: resolve(testDirectory, '..', '..', '..'),
      stdio: 'pipe',
    });

    assert.equal(readFileSync(resolve(injectedPackageDir, 'dist', 'index.js'), 'utf8'), 'export const synced = true;\n');
  } finally {
    rmSync(tempRoot, { force: true, recursive: true });
  }
});

test('public waste build syncs injected workspace packages before vite resolves server imports', () => {
  const publicWastePackageJson = readFileSync(
    resolve(testDirectory, '..', '..', '..', 'apps/public-waste-calendar-web/package.json'),
    'utf8'
  );
  const publicWasteProjectJson = readFileSync(
    resolve(testDirectory, '..', '..', '..', 'apps/public-waste-calendar-web/project.json'),
    'utf8'
  );

  assert.match(
    publicWastePackageJson,
    /pnpm exec tsx \.\.\/\.\.\/scripts\/ci\/sync-injected-workspace-packages\.ts \. && rm -rf dist && vite build --outDir dist\/client && pnpm exec tsc -p tsconfig\.server\.json/
  );
  assert.match(
    publicWasteProjectJson,
    /"dependsOn": \["\^build"\][\s\S]*"inputs": \[[\s\S]*sync-injected-workspace-packages\.ts[\s\S]*\]/
  );
});

test('sva-studio-react vite SSR config resolves mail-runtime from workspace source', () => {
  const viteConfig = readRepoFile('../apps/sva-studio-react/vite.config.ts');

  assert.match(viteConfig, /'@sva\/mail-runtime': resolveAppPath\('\.\.\/\.\.\/packages\/mail-runtime\/src\/index\.ts'\)/);
  assert.match(viteConfig, /'@sva\/mail-runtime',/);
  assert.match(viteConfig, /'\.localhost'/);
  assert.doesNotMatch(viteConfig, /lvh\.me/);
});

test('sva-studio-react vitest shared config resolves mail-runtime from workspace source', () => {
  const vitestSharedConfig = readRepoFile('../apps/sva-studio-react/vitest.shared.ts');

  assert.match(
    vitestSharedConfig,
    /'@sva\/mail-runtime': fileURLToPath\(new URL\('\.\.\/\.\.\/packages\/mail-runtime\/src\/index\.ts', import\.meta\.url\)\)/
  );
});
