import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const readRepoFile = (relativePath: string) => readFileSync(resolve(testDirectory, '..', '..', relativePath), 'utf8');

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
  assert.match(script, /-v app_user="\$\{app_user\}" -v app_password="\$\{app_password\}"/);
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

  assert.match(imageVerifyScript, /docker pull "\$\{IMAGE_REF\}"/);
  assert.doesNotMatch(imageVerifyScript, /skipped-local/);
  assert.doesNotMatch(imageVerifyScript, /docker image inspect "\$\{IMAGE_REF\}"/);

  assert.match(runtimeVerifyScript, /grep -E -q 'jsxDEV\|jsx-dev-runtime'/);
  assert.match(runtimeVerifyScript, /"\$\{SERVER_INDEX_PATH\}"/);
  assert.match(runtimeVerifyScript, /"\$\{PATCHED_SERVER_ENTRY_PATH\}"/);
  assert.match(runtimeVerifyScript, /"\$\{SERVER_CHUNK_PATH\}"/);
  assert.doesNotMatch(runtimeVerifyScript, /grep -R -E 'jsxDEV\|jsx-dev-runtime' "\$\{APP_DIR\}\/\.output\/server"/);

  assert.match(portainerDockerfile, /--exclude-dir='node_modules'/);
  assert.match(portainerDockerfile, /--exclude='\*\.map'/);
  assert.match(portainerDockerfile, /--include='\*\.mjs'/);

  assert.match(patchRuntimeArtifact, /createRequire/);
  assert.match(patchRuntimeArtifact, /requireFromApp\.resolve\(`\$\{packageName\}\/package\.json`\)/);
  assert.doesNotMatch(patchRuntimeArtifact, /node_modules', '\.pnpm', 'node_modules'/);
});
