import { describe, expect, it } from 'vitest';

import { verifyHotfixBuildEvidence } from './hotfix-build-evidence.ts';

const controllerSha = 'a'.repeat(40);
const sourceSha = 'b'.repeat(40);
const digest = `sha256:${'c'.repeat(64)}`;
const expected = {
  runId: 123,
  controllerSha,
  sourceSha,
  baseTag: 'studio-v0.10.4',
  ref: 'refs/heads/hotfix/studio-v0-10-5-changelog',
  studioDigest: digest,
};
const run = {
  id: 123,
  run_attempt: 2,
  path: '.github/workflows/build.yml',
  event: 'workflow_dispatch',
  head_branch: 'main',
  head_sha: controllerSha,
  status: 'completed',
  conclusion: 'success',
};
const jobs = [
  { name: 'Build', status: 'completed', conclusion: 'success' },
  { name: 'Verify distribution images', status: 'completed', conclusion: 'success' },
];
const evidence = {
  schemaVersion: 1,
  runId: 123,
  attempt: 2,
  controllerSha,
  sourceSha,
  baseTag: expected.baseTag,
  ref: expected.ref,
  studioDigest: digest,
  ssfDigest: `sha256:${'d'.repeat(64)}`,
  backupAgentDigest: `sha256:${'e'.repeat(64)}`,
};

describe('controlled hotfix Build evidence', () => {
  it('binds the exact run attempt, controller, source and all three image digests', () => {
    expect(verifyHotfixBuildEvidence(run, jobs, evidence, expected)).toEqual(evidence);
  });

  it.each([
    ['ordinary dispatch', { run: { ...run, head_branch: 'hotfix/studio' } }],
    ['wrong workflow', { run: { ...run, path: '.github/workflows/other.yml' } }],
    ['failed verification', { jobs: [jobs[0], { ...jobs[1], conclusion: 'failure' }] }],
    ['missing verification', { jobs: [jobs[0]] }],
    ['changed source', { evidence: { ...evidence, sourceSha: 'f'.repeat(40) } }],
    ['changed app digest', { evidence: { ...evidence, studioDigest: `sha256:${'f'.repeat(64)}` } }],
    ['wrong attempt', { evidence: { ...evidence, attempt: 1 } }],
    ['wrong controller', { run: { ...run, head_sha: 'f'.repeat(40) } }],
  ] as [string, { run?: typeof run; jobs?: typeof jobs; evidence?: typeof evidence }][])(
    'rejects %s',
    (_, override) => {
      expect(() =>
        verifyHotfixBuildEvidence(
          override.run ?? run,
          override.jobs ?? jobs,
          override.evidence ?? evidence,
          expected
        )
      ).toThrow();
    }
  );
});
