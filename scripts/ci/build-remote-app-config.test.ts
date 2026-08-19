import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildRemoteAppConfig,
  buildSelectedRemoteConfigEvidence,
  compareRemoteConfigShadow,
  parseRemoteConfigLayer,
  runBuildRemoteAppConfig,
  selectProtectedOverrides,
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

  it('derives deployment evidence from the actually selected shadow bundle', () => {
    const candidate = buildRemoteAppConfig({ environment: 'staging', profile, overrides });
    const selectedShadowBundle = candidate.source.replace(
      'SVA_STACK_NAME=value',
      'SVA_STACK_NAME=legacy-selected'
    );
    const selected = buildSelectedRemoteConfigEvidence('staging', selectedShadowBundle);

    expect(selected.configRevision).not.toBe(candidate.configRevision);
    expect(selected.secretReferences).toEqual(candidate.secretReferences);
    expect(JSON.stringify(selected)).not.toContain('sensitive-');
  });

  it('emits the same canonical trimmed values that it validates', () => {
    const result = buildRemoteAppConfig({
      environment: 'staging',
      profile: profile.replace('SVA_STACK_NAME=value', 'SVA_STACK_NAME=  value  '),
      overrides: overrides.replace('external_secret_v1', '  external_secret_v1  '),
    });

    expect(result.source).toContain('SVA_STACK_NAME=value\n');
    expect(result.source).toContain(
      'WASTE_DATABASE_PROVISIONER_PASSWORD_SECRET_NAME=external_secret_v1\n'
    );
    expect(result.source).not.toContain('  value  ');
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

  it('compares only keys, non-sensitive values and reference names', () => {
    const candidate = buildRemoteAppConfig({ environment: 'prod', profile, overrides });
    const changedSecrets = candidate.source.replaceAll('sensitive-', 'rotated-');
    expect(compareRemoteConfigShadow('prod', changedSecrets, candidate)).toMatchObject({
      equivalent: true,
    });
    expect(
      compareRemoteConfigShadow(
        'prod',
        candidate.source.replace('SVA_STACK_NAME=value', 'SVA_STACK_NAME=other'),
        candidate
      )
    ).toMatchObject({ equivalent: false, configValueMismatches: ['SVA_STACK_NAME'] });
    expect(
      compareRemoteConfigShadow(
        'prod',
        candidate.source.replace('external_secret_v1', 'external_secret_v2'),
        candidate
      )
    ).toMatchObject({
      equivalent: false,
      secretReferenceMismatches: ['WASTE_DATABASE_PROVISIONER_PASSWORD_SECRET_NAME'],
    });
  });

  it('uses only protected legacy values when explicit overrides are not configured', () => {
    const legacySource = `${profile.replace('SVA_MAINSERVER_SCOPE_RESOLVER_MODE=shadow', 'SVA_MAINSERVER_SCOPE_RESOLVER_MODE=compatibility')}\n${overrides}`;
    const protectedOverrides = selectProtectedOverrides('prod', legacySource);
    const result = buildRemoteAppConfig({
      environment: 'prod',
      profile,
      overrides: protectedOverrides,
    });

    expect(protectedOverrides).toBe(overrides);
    expect(result.source).toContain('SVA_MAINSERVER_SCOPE_RESOLVER_MODE=shadow\n');
    expect(result.source).not.toContain('SVA_MAINSERVER_SCOPE_RESOLVER_MODE=compatibility\n');
    expect(result.source).toContain('APP_DB_PASSWORD=sensitive-APP_DB_PASSWORD\n');
  });

  it('retains legacy connection secrets while dropping legacy operational config', () => {
    const protectedConnections = overrides
      .replace(
        'IAM_DATABASE_URL=sensitive-IAM_DATABASE_URL',
        'IAM_DATABASE_URL=postgres://protected'
      )
      .replace('REDIS_URL=sensitive-REDIS_URL', 'REDIS_URL=redis://protected');
    const legacyProfile = profile
      .replace('QUANTUM_ENDPOINT=value', 'QUANTUM_ENDPOINT=sva')
      .replace('SVA_PUBLIC_HOST=value', 'SVA_PUBLIC_HOST=studio.smart-village.app');
    const legacySource = `${legacyProfile}\n${protectedConnections}`;
    const protectedOverrides = selectProtectedOverrides('prod', legacySource);

    expect(protectedOverrides).toContain('IAM_DATABASE_URL=postgres://protected');
    expect(protectedOverrides).toContain('REDIS_URL=redis://protected');
    expect(protectedOverrides).not.toContain('QUANTUM_ENDPOINT');
    expect(protectedOverrides).not.toContain('SVA_PUBLIC_HOST');
  });

  it('prefers the explicit protected override bundle over legacy values', () => {
    expect(
      selectProtectedOverrides(
        'prod',
        `${profile}\n${overrides}`,
        'APP_DB_PASSWORD=explicit-secret'
      )
    ).toBe('APP_DB_PASSWORD=explicit-secret');
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
