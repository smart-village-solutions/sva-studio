import { describe, expect, it } from 'vitest';

import { buildRemoteAppConfig, compareRemoteConfigShadow, parseRemoteConfigLayer, runBuildRemoteAppConfig } from './build-remote-app-config.ts';
import { remoteConfigContract } from './remote-config-contract.ts';
import { PromoteContractError, redactPromoteFailure } from './promote-result.ts';

const profile = Object.entries(remoteConfigContract)
  .filter(([, contract]) => contract.kind === 'config')
  .map(([key, contract]) => {
    if (key === 'SVA_ALLOWED_INSTANCE_IDS') return `${key}=`;
    if (contract.type === 'boolean') return `${key}=false`;
    if (contract.type === 'integer') return `${key}=5000`;
    if (contract.type === 'url') return `${key}=https://example.test/${key.toLowerCase()}`;
    return `${key}=value`;
  }).join('\n');

const overrides = Object.entries(remoteConfigContract)
  .filter(([, contract]) => contract.kind !== 'config')
  .map(([key, contract]) => `${key}=${contract.kind === 'secret-reference' ? 'external_secret_v1' : `sensitive-${key}`}`)
  .join('\n');

describe('remote app config builder', () => {
  it('merges deterministically while evidence contains references but no secret values', () => {
    const result = buildRemoteAppConfig({ environment: 'staging', profile, overrides });
    expect(result.source.split('\n').filter(Boolean)).toEqual([...result.source.split('\n').filter(Boolean)].sort());
    expect(result.secretReferences).toEqual(['external_secret_v1']);
    expect(JSON.stringify({ configRevision: result.configRevision, keys: result.keys, secretReferences: result.secretReferences })).not.toContain('sensitive-');
  });

  it('rejects duplicates, unknown keys, placeholders, misplaced config and invalid references', () => {
    expect(() => parseRemoteConfigLayer('dev', 'profile', 'SVA_RUNTIME_PROFILE=studio\nSVA_RUNTIME_PROFILE=other')).toThrow(PromoteContractError);
    expect(() => parseRemoteConfigLayer('dev', 'profile', 'UNKNOWN=value')).toThrow(/PROMOTE_CONFIG_INVALID/u);
    expect(() => buildRemoteAppConfig({ environment: 'dev', profile, overrides: overrides.replace('external_secret_v1', 'not a reference') })).toThrow(/PROMOTE_CONFIG_INVALID/u);
    expect(() => buildRemoteAppConfig({ environment: 'dev', profile, overrides: `${overrides}\nSVA_STACK_NAME=secret-layer` })).toThrow(/PROMOTE_CONFIG_INVALID/u);
    expect(() => buildRemoteAppConfig({ environment: 'dev', profile: profile.replace('SVA_RUNTIME_PROFILE=value', 'SVA_RUNTIME_PROFILE=__SET__'), overrides })).toThrow(/PROMOTE_CONFIG_INVALID/u);
    expect(() => buildRemoteAppConfig({ environment: 'dev', profile: profile.replace('SVA_RUNTIME_PROFILE=value', 'SVA_RUNTIME_PROFILE=   '), overrides })).toThrow(/PROMOTE_CONFIG_INVALID/u);
    expect(() => buildRemoteAppConfig({ environment: 'dev', profile: profile.replace('SVA_RUNTIME_PROFILE=value', 'SVA_RUNTIME_PROFILE=  __SET__  '), overrides })).toThrow(/PROMOTE_CONFIG_INVALID/u);
  });

  it('compares only keys, non-sensitive values and reference names', () => {
    const candidate = buildRemoteAppConfig({ environment: 'prod', profile, overrides });
    const changedSecrets = candidate.source.replaceAll('sensitive-', 'rotated-');
    expect(compareRemoteConfigShadow('prod', changedSecrets, candidate)).toMatchObject({ equivalent: true });
    expect(compareRemoteConfigShadow('prod', candidate.source.replace('SVA_STACK_NAME=value', 'SVA_STACK_NAME=other'), candidate)).toMatchObject({ equivalent: false, configValueMismatches: ['SVA_STACK_NAME'] });
  });

  it('forbids local files without reading or disclosing their contents', () => {
    const stderr: string[] = [];
    const original = process.stderr.write;
    process.stderr.write = ((value: string) => { stderr.push(value); return true; }) as typeof process.stderr.write;
    try {
      expect(runBuildRemoteAppConfig(['--environment', 'dev', '--profile', 'config/runtime/dev.local.vars', '--output', '/tmp/unused'], {})).toBe(2);
    } finally {
      process.stderr.write = original;
    }
    expect(stderr.join('')).toContain('PROMOTE_CONFIG_SOURCE_FORBIDDEN');
    expect(stderr.join('')).not.toContain('APP_CONFIG');
  });

  it('redacts unknown internal errors', () => {
    expect(redactPromoteFailure(new Error('secret internal detail'), { environment: 'prod', phase: 'deploy' })).toEqual(expect.objectContaining({ code: 'PROMOTE_INTERNAL_ERROR' }));
    expect(JSON.stringify(redactPromoteFailure(new Error('secret internal detail'), { environment: 'prod', phase: 'deploy' }))).not.toContain('secret internal detail');
  });
});
