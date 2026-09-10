import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(fileURLToPath(new URL('.', import.meta.url)), 'ssf-runtime-service-client.sh'),
  'utf8'
);

describe('SSF runtime service client operator', () => {
  it.each([
    'users/service/role-mappings/clients/client',
    'clients/client/scope-mappings/clients/client',
  ])('reconciles both read roles idempotently at %s', (mappingPath) => {
    const temporary = mkdtempSync(resolve(tmpdir(), 'ssf-role-test-'));
    try {
      writeFileSync(
        resolve(temporary, 'state.json'),
        JSON.stringify([
          { id: 'runtime', name: 'ssf.runtime-configuration.read' },
          { id: 'extra', name: 'unrelated' },
        ])
      );
      const functions = source.slice(
        source.indexOf('read_action_roles() {'),
        source.indexOf('write_secret() {')
      );
      const harness = `
set -euo pipefail
temp_directory="$1"
mapping_path="$2"
realm=test
ACTION=ssf.runtime-configuration.read
DIRECTORY_ACTION=ssf.admin-login-directory.read
kcadm() {
  local operation="$1" path="$2"
  if [[ "$path" == clients/client/roles ]]; then
    printf '%s' '[{"id":"runtime","name":"ssf.runtime-configuration.read","composite":false},{"id":"directory","name":"ssf.admin-login-directory.read","composite":false}]'
  elif [[ "$operation" == get ]]; then
    cat "$temp_directory/state.json"
  else
    local payload="$6"
    if [[ "$operation" == create ]]; then
      jq --slurpfile added "$payload" '. + $added[0]' "$temp_directory/state.json" >"$temp_directory/next.json"
    else
      jq --slurpfile removed "$payload" '[.[] | select(.id as $id | $removed[0] | all(.id != $id))]' "$temp_directory/state.json" >"$temp_directory/next.json"
    fi
    mv "$temp_directory/next.json" "$temp_directory/state.json"
    printf '%s\\n' "$operation" >>"$temp_directory/mutations"
  fi
}
${functions}
ensure_action_mapping client "$mapping_path"
ensure_action_mapping client "$mapping_path"
`;
      execFileSync('bash', ['-c', harness, 'role-test', temporary, mappingPath]);
      expect(JSON.parse(readFileSync(resolve(temporary, 'state.json'), 'utf8'))).toEqual([
        { id: 'runtime', name: 'ssf.runtime-configuration.read' },
        { id: 'directory', name: 'ssf.admin-login-directory.read', composite: false },
      ]);
      expect(readFileSync(resolve(temporary, 'mutations'), 'utf8')).toBe('delete\ncreate\n');
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it('pins the least-privilege V1 identity contract', () => {
    expect(source).toContain("readonly CLIENT_ID='ssf-runtime'");
    expect(source).toContain("readonly AUDIENCE='sva-studio-ssf-runtime'");
    expect(source).toContain("readonly DIRECTORY_ACTION='ssf.admin-login-directory.read'");
    expect(source).toContain("readonly ACTION='ssf.runtime-configuration.read'");
    expect(source).toContain('serviceAccountsEnabled:true');
    expect(source).toContain('bearerOnly:false');
    expect(source).toContain('standardFlowEnabled:false');
    expect(source).toContain('directAccessGrantsEnabled:false');
    expect(source).toContain('fullScopeAllowed:false');
    expect(source).toContain('.clientAuthenticatorType == "client-secret"');
    expect(source).toContain("jq -e '.composite == false'");
  });

  it('never prints the generated secret and writes it with restrictive permissions', () => {
    expect(source).toContain('jq -er \'.value\' >"$secret_file"');
    expect(source).toContain('chmod 600 "$secret_file"');
    expect(source).toContain('chmod 600 "$output"');
    expect(source).toContain('must not be a symlink or directory');
    expect(source).toContain('parent must be a writable directory');
    expect(source).toContain('.ssf-runtime-secret-probe.XXXXXX');
    expect(source).not.toContain('printf \'%s\\n\' "$secret"');
  });

  it('supports idempotent reconciliation, verification, and explicit rotation', () => {
    expect(source).toContain('<reconcile|verify|rotate-secret>');
    expect(source).toContain('ensure_client_contract "$client_uuid"');
    expect(source).toContain('ensure_action_role "$client_uuid" "$ACTION"');
    expect(source).toContain('ensure_action_role "$client_uuid" "$DIRECTORY_ACTION"');
    expect(source).toContain('ensure_audience_mapper "$client_uuid"');
    expect(source).toContain('ensure_service_account_role "$client_uuid"');
    expect(source).toContain('ensure_action_scope "$client_uuid"');
    expect(source).toContain('verify_contract "$client_uuid"');
    expect(source).toContain("'[.[].id] | sort == $expected'");
    expect(source).toContain('error("duplicate clientId")');
    expect(source).toContain('error("duplicate audience mapper")');
  });
});
