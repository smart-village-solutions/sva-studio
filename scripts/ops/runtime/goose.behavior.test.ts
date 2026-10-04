import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runGooseAgainstAcceptance } from './goose.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const setup = () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'goose-characterization-'));
  roots.push(rootDir);
  const migrationsDir = join(rootDir, 'packages/data/migrations');
  mkdirSync(migrationsDir, { recursive: true });
  writeFileSync(join(migrationsDir, '001_create.sql'), 'SELECT 1;\n');
  return { rootDir, migrationsDir };
};

const config = { repo: 'pressly/goose', version: 'v3.1.0' };

describe('goose acceptance execution', () => {
  it('runs the local container command and cleans staged assets after an execution error', () => {
    const { rootDir, migrationsDir } = setup();
    const calls: string[][] = [];
    const deps: Parameters<typeof runGooseAgainstAcceptance>[0] = {
      commandExists: vi.fn(() => true),
      getConfiguredStackName: vi.fn(() => 'studio'),
      rootDir,
      run: vi.fn((_root, _command, args) => {
        calls.push([...args]);
      }),
      runAcceptanceServiceScript: vi.fn(() => ''),
      runCapture: vi.fn((_root, command, args) => {
        if (command === 'bash') return '/tmp/goose';
        if (args[0] === 'ps') return 'container-1';
        throw new Error('goose failed');
      }),
      shellEscape: (value) => `'${value}'`,
    };

    expect(() =>
      runGooseAgainstAcceptance(
        deps,
        config,
        migrationsDir,
        '/repo/run-goose.sh',
        { POSTGRES_PASSWORD: 'secret' },
        'studio',
        'up'
      )
    ).toThrow('goose failed');
    expect(calls.map((args) => args.slice(0, 4))).toEqual([
      ['exec', 'container-1', 'rm', '-rf'],
      ['exec', 'container-1', 'mkdir', '-p'],
      ['cp', '/tmp/goose', 'container-1:/var/tmp/sva-goose/goose'],
      ['exec', 'container-1', 'chmod', '+x'],
      ['cp', `${migrationsDir}/.`, 'container-1:/var/tmp/sva-goose/migrations/'],
      ['exec', 'container-1', 'rm', '-rf'],
    ]);
  });

  it('reads remote status without applying SQL and propagates a remote database error', () => {
    const { rootDir, migrationsDir } = setup();
    const scripts: string[] = [];
    const runAcceptanceServiceScript = vi.fn((_env, _service, script: string) => {
      scripts.push(script);
      if (script.includes('SELECT version_id')) throw new Error('database unavailable');
      return '';
    });
    const deps: Parameters<typeof runGooseAgainstAcceptance>[0] = {
      commandExists: vi.fn(() => true),
      getConfiguredStackName: vi.fn(() => 'studio'),
      rootDir,
      run: vi.fn(),
      runAcceptanceServiceScript,
      runCapture: vi.fn(() => ''),
      shellEscape: (value) => `'${value}'`,
    };

    expect(() =>
      runGooseAgainstAcceptance(
        deps,
        config,
        migrationsDir,
        '/repo/run-goose.sh',
        { POSTGRES_PASSWORD: 'secret' },
        'studio',
        'status'
      )
    ).toThrow('database unavailable');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain('SELECT version_id');
    expect(scripts[0]).not.toContain('INSERT INTO goose_db_version');
  });

  it('uploads remote assets before querying status and applies only pending migrations', () => {
    const { rootDir, migrationsDir } = setup();
    writeFileSync(join(migrationsDir, '002_add_column.sql'), 'SELECT 2;\n');
    const scripts: string[] = [];
    const deps: Parameters<typeof runGooseAgainstAcceptance>[0] = {
      commandExists: vi.fn(() => true),
      getConfiguredStackName: vi.fn(() => 'studio'),
      rootDir,
      run: vi.fn(),
      runAcceptanceServiceScript: vi.fn((_env, _service, script: string) => {
        scripts.push(script);
        if (script.includes('SELECT version_id')) return '1\n';
        if (script.includes('INSERT INTO goose_db_version')) return 'applied:002_add_column.sql';
        return '';
      }),
      runCapture: vi.fn(() => ''),
      shellEscape: (value) => `'${value}'`,
    };

    const result = runGooseAgainstAcceptance(
      deps,
      config,
      migrationsDir,
      '/repo/run-goose.sh',
      { POSTGRES_PASSWORD: 'secret' },
      'studio',
      'up'
    );

    expect(result.summary).toBe('applied:002_add_column.sql');
    expect(scripts[0]).toContain('goose_linux_x86_64');
    expect(scripts[1]).toContain('001_create.sql');
    expect(scripts[2]).toContain('002_add_column.sql');
    expect(scripts[3]).toContain('SELECT version_id');
    expect(scripts[4]).toContain('002_add_column.sql');
    expect(scripts[5]).toContain('INSERT INTO goose_db_version');
    expect(scripts.join('\n')).not.toContain(
      'INSERT INTO goose_db_version (version_id, is_applied, tstamp)\nSELECT 1,'
    );
  });
});
