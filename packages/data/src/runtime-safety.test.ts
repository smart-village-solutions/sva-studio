import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
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
  assert.match(runtimeVerifyScript, /NITRO_SERVICE_ENTRY_PATH="\$\{APP_DIR\}\/\.output\/server\/_libs\/_\.mjs"/);
  assert.match(runtimeVerifyScript, /grep -Fq '\.\/_chunks\/ssr-renderer\.mjs' "\$\{SERVER_INDEX_PATH\}"/);
  assert.match(runtimeVerifyScript, /grep -Fq '\.\/_libs\/_\.mjs' "\$\{SERVER_INDEX_PATH\}"/);
  assert.match(runtimeVerifyScript, /grep -Fq '\.\.\/_ssr\/ssr\.mjs' "\$\{NITRO_SERVICE_ENTRY_PATH\}"/);
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
