import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const directory = fileURLToPath(new URL('.', import.meta.url));
const scriptPath = resolve(directory, 'ssf-runtime-service-client.sh');
const fakeKcadmPath = resolve(directory, 'fixtures/fake-kcadm.sh');
const source = readFileSync(scriptPath, 'utf8');

const MAPPERS_PATH = 'clients/client/protocol-mappers/models';
const SECRET = 'fixture-client-secret';
const ACTION_ROLES = [
  { id: 'runtime', name: 'ssf.runtime-configuration.read', composite: false },
  { id: 'directory', name: 'ssf.admin-login-directory.read', composite: false },
];

type Mapper = {
  id: string;
  name: string;
  protocol: string;
  protocolMapper: string;
  config: Record<string, string>;
};

// Shaped like a Keycloak readback: server id, no deprecated consentRequired, extra server-side keys.
const ALIGNED_MAPPER: Mapper = {
  id: 'audience',
  name: 'studio-ssf-runtime-audience',
  protocol: 'openid-connect',
  protocolMapper: 'oidc-audience-mapper',
  config: {
    'included.client.audience': '',
    'included.custom.audience': 'sva-studio-ssf-runtime',
    'id.token.claim': 'false',
    'access.token.claim': 'true',
    'userinfo.token.claim': 'false',
    'introspection.token.claim': 'true',
    'lightweight.claim': 'false',
  },
};
const DRIFTED_MAPPER: Mapper = {
  ...ALIGNED_MAPPER,
  config: { ...ALIGNED_MAPPER.config, 'id.token.claim': 'true' },
};
const UNRELATED_MAPPER: Mapper = {
  id: 'unrelated',
  name: 'tenant-claim',
  protocol: 'openid-connect',
  protocolMapper: 'oidc-hardcoded-claim-mapper',
  config: { 'claim.name': 'tenant', 'claim.value': 'root' },
};

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const temporary of temporaryDirectories.splice(0)) {
    rmSync(temporary, { recursive: true, force: true });
  }
});

// A string for mappers is served verbatim, e.g. '' for an empty kcadm response.
const runOperator = (mode: 'reconcile' | 'verify', mappers: readonly Mapper[] | string) => {
  const state = mkdtempSync(resolve(tmpdir(), 'ssf-operator-test-'));
  temporaryDirectories.push(state);
  const resources: Record<string, unknown> = {
    clients: [{ id: 'client', clientId: 'ssf-runtime' }],
    'clients/client': {
      clientId: 'ssf-runtime',
      enabled: true,
      protocol: 'openid-connect',
      publicClient: false,
      bearerOnly: false,
      clientAuthenticatorType: 'client-secret',
      serviceAccountsEnabled: true,
      standardFlowEnabled: false,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      fullScopeAllowed: false,
    },
    'clients/client/roles': ACTION_ROLES,
    'clients/client/roles/ssf.runtime-configuration.read': ACTION_ROLES[0],
    'clients/client/roles/ssf.admin-login-directory.read': ACTION_ROLES[1],
    [MAPPERS_PATH]: mappers,
    'clients/client/service-account-user': { id: 'service' },
    'users/service/role-mappings/clients/client': ACTION_ROLES,
    'clients/client/scope-mappings/clients/client': ACTION_ROLES,
    'clients/client/client-secret': { value: SECRET },
  };
  for (const [path, body] of Object.entries(resources)) {
    writeFileSync(
      resolve(state, `${path.replaceAll('/', '__')}.json`),
      typeof body === 'string' ? body : JSON.stringify(body)
    );
  }
  writeFileSync(resolve(state, 'kcadm.config'), '{}');
  const secretOutput = resolve(state, 'client-secret');

  const result = spawnSync('bash', [scriptPath, mode], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      FAKE_KCADM_STATE: state,
      KCADM_BIN: fakeKcadmPath,
      KCADM_CONFIG: resolve(state, 'kcadm.config'),
      SSF_RUNTIME_ROOT_REALM: 'studio',
      SSF_RUNTIME_SECRET_OUTPUT: secretOutput,
    },
    timeout: 30_000,
  });
  const callsPath = resolve(state, 'calls');
  const calls = existsSync(callsPath)
    ? readFileSync(callsPath, 'utf8').split('\n').filter(Boolean)
    : [];
  const storedMappers = readFileSync(
    resolve(state, `${MAPPERS_PATH.replaceAll('/', '__')}.json`),
    'utf8'
  );
  return {
    ...result,
    calls,
    writes: calls.filter((call) => !call.startsWith('get ')),
    mapperWrites: calls.filter((call) => !call.startsWith('get ') && call.includes(MAPPERS_PATH)),
    mappers: (storedMappers ? JSON.parse(storedMappers) : []) as Mapper[],
    secretWritten: existsSync(secretOutput),
  };
};

describe('SSF runtime service client audience mapper', () => {
  it('leaves an already aligned mapper untouched during reconcile', () => {
    const run = runOperator('reconcile', [ALIGNED_MAPPER, UNRELATED_MAPPER]);

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.mapperWrites).toEqual([]);
    expect(run.writes).not.toContain('create clients/client/client-secret');
    expect(run.mappers).toEqual([ALIGNED_MAPPER, UNRELATED_MAPPER]);
    expect(run.stdout).not.toContain(SECRET);
  });

  it('creates a missing mapper exactly once and reads it back', () => {
    const run = runOperator('reconcile', [UNRELATED_MAPPER]);

    expect(run.status).toBe(0);
    expect(run.mapperWrites).toEqual([`create ${MAPPERS_PATH}`]);
    expect(run.calls.lastIndexOf(`get ${MAPPERS_PATH}`)).toBeGreaterThan(
      run.calls.indexOf(`create ${MAPPERS_PATH}`)
    );
    expect(run.mappers[0]).toEqual(UNRELATED_MAPPER);
    expect(run.mappers[1]).toMatchObject({
      name: ALIGNED_MAPPER.name,
      protocolMapper: 'oidc-audience-mapper',
      config: expect.objectContaining({ 'included.custom.audience': 'sva-studio-ssf-runtime' }),
    });
  });

  it('corrects a drifted mapper in place with its id and reads it back', () => {
    const run = runOperator('reconcile', [DRIFTED_MAPPER, UNRELATED_MAPPER]);

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.mapperWrites).toEqual([`update ${MAPPERS_PATH}/audience`]);
    expect(run.calls.lastIndexOf(`get ${MAPPERS_PATH}`)).toBeGreaterThan(
      run.calls.indexOf(`update ${MAPPERS_PATH}/audience`)
    );
    expect(run.mappers).toEqual([
      expect.objectContaining({ ...ALIGNED_MAPPER, config: ALIGNED_MAPPER.config }),
      UNRELATED_MAPPER,
    ]);
  });

  it.each([
    ['reconcile', 'a duplicate', [ALIGNED_MAPPER, { ...ALIGNED_MAPPER, id: 'duplicate' }]],
    ['verify', 'a duplicate', [ALIGNED_MAPPER, { ...ALIGNED_MAPPER, id: 'duplicate' }]],
    [
      'reconcile',
      'a foreign same-named',
      [{ ...ALIGNED_MAPPER, protocolMapper: 'oidc-hardcoded-claim-mapper' }],
    ],
    [
      'verify',
      'a foreign same-named',
      [{ ...ALIGNED_MAPPER, protocolMapper: 'oidc-hardcoded-claim-mapper' }],
    ],
  ] as const)('%s fails closed on %s mapper without writing it', (mode, _kind, mappers) => {
    const run = runOperator(mode, [...mappers, UNRELATED_MAPPER]);

    expect(run.status).not.toBe(0);
    expect(run.stderr).toBe(
      'ssf-runtime service client: failed to resolve the audience mapper uniquely\n'
    );
    expect(run.mapperWrites).toEqual([]);
    expect(run.mappers).toEqual([...mappers, UNRELATED_MAPPER]);
    expect(run.secretWritten).toBe(false);
  });

  it.each([
    ['an aligned', ALIGNED_MAPPER, 0, ''],
    [
      'a drifted',
      DRIFTED_MAPPER,
      1,
      'ssf-runtime service client: audience mapper is not aligned\n',
    ],
  ] as const)('verify stays read-only for %s mapper', (_kind, mapper, status, stderr) => {
    const run = runOperator('verify', [mapper]);

    expect(run.status).toBe(status);
    expect(run.stderr).toBe(stderr);
    expect(run.writes).toEqual([]);
  });

  it('fails closed when the mapper list response is empty', () => {
    const run = runOperator('reconcile', '');

    expect(run.status).not.toBe(0);
    expect(run.stderr).toBe(
      'ssf-runtime service client: failed to resolve the audience mapper uniquely\n'
    );
    expect(run.mapperWrites).toEqual([]);
  });
});

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
    expect(source).toContain('error("ambiguous audience mapper")');
  });
});
