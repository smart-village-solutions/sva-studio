import { describe, expect, it } from 'vitest';

import { validateStagingLineConfig } from './verify-staging-line-config.ts';

const run = {
  id: 37245060132,
  run_attempt: 1,
  path: '.github/workflows/promote.yml',
  event: 'workflow_dispatch',
  head_branch: 'main',
  status: 'completed',
  conclusion: 'success',
};
const expected = {
  runId: 37245060132,
  attempt: 1,
  digest: `sha256:${'a'.repeat(64)}`,
  configRevision: 'b'.repeat(64),
  secretReferences: ['studio_staging_waste_database_provisioner_password_v1'],
};
const evidence = {
  schemaVersion: 2,
  environment: 'staging',
  status: 'passed',
  run: { id: '37245060132', attempt: 1 },
  image: { targetDigest: expected.digest },
  config: {
    revision: expected.configRevision,
    externalSecretReferences: expected.secretReferences,
  },
};

describe('previous Staging line config', () => {
  it('accepts the exact successful promote attempt and redacted references', () => {
    expect(() => validateStagingLineConfig(run, evidence, expected)).not.toThrow();
  });

  it.each([
    ['stale attempt', { run: { ...run, run_attempt: 2 } }],
    ['wrong environment', { evidence: { ...evidence, environment: 'prod' } }],
    [
      'wrong digest',
      { evidence: { ...evidence, image: { targetDigest: `sha256:${'c'.repeat(64)}` } } },
    ],
    [
      'wrong live config',
      { evidence: { ...evidence, config: { ...evidence.config, revision: 'c'.repeat(64) } } },
    ],
    [
      'changed secret reference',
      {
        evidence: {
          ...evidence,
          config: { ...evidence.config, externalSecretReferences: ['other_reference'] },
        },
      },
    ],
    [
      'missing secret reference',
      { evidence: { ...evidence, config: { revision: expected.configRevision } } },
    ],
    ['failed promote', { run: { ...run, conclusion: 'failure' } }],
  ])('rejects %s', (_, override: { run?: typeof run; evidence?: object }) => {
    expect(() =>
      validateStagingLineConfig(override.run ?? run, override.evidence ?? evidence, expected)
    ).toThrow();
  });
});
