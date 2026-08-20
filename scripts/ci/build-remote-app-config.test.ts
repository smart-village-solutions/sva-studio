import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildRemoteAppConfig,
  parseRemoteConfigLayer,
  runBuildRemoteAppConfig,
} from './build-remote-app-config.ts';
import { remoteConfigContract } from './remote-config-contract.ts';
import { PromoteContractError, redactPromoteFailure } from './promote-result.ts';

const profile = Object.entries(remoteConfigContract)
  .filter(([, contract]) => contract.kind === 'config')
  .map(([key, contract]) => {
    if (key === 'SVA_ALLOWED_INSTANCE_IDS') return `${key}=`;
    if (contract.type === 'boolean') return `${key}=false`;
    if (contract.type === 'integer') return `${key}=5000`;
    if (contract.type === 'url') return `${key}=https://example.test/${key.toLowerCase()}`;
    if (contract.allowedValues?.[0]) return `${key}=${contract.allowedValues[0]}`;
    return `${key}=value`;
  })
  .join('\n');

const overrides = Object.entries(remoteConfigContract)
  .filter(([, contract]) => contract.kind !== 'config')
  .map(
    ([key, contract]) =>
      `${key}=${contract.kind === 'secret-reference' ? 'external_secret_v1' : `sensitive-${key}`}`
  )
  .join('\n');

describe('remote app config builder', () => {
  it.each([
    ['dev', 'development', 'automatic'],
    ['staging', 'staging', 'automatic'],
    ['prod', 'production', 'automatic'],
  ] as const)(
    'materializes the %s deployment environment and resolver mode',
    (environment, deploymentEnvironment, resolverMode) => {
      const remoteProfile = readFileSync(
        new URL(`../../config/runtime/remote/${environment}.vars`, import.meta.url),
        'utf8'
      );
      const result = buildRemoteAppConfig({ environment, profile: remoteProfile, overrides });

      expect(result.source).toContain(`SVA_DEPLOYMENT_ENVIRONMENT=${deploymentEnvironment}\n`);
      expect(result.source).toContain('ENABLE_OTEL=false\n');
      expect(result.source).toContain(`SVA_MAINSERVER_SCOPE_RESOLVER_MODE=${resolverMode}\n`);
    }
  );

  it.each([
    ['dev', 'de-teststadt-dev'],
    ['staging', 'de-studio-sandbox'],
  ] as const)(
    'binds the %s candidate to its explicit release tenant scope',
    (environment, allowedInstanceId) => {
      const remoteProfile = readFileSync(
        new URL(`../../config/runtime/remote/${environment}.vars`, import.meta.url),
        'utf8'
      );

      expect(remoteProfile).toContain(`SVA_ALLOWED_INSTANCE_IDS=${allowedInstanceId}\n`);
    }
  );

  it('fails compose interpolation when the deployment environment is missing', () => {
    const compose = readFileSync(
      new URL('../../deploy/portainer/docker-compose.studio.yml', import.meta.url),
      'utf8'
    );

    expect(compose).toContain(
      "SVA_DEPLOYMENT_ENVIRONMENT: '${SVA_DEPLOYMENT_ENVIRONMENT:?SVA_DEPLOYMENT_ENVIRONMENT must be set}'"
    );
  });

  it('merges deterministically while evidence contains references but no secret values', () => {
    const result = buildRemoteAppConfig({ environment: 'staging', profile, overrides });
    expect(result.source.split('\n').filter(Boolean)).toEqual(
      [...result.source.split('\n').filter(Boolean)].sort()
    );
    expect(result.secretReferences).toEqual(['external_secret_v1']);
    expect(
      JSON.stringify({
        configRevision: result.configRevision,
        keys: result.keys,
        secretReferences: result.secretReferences,
      })
    ).not.toContain('sensitive-');
  });

  it('publishes only config revision and external reference names as workflow outputs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'remote-config-evidence-'));
    const profilePath = join(directory, 'staging.vars');
    const githubOutput = join(directory, 'github-output');
    try {
      writeFileSync(profilePath, profile, 'utf8');
      expect(
        runBuildRemoteAppConfig(
          [
            '--environment',
            'staging',
            '--profile',
            profilePath,
            '--output',
            join(directory, 'config.vars'),
          ],
          { PROMOTE_CONFIG_OVERRIDES: overrides, GITHUB_OUTPUT: githubOutput }
        )
      ).toBe(0);
      const output = readFileSync(githubOutput, 'utf8');
      expect(output).toMatch(/^config_revision=[0-9a-f]{64}$/mu);
      expect(output).toContain('secret_references=["external_secret_v1"]');
      expect(output).not.toContain('sensitive-');
      expect(output).not.toContain('APP_DB_PASSWORD');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects non-canonical whitespace so hashed and deployed values cannot diverge', () => {
    expect(() =>
      buildRemoteAppConfig({
        environment: 'staging',
        profile: profile.replace('SVA_STACK_NAME=value', 'SVA_STACK_NAME= value '),
        overrides,
      })
    ).toThrow(/PROMOTE_CONFIG_INVALID/u);
  });

  it('rejects duplicates, unknown keys, placeholders, misplaced config and invalid references', () => {
    expect(() =>
      parseRemoteConfigLayer(
        'dev',
        'profile',
        'SVA_RUNTIME_PROFILE=studio\nSVA_RUNTIME_PROFILE=other'
      )
    ).toThrow(PromoteContractError);
    expect(() => parseRemoteConfigLayer('dev', 'profile', 'UNKNOWN=value')).toThrow(
      /PROMOTE_CONFIG_INVALID/u
    );
    expect(() =>
      parseRemoteConfigLayer('prod', 'legacy', 'UNKNOWN_TWO=value\nUNKNOWN_ONE=value')
    ).toThrow(/UNKNOWN_ONE, UNKNOWN_TWO/u);
    expect(() => parseRemoteConfigLayer('prod', 'legacy', 'toString=value')).toThrow(/toString/u);
    expect(() =>
      buildRemoteAppConfig({
        environment: 'dev',
        profile,
        overrides: overrides.replace('external_secret_v1', 'not a reference'),
      })
    ).toThrow(/PROMOTE_CONFIG_INVALID/u);
    expect(() =>
      buildRemoteAppConfig({
        environment: 'dev',
        profile,
        overrides: `${overrides}\nSVA_STACK_NAME=secret-layer`,
      })
    ).toThrow(/PROMOTE_CONFIG_INVALID/u);
    expect(() =>
      buildRemoteAppConfig({
        environment: 'dev',
        profile: `${profile}\nAPP_DB_PASSWORD=committed-secret`,
        overrides,
      })
    ).toThrow(/PROMOTE_CONFIG_SOURCE_FORBIDDEN/u);
    expect(() =>
      buildRemoteAppConfig({
        environment: 'dev',
        profile: profile.replace('SVA_RUNTIME_PROFILE=value', 'SVA_RUNTIME_PROFILE=__SET__'),
        overrides,
      })
    ).toThrow(/PROMOTE_CONFIG_INVALID/u);
    expect(() =>
      buildRemoteAppConfig({
        environment: 'dev',
        profile: profile.replace('SVA_RUNTIME_PROFILE=value', 'SVA_RUNTIME_PROFILE=   '),
        overrides,
      })
    ).toThrow(/PROMOTE_CONFIG_INVALID/u);
    expect(() =>
      buildRemoteAppConfig({
        environment: 'dev',
        profile: profile.replace('SVA_RUNTIME_PROFILE=value', 'SVA_RUNTIME_PROFILE=  __SET__  '),
        overrides,
      })
    ).toThrow(/PROMOTE_CONFIG_INVALID/u);
    expect(() =>
      buildRemoteAppConfig({
        environment: 'dev',
        profile: profile.replace(
          'SVA_MAINSERVER_SCOPE_RESOLVER_MODE=shadow',
          'SVA_MAINSERVER_SCOPE_RESOLVER_MODE=unsafe'
        ),
        overrides,
      })
    ).toThrow(/PROMOTE_CONFIG_INVALID/u);
  });

  it('fails before writing config when protected overrides are missing', () => {
    const directory = mkdtempSync(join(tmpdir(), 'remote-config-required-'));
    const profilePath = join(directory, 'staging.vars');
    const outputPath = join(directory, 'config.vars');
    const failurePath = join(directory, 'failure.json');
    const stderr: string[] = [];
    const original = process.stderr.write;
    process.stderr.write = ((value: string) => {
      stderr.push(value);
      return true;
    }) as typeof process.stderr.write;
    try {
      writeFileSync(profilePath, profile, 'utf8');
      expect(
        runBuildRemoteAppConfig(
          ['--environment', 'staging', '--profile', profilePath, '--output', outputPath],
          { PROMOTE_FAILURE_PATH: failurePath }
        )
      ).toBe(2);
      expect(() => readFileSync(outputPath, 'utf8')).toThrow();
    } finally {
      process.stderr.write = original;
    }
    expect(stderr.join('')).toContain('PROMOTE_CONFIG_REQUIRED_KEY_MISSING');
    expect(JSON.parse(readFileSync(failurePath, 'utf8'))).toEqual(
      expect.objectContaining({ code: 'PROMOTE_CONFIG_REQUIRED_KEY_MISSING' })
    );
    rmSync(directory, { recursive: true, force: true });
  });

  it('never falls back to APP_CONFIG when protected overrides are missing', () => {
    const directory = mkdtempSync(join(tmpdir(), 'remote-config-no-legacy-'));
    const profilePath = join(directory, 'prod.vars');
    const original = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      writeFileSync(profilePath, profile, 'utf8');
      expect(
        runBuildRemoteAppConfig(
          ['--environment', 'prod', '--profile', profilePath, '--output', join(directory, 'out')],
          { APP_CONFIG: `${profile}\n${overrides}` }
        )
      ).toBe(2);
    } finally {
      process.stderr.write = original;
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('forbids local files without reading or disclosing their contents', () => {
    const directory = mkdtempSync(join(tmpdir(), 'remote-config-failure-'));
    const failurePath = join(directory, 'failure.json');
    const stderr: string[] = [];
    const original = process.stderr.write;
    process.stderr.write = ((value: string) => {
      stderr.push(value);
      return true;
    }) as typeof process.stderr.write;
    try {
      expect(
        runBuildRemoteAppConfig(
          [
            '--environment',
            'dev',
            '--profile',
            'config/runtime/dev.local.vars',
            '--output',
            join(directory, 'unused'),
          ],
          { PROMOTE_FAILURE_PATH: failurePath }
        )
      ).toBe(2);
    } finally {
      process.stderr.write = original;
    }
    expect(stderr.join('')).toContain('PROMOTE_CONFIG_SOURCE_FORBIDDEN');
    expect(stderr.join('')).not.toContain('APP_CONFIG');
    expect(JSON.parse(readFileSync(failurePath, 'utf8'))).toEqual(
      expect.objectContaining({ code: 'PROMOTE_CONFIG_SOURCE_FORBIDDEN', phase: 'config-build' })
    );
    rmSync(directory, { recursive: true, force: true });
  });

  it('redacts unknown internal errors', () => {
    expect(
      redactPromoteFailure(new Error('secret internal detail'), {
        environment: 'prod',
        phase: 'deploy',
      })
    ).toEqual(expect.objectContaining({ code: 'PROMOTE_INTERNAL_ERROR' }));
    expect(
      JSON.stringify(
        redactPromoteFailure(new Error('secret internal detail'), {
          environment: 'prod',
          phase: 'deploy',
        })
      )
    ).not.toContain('secret internal detail');
  });
});
