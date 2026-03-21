import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('geo hierarchy migration validates only paths affected by the new edge', () => {
  const sql = readFileSync('packages/data/migrations/up/0015_iam_geo_hierarchy.sql', 'utf8');

  assert.match(sql, /max_result_depth INTEGER/);
  assert.match(sql, /parent\.descendant_id = NEW\.ancestor_id/);
  assert.match(sql, /child\.ancestor_id = NEW\.descendant_id/);
  assert.doesNotMatch(sql, /WHERE h\.ancestor_id = NEW\.ancestor_id\s+OR h\.descendant_id = NEW\.descendant_id/);
});

test('bootstrap script validates usernames and uses identifier-safe grants', () => {
  const script = readFileSync('packages/data/scripts/bootstrap-app-user.sh', 'utf8');

  assert.match(script, /IAM_DATABASE_URL username must match \^\[a-zA-Z0-9_\]\{1,63\}\$\./);
  assert.match(script, /-v app_user="\$\{app_user\}" -v app_password="\$\{app_password\}"/);
  assert.match(script, /EXECUTE format\('GRANT iam_app TO %I', v_app_user\)/);
  assert.doesNotMatch(script, /GRANT iam_app TO "\$\{app_user\}"/);
});
