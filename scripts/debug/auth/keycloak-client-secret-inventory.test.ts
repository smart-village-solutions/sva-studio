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
const helpers = runInNewContext(
  `${source.slice(source.indexOf('const booleanArguments'), source.indexOf('const stripOptionalQuotes'))}\n${source.slice(source.indexOf('const formatTokenValidation'), source.indexOf('const printTable'))}\n${source.slice(source.indexOf('const validateOutputOptions'), source.indexOf('const main'))}\n({ parseArgs, formatTokenValidation, validateOutputOptions })`,
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
    import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
    import assert from 'node:assert/strict';
    const scriptPath = process.argv[1];
    const source = readFileSync(scriptPath, 'utf8');
    const blocked = () => { throw new Error('forbidden_test_side_effect'); };
    const modules = {
      'node:crypto': { createHash },
      'node:fs': { existsSync: () => false, mkdtempSync: blocked, readFileSync: blocked, rmSync: blocked, writeFileSync: blocked },
      'node:os': { tmpdir: blocked },
      'node:path': { join: blocked, resolve: blocked },
      'node:child_process': { spawnSync: blocked },
      '@sva/core/security': { encryptFieldValue: blocked, parseFieldEncryptionConfigFromEnv: blocked },
    };
    const baseArgs = ['--base-url=https://test.invalid', '--admin-realm=test', '--admin-client-id=admin', '--admin-client-secret=synthetic-only', '--realms=test', '--clients=ok,disabled,public,empty,denied,missing'];
    for (const flags of [[], ['--json'], ['--reveal'], ['--markdown', '--reveal'], ['--markdown'], ['--sync-db', '--reveal'], ['--sync-db'], ['--help'], ['--unknown'], ['--env-file=missing']]) {
      const lines = [], errors = [], exits = [], requests = [];
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
      const context = createContext({ URLSearchParams, fetch, process: { argv: ['node', scriptPath, ...baseArgs, ...flags], env: { SVA_ALLOW_SECRET_OUTPUT: '1' }, exit: (code) => exits.push(code) }, console: { log: (line) => lines.push(line), error: (line) => errors.push(line) } });
      const module = new SourceTextModule(source, { identifier: scriptPath, context });
      await module.link((name) => {
        const values = modules[name];
        assert.ok(values, 'unexpected import');
        return new SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
      });
      await module.evaluate();
      await new Promise(setImmediate);
      assert.ok(!errors.some((line) => line.includes('forbidden_test_side_effect')));
      if (flags.includes('--help') || flags.includes('--unknown') || flags.includes('--env-file=missing') || (flags.includes('--markdown') && !flags.includes('--reveal')) || (flags.includes('--sync-db') && flags.includes('--reveal'))) assert.equal(requests.length, 0);
      else assert.ok(requests.length > 0);
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
          NODE_V8_COVERAGE: fileURLToPath(
            new URL('../../../.coverage-inventory/', import.meta.url)
          ),
        },
      }
    )
  ).toContain('complete synthetic CLI scenarios passed');
});
