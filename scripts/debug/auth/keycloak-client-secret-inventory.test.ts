import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

// Evaluate only pure helpers: never load environment files or invoke main/auth/sync.
const source = readFileSync(
  new URL('./keycloak-client-secret-inventory.mjs', import.meta.url),
  'utf8'
);
const argsSource = readFileSync(
  new URL('./keycloak-client-secret-inventory.args.mjs', import.meta.url),
  'utf8'
).replace(/^export /gm, '');
const outputSource = readFileSync(
  new URL('./keycloak-client-secret-inventory.output.mjs', import.meta.url),
  'utf8'
).replace(/^export /gm, '');
const helpers = runInNewContext(
  `${argsSource.slice(argsSource.indexOf('const booleanArguments'), argsSource.indexOf('const stripOptionalQuotes'))}\n${outputSource.slice(outputSource.indexOf('const formatTokenValidation'), outputSource.indexOf('const printTable'))}\n${source.slice(source.indexOf('const validateOutputOptions'), source.indexOf('const main'))}\n({ parseArgs, formatTokenValidation, validateOutputOptions })`,
  { process: { env: {} } }
);

describe('inventory arguments and redacted validation labels', () => {
  it('keeps aliases, repeated environment files, empty values and unknown named options', () => {
    expect(
      helpers.parseArgs([
        '-h',
        '--json',
        '--markdown',
        '--reveal',
        '--sync-db',
        '--env-file=a',
        '--env-file=b',
        '--realms=',
        '--future=x=y',
      ])
    ).toEqual({
      help: true,
      json: true,
      markdown: true,
      reveal: true,
      'sync-db': true,
      'env-file': 'a,b',
      realms: '',
      future: 'x=y',
    });
    expect(helpers.parseArgs(['--json=false', '--json'])).toEqual({ json: true });
    expect(helpers.parseArgs(['--json', '--json=false'])).toEqual({ json: 'false' });
  });

  it.each(['--unknown', 'constructor', '__proto__', '--', 'json'])(
    'rejects positional or unsupported bare argument %s',
    (arg) => {
      expect(() => helpers.parseArgs([arg])).toThrow(`Unbekanntes Argument: ${arg}`);
    }
  );

  it.each([
    [undefined, ''],
    [{ status: 'ok', httpStatus: 200 }, 'ok:200'],
    [{ status: 'skipped', reason: 'service_account_disabled' }, 'service_account_disabled:'],
    [{ status: 'failed', httpStatus: 401 }, 'failed:401'],
    [{ status: 'failed', reason: '', httpStatus: 0 }, ':0'],
  ])('preserves the validation label for %j', (validation, label) => {
    expect(helpers.formatTokenValidation(validation)).toBe(label);
  });
});

it('keeps reveal, markdown and sync output safety checks before credential use', () => {
  expect(helpers.validateOutputOptions({})).toBe(false);
  expect(() => helpers.validateOutputOptions({ reveal: true })).toThrow('--reveal verweigert');
  expect(() => helpers.validateOutputOptions({ markdown: true })).toThrow(
    '--markdown gibt Secret-Werte aus'
  );
  expect(helpers.validateOutputOptions({ 'sync-db': true })).toBe(false);
  const allowed = runInNewContext(
    `${source.slice(source.indexOf('const validateOutputOptions'), source.indexOf('const main'))}\nvalidateOutputOptions`,
    { process: { env: { SVA_ALLOW_SECRET_OUTPUT: '1' } } }
  );
  expect(allowed({ reveal: true, markdown: true })).toBe(true);
  expect(() => allowed({ reveal: true, 'sync-db': true })).toThrow(
    '--sync-db darf nicht mit --reveal'
  );
});

it('exercises the complete CLI source with fail-closed synthetic dependencies', () => {
  const scriptPath = fileURLToPath(
    new URL('./keycloak-client-secret-inventory.mjs', import.meta.url)
  );
  const harness = `
    import { readFileSync } from 'node:fs';
    import { createHash } from 'node:crypto';
    import { fileURLToPath } from 'node:url';
    import { dirname, join, resolve } from 'node:path';
    import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
    import assert from 'node:assert/strict';
    const scriptPath = process.argv[1];
    const source = readFileSync(scriptPath, 'utf8');
    const allowedModules = new Set(['./keycloak-client-secret-inventory.args.mjs', './keycloak-client-secret-inventory.http.mjs', './keycloak-client-secret-inventory.sync.mjs', './keycloak-client-secret-inventory.output.mjs']);
    const baseArgs = ['--base-url=https://test.invalid', '--admin-realm=test', '--admin-client-id=admin', '--admin-client-secret=synthetic-only', '--realms=test', '--clients=ok,disabled,public,empty,denied,missing'];
    for (const flags of [[], ['--json'], ['--reveal'], ['--markdown', '--reveal'], ['--markdown'], ['--sync-db', '--reveal'], ['--sync-db'], ['--help'], ['--unknown'], ['--env-file=missing'], ['--env-file=synthetic.env'], ['--load-env-file=synthetic.env'], ['--keyring-env-file=synthetic.env'], ['--sync-db', '--clients=sva-studio,sva-studio-admin'], ['--sync-db', '--clients=sva-studio,sva-studio-admin', '--realm-instance-map=test:fail']]) {
      const lines = [], errors = [], exits = [], requests = [], writes = [], cleanups = [], encryptions = [], spawns = [];
      const syntheticEnv = { SVA_ALLOW_SECRET_OUTPUT: '1' };
      const tempDir = '/synthetic-tmp/sva-keycloak-secret-sync-fixture';
      const sqlPath = tempDir + '/sync.sql';
      const modules = {
        'node:crypto': { createHash },
        'node:fs': {
          existsSync: (path) => { if (path === 'missing') return false; assert.equal(path, 'synthetic.env'); return true; },
          readFileSync: (path, encoding) => { assert.equal(path, 'synthetic.env'); assert.equal(encoding, 'utf8'); return ['# comment', '', 'invalid', '=ignored', 'DOUBLE="double"', "SINGLE='single'", 'PLAIN= plain ', 'EMPTY=', 'IAM_PII_KEY="synthetic-key"'].join('\\n'); },
          mkdtempSync: (prefix) => { assert.equal(prefix, '/synthetic-tmp/sva-keycloak-secret-sync-'); return tempDir; },
          writeFileSync: (path, sql, options) => { assert.equal(path, sqlPath); assert.equal(JSON.stringify(options), JSON.stringify({ encoding: 'utf8', mode: 384 })); writes.push(sql); },
          rmSync: (path, options) => { assert.equal(path, tempDir); assert.equal(JSON.stringify(options), JSON.stringify({ force: true, recursive: true })); cleanups.push(path); },
        },
        'node:os': { tmpdir: () => '/synthetic-tmp' },
        'node:path': { join, resolve },
        'node:child_process': { spawnSync: (command, args, options) => {
          assert.equal(command, 'node'); assert.equal(JSON.stringify(args), JSON.stringify(['scripts/debug/auth/quantum-remote-query.mjs', sqlPath]));
          assert.equal(options.cwd, resolve(dirname(scriptPath), '../../..')); assert.equal(options.env, syntheticEnv);
          assert.equal(options.encoding, 'utf8'); assert.equal(options.maxBuffer, 20 * 1024 * 1024); spawns.push(args);
          return flags.includes('--realm-instance-map=test:fail') ? { status: 1, stdout: '', stderr: 'synthetic SQL failure' } : { status: 0, stdout: 'test|t|t|t\\nmissing|f|f|f\\n', stderr: '' };
        } },
        '@sva/core/security': {
          parseFieldEncryptionConfigFromEnv: (env) => { assert.equal(env, syntheticEnv); return 'synthetic-config'; },
          encryptFieldValue: (value, config, aad) => { assert.equal(value, 'synthetic-only'); assert.equal(config, 'synthetic-config'); encryptions.push(aad); return 'ciphertext-placeholder'; },
        },
      };
      const fetch = async (url, options = {}) => {
        requests.push(url);
        let body, status = 200;
        if (url.endsWith('/token')) {
          if (options.body.get('client_id') === 'denied') { body = 'invalid_client'; status = 401; }
          else body = { access_token: 'synthetic-token' };
        } else if (url.endsWith('/client-secret')) {
          body = { value: url.includes('/empty/') ? '' : 'synthetic-only' };
        } else {
          const id = new URL(url).searchParams.get('clientId');
          body = id === 'missing' ? [] : [{ id, clientId: id, enabled: true, publicClient: id === 'public', serviceAccountsEnabled: id !== 'disabled' }];
        }
        return { ok: status === 200, status, statusText: 'synthetic', text: async () => typeof body === 'string' ? body : JSON.stringify(body) };
      };
      const context = createContext({ URLSearchParams, fetch, process: { argv: ['node', scriptPath, ...baseArgs, ...flags], env: syntheticEnv, exit: (code) => exits.push(code) }, console: { log: (line) => lines.push(line), error: (line) => errors.push(line) } });
      const module = new SourceTextModule(source, { identifier: scriptPath, context, initializeImportMeta: (meta, module) => { meta.dirname = dirname(module.identifier); } });
      const linked = new Map();
      await module.link((name) => {
        if (allowedModules.has(name)) {
          const nestedPath = fileURLToPath(new URL(name, "file://" + scriptPath));
          if (!linked.has(nestedPath)) linked.set(nestedPath, new SourceTextModule(readFileSync(nestedPath, "utf8"), { identifier: nestedPath, context, initializeImportMeta: (meta, module) => { meta.dirname = dirname(module.identifier); } }));
          return linked.get(nestedPath);
        }
        const values = modules[name];
        assert.ok(values, 'unexpected import');
        return new SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
      });
      await module.evaluate();
      await new Promise(setImmediate);
      assert.ok(!errors.some((line) => line.includes('forbidden_test_side_effect')));
      if (flags.includes('--help') || flags.includes('--unknown') || flags.includes('--env-file=missing') || (flags.includes('--markdown') && !flags.includes('--reveal')) || (flags.includes('--sync-db') && flags.includes('--reveal'))) assert.equal(requests.length, 0);
      else assert.ok(requests.length > 0);
      if (flags.some((flag) => flag.endsWith('=synthetic.env'))) {
        assert.equal(syntheticEnv.IAM_PII_KEY, 'synthetic-key');
        if (flags.includes('--keyring-env-file=synthetic.env')) assert.equal(syntheticEnv.DOUBLE, undefined);
        else { assert.equal(syntheticEnv.DOUBLE, 'double'); assert.equal(syntheticEnv.SINGLE, 'single'); assert.equal(syntheticEnv.PLAIN, 'plain'); assert.equal(syntheticEnv.EMPTY, ''); }
      }
      if (flags.includes('--clients=sva-studio,sva-studio-admin')) {
        assert.equal(writes.length, 1, errors.join('; ')); assert.equal(spawns.length, 1); assert.deepEqual(cleanups, [tempDir]);
        assert.ok(writes[0].includes('ciphertext-placeholder')); assert.ok(!writes[0].includes('synthetic-only'));
        const instance = flags.includes('--realm-instance-map=test:fail') ? 'fail' : 'test';
        assert.deepEqual(encryptions, ['iam.instances.auth_client_secret:' + instance, 'iam.instances.tenant_admin_client_secret:' + instance]);
        if (instance === 'fail') { assert.deepEqual(exits, [1]); assert.ok(errors[0].includes('synthetic SQL failure')); }
        else { assert.equal(errors.length, 0); assert.ok(lines.some((line) => line.includes('not_found'))); assert.ok(!lines.some((line) => line.includes('synthetic-only'))); }
      }
      if (flags.length === 0) { assert.equal(exits.length, 0); assert.ok(lines.some((line) => line.includes('ok:200'))); assert.ok(lines.some((line) => line.includes('invalid_client:401'))); assert.ok(!lines.some((line) => line.includes('synthetic-only'))); }
    }
    console.log('complete synthetic CLI scenarios passed');
  `;
  expect(
    execFileSync(
      process.execPath,
      ['--experimental-vm-modules', '--input-type=module', '-e', harness, scriptPath],
      {
        encoding: 'utf8',
        env: {
          NODE_NO_WARNINGS: '1',
          NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE,
        },
      }
    )
  ).toContain('complete synthetic CLI scenarios passed');
});
