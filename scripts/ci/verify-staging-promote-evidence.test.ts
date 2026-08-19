import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { buildAppE2EEvidence } from './app-e2e-evidence.ts';
import {
  buildArtifactDownloadArgs,
  classifyStagingParityError,
  isSuccessfulPromoteWorkflowRun,
  isSuccessfulStagingBackupWorkflowRun,
  listArtifacts,
  matchesSuccessfulStagingBackupEvidence,
  matchesSuccessfulStagingBackupEvidenceSet,
  matchesSuccessfulStagingEvidence,
  recordStagingParityError,
  requiresStagingParity,
  selectEvidenceJsonFile,
  selectStagingBackupEvidenceJsonFiles,
  StagingParityNotFoundError,
} from './verify-staging-promote-evidence.ts';
import { buildStagingPromoteEvidence } from './write-staging-promote-evidence.ts';

const sourceSha = 'a'.repeat(40);
const targetDigest = `sha256:${'c'.repeat(64)}`;
const mainE2E = buildAppE2EEvidence({
  workflow: 'App E2E',
  event: 'push',
  ref: 'refs/heads/main',
  branch: 'main',
  headSha: sourceSha,
  runId: '123',
  runAttempt: 2,
  result: 'success',
  testOutcome: 'success',
});
const stagingPromoteEvidence = {
  schemaVersion: 2,
  completedAt: '2026-08-18T12:00:00.000Z',
  digest: targetDigest,
  environment: 'staging',
  mainE2E,
  mutation: 'completed',
  postflight: 'passed',
  sourceSha,
  workflowRunId: '456',
};
const legacyStagingPromoteEvidence = {
  completedAt: '2026-08-18T12:00:00.000Z',
  digest: targetDigest,
  environment: 'staging',
  mutation: 'completed',
  postflight: 'passed',
  workflowRunId: '456',
};

const productionBackupWorkflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/production-backup-drill.yml'),
  'utf8'
);
const stagingBackupWorkflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/staging-backup-drill.yml'),
  'utf8'
);

describe('staging parity evidence', () => {
  it('distinguishes an expected parity miss from unexpected internal failures', () => {
    expect(classifyStagingParityError(new StagingParityNotFoundError())).toBe(
      'PROMOTE_PARITY_DIGEST_MISMATCH'
    );
    expect(
      classifyStagingParityError(new Error('person@example.test\nhttps://internal.test'))
    ).toBe('PROMOTE_INTERNAL_ERROR');
    expect(classifyStagingParityError(JSON.parse('{"secret":"sentinel"}'))).toBe(
      'PROMOTE_INTERNAL_ERROR'
    );
  });

  it.each([
    [new StagingParityNotFoundError(), 'PROMOTE_PARITY_DIGEST_MISMATCH'],
    [new Error('person@example.test\nhttps://internal.test'), 'PROMOTE_INTERNAL_ERROR'],
  ])('records only the canonical static failure for %s', (error, expectedCode) => {
    const directory = mkdtempSync(resolve(tmpdir(), 'staging-parity-failure-'));
    const failurePath = resolve(directory, 'failure.json');
    let stderr = '';
    try {
      recordStagingParityError(
        error,
        { PROMOTE_FAILURE_PATH: failurePath },
        {
          write: (chunk) => {
            stderr += String(chunk);
            return true;
          },
        }
      );
      expect(JSON.parse(readFileSync(failurePath, 'utf8'))).toMatchObject({
        code: expectedCode,
        environment: 'prod',
        phase: 'staging-parity',
      });
      expect(stderr).toBe(`${expectedCode}\n`);
      expect(`${stderr}${readFileSync(failurePath, 'utf8')}`).not.toMatch(
        /person@example\.test|internal\.test/u
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it.each([
    ['staging', stagingBackupWorkflow],
    ['production', productionBackupWorkflow],
  ])(
    'uses current %s backup tooling while validating the immutable image revision',
    (_, workflow) => {
      expect(workflow).toContain('checkout current backup tooling source');
      expect(workflow).toContain('git merge-base --is-ancestor');
      expect(workflow).not.toContain('git checkout --detach');
      expect(workflow).toContain(
        '--expected-revision "$(git rev-parse --verify "${CHANGE_HEAD}^{commit}")"'
      );
    }
  );

  it('binds the production backup drill to the immutable image reference and digest', () => {
    const parityStep = productionBackupWorkflow.match(
      /- name: require successful staging backup parity[\s\S]*?run: pnpm exec tsx scripts\/ci\/verify-staging-promote-evidence\.ts backup-drill/u
    )?.[0];

    expect(parityStep).toContain(
      'DEPLOY_IMAGE_DIGEST: ${{ steps.image_contract.outputs.deploy_summary_digest }}'
    );
    expect(parityStep).toContain(
      'DEPLOY_IMAGE_REF: ${{ steps.image_contract.outputs.deploy_image_ref }}'
    );
  });

  it('requires staging evidence only when production would change the live digest', () => {
    const target = `ghcr.io/example/app@sha256:${'a'.repeat(64)}`;
    expect(requiresStagingParity(target, target)).toBe(false);
    expect(requiresStagingParity(target, `ghcr.io/example/app@sha256:${'b'.repeat(64)}`)).toBe(
      true
    );
    expect(requiresStagingParity(target, undefined)).toBe(true);
    expect(requiresStagingParity(target, target, true)).toBe(true);
  });

  it('accepts only strict successful staging evidence bound to digest and source SHA', () => {
    expect(
      matchesSuccessfulStagingEvidence(stagingPromoteEvidence, targetDigest, sourceSha, 'enforce')
    ).toBe(true);
    expect(
      matchesSuccessfulStagingEvidence(
        { ...stagingPromoteEvidence, mutation: 'not-run' },
        targetDigest,
        sourceSha,
        'enforce'
      )
    ).toBe(true);
    expect(
      matchesSuccessfulStagingEvidence(
        { ...stagingPromoteEvidence, digest: 'sha256:other' },
        targetDigest,
        sourceSha,
        'enforce'
      )
    ).toBe(false);
    expect(
      matchesSuccessfulStagingEvidence(
        { ...stagingPromoteEvidence, environment: 'prod' },
        targetDigest,
        sourceSha,
        'enforce'
      )
    ).toBe(false);
    expect(
      matchesSuccessfulStagingEvidence(
        { ...stagingPromoteEvidence, postflight: 'failed' },
        targetDigest,
        sourceSha,
        'enforce'
      )
    ).toBe(false);
  });

  it('enforce rejects legacy, foreign-source, and non-canonical staging evidence', () => {
    expect(
      matchesSuccessfulStagingEvidence(
        legacyStagingPromoteEvidence,
        targetDigest,
        sourceSha,
        'enforce'
      )
    ).toBe(false);
    expect(
      matchesSuccessfulStagingEvidence(
        { ...stagingPromoteEvidence, mainE2E: null },
        targetDigest,
        sourceSha,
        'enforce'
      )
    ).toBe(false);
    expect(
      matchesSuccessfulStagingEvidence(
        stagingPromoteEvidence,
        targetDigest,
        'b'.repeat(40),
        'enforce'
      )
    ).toBe(false);
    expect(
      matchesSuccessfulStagingEvidence(
        {
          ...stagingPromoteEvidence,
          mainE2E: { ...mainE2E, evidenceClass: 'diagnostic' },
        },
        targetDigest,
        sourceSha,
        'enforce'
      )
    ).toBe(false);
    expect(
      matchesSuccessfulStagingEvidence(
        { ...stagingPromoteEvidence, unexpected: true },
        targetDigest,
        sourceSha,
        'enforce'
      )
    ).toBe(false);
    expect(
      matchesSuccessfulStagingEvidence(
        {
          digest: 'sha256:expected',
          environment: 'staging',
          mutation: 'completed',
          postflight: 'passed',
        },
        targetDigest,
        sourceSha,
        'enforce'
      )
    ).toBe(false);
  });

  it('keeps legacy parity in disabled and invalid shadow modes, but writes v2 when observed', () => {
    const baseEnv = {
      CHANGE_HEAD_SHA: sourceSha,
      DEPLOY_IMAGE_DIGEST: targetDigest,
      GITHUB_RUN_ID: '456',
      STAGING_MUTATION: 'true',
    };
    const standard = buildStagingPromoteEvidence(
      {
        ...baseEnv,
        MAIN_E2E_ATTESTATION: JSON.stringify(mainE2E),
        MAIN_E2E_GATE_MODE: 'shadow',
        PROMOTE_MODE: 'standard',
      },
      '2026-08-18T12:00:00.000Z'
    );
    const disabled = buildStagingPromoteEvidence(
      { ...baseEnv, MAIN_E2E_GATE_MODE: 'disabled', PROMOTE_MODE: 'standard' },
      '2026-08-18T12:00:00.000Z'
    );
    const shadowInvalid = buildStagingPromoteEvidence(
      { ...baseEnv, MAIN_E2E_GATE_MODE: 'shadow', PROMOTE_MODE: 'standard' },
      '2026-08-18T12:00:00.000Z'
    );

    expect(standard).toMatchObject({ sourceSha, mainE2E, schemaVersion: 2 });
    expect(disabled).toEqual(legacyStagingPromoteEvidence);
    expect(shadowInvalid).toEqual(legacyStagingPromoteEvidence);
    expect(matchesSuccessfulStagingEvidence(disabled, targetDigest, sourceSha, 'disabled')).toBe(
      true
    );
    expect(matchesSuccessfulStagingEvidence(shadowInvalid, targetDigest, sourceSha, 'shadow')).toBe(
      true
    );
    expect(
      matchesSuccessfulStagingEvidence(shadowInvalid, targetDigest, sourceSha, 'enforce')
    ).toBe(false);
  });

  it('keeps recovery legacy before activation and never accepts it in enforce mode', () => {
    const baseEnv = {
      CHANGE_HEAD_SHA: sourceSha,
      DEPLOY_IMAGE_DIGEST: targetDigest,
      GITHUB_RUN_ID: '456',
      MAIN_E2E_GATE_MODE: 'shadow',
      STAGING_MUTATION: 'true',
    };
    const recovery = buildStagingPromoteEvidence(
      { ...baseEnv, PROMOTE_MODE: 'recovery' },
      '2026-08-18T12:00:00.000Z'
    );
    expect(recovery).toEqual(legacyStagingPromoteEvidence);
    expect(matchesSuccessfulStagingEvidence(recovery, targetDigest, sourceSha, 'shadow')).toBe(
      true
    );
    expect(matchesSuccessfulStagingEvidence(recovery, targetDigest, sourceSha, 'enforce')).toBe(
      false
    );
    expect(() =>
      buildStagingPromoteEvidence({
        ...baseEnv,
        MAIN_E2E_ATTESTATION: JSON.stringify(mainE2E),
        MAIN_E2E_GATE_MODE: 'shadow',
        PROMOTE_MODE: 'recovery',
      })
    ).toThrow(/Recovery-Staging/u);
  });

  it('rejects missing, malformed, or foreign standard-staging attestations', () => {
    const baseEnv = {
      CHANGE_HEAD_SHA: sourceSha,
      DEPLOY_IMAGE_DIGEST: targetDigest,
      GITHUB_RUN_ID: '456',
      MAIN_E2E_GATE_MODE: 'enforce',
      PROMOTE_MODE: 'standard',
      STAGING_MUTATION: 'false',
    };

    expect(() => buildStagingPromoteEvidence(baseEnv)).toThrow(/MAIN_E2E_ATTESTATION/u);
    expect(() => buildStagingPromoteEvidence({ ...baseEnv, MAIN_E2E_ATTESTATION: '{' })).toThrow(
      /MAIN_E2E_ATTESTATION/u
    );
    expect(() =>
      buildStagingPromoteEvidence({
        ...baseEnv,
        MAIN_E2E_ATTESTATION: JSON.stringify({ ...mainE2E, headSha: 'b'.repeat(40) }),
      })
    ).toThrow(/Main-Push/u);
  });

  it('accepts only a successful staging backup drill for the exact target digest', () => {
    expect(
      matchesSuccessfulStagingBackupEvidence(
        {
          deployImageDigest: 'sha256:expected',
          environment: 'staging',
          status: 'succeeded',
        },
        'sha256:expected'
      )
    ).toBe(true);
    expect(
      matchesSuccessfulStagingBackupEvidence(
        {
          deployImageDigest: 'sha256:other',
          environment: 'staging',
          status: 'succeeded',
        },
        'sha256:expected'
      )
    ).toBe(false);
    expect(
      matchesSuccessfulStagingBackupEvidence(
        {
          deployImageDigest: 'sha256:expected',
          environment: 'prod',
          status: 'succeeded',
        },
        'sha256:expected'
      )
    ).toBe(false);
  });

  it('accepts distinct Studio and Waste evidence only when both match the target digest', () => {
    const studio = {
      database: 'studio',
      deployImageDigest: 'sha256:expected',
      environment: 'staging',
      status: 'succeeded',
    };
    const waste = { ...studio, database: 'waste' };

    expect(matchesSuccessfulStagingBackupEvidenceSet([studio, waste], 'sha256:expected')).toBe(
      true
    );
    expect(
      matchesSuccessfulStagingBackupEvidenceSet(
        [studio, { ...waste, deployImageDigest: 'sha256:other' }],
        'sha256:expected'
      )
    ).toBe(false);
    expect(matchesSuccessfulStagingBackupEvidenceSet([studio, studio], 'sha256:expected')).toBe(
      false
    );
  });

  it('reads paginated artifact responses before filtering parity evidence', () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }));
    const artifacts = listArtifacts((page) =>
      page === 1
        ? { artifacts: firstPage, total_count: 101 }
        : { artifacts: [{ id: 101, name: 'promote-staging-parity-101' }], total_count: 101 }
    );

    expect(artifacts).toHaveLength(101);
    expect(artifacts.at(-1)).toMatchObject({ name: 'promote-staging-parity-101' });
  });

  it('limits artifact pagination to ten pages', () => {
    const readPage = vi.fn(() => ({
      artifacts: Array.from({ length: 100 }, () => ({})),
      total_count: 2_000,
    }));

    expect(listArtifacts(readPage)).toHaveLength(1_000);
    expect(readPage).toHaveBeenCalledTimes(10);
  });

  it('selects exactly one JSON evidence file from an artifact archive', () => {
    expect(selectEvidenceJsonFile('evidence.json\n')).toBe('evidence.json');
    expect(selectEvidenceJsonFile('evidence.json\nmetadata.json\n')).toBeUndefined();
    expect(selectEvidenceJsonFile('README.md\n')).toBeUndefined();
  });

  it('selects one or two agent results when a staging drill artifact contains verification evidence', () => {
    const archiveEntries = [
      'promote-backup-agent-gha-30512741172-1.json',
      'promote-backup-verification-30512741172-1.json',
    ].join('\n');

    expect(selectStagingBackupEvidenceJsonFiles(archiveEntries)).toEqual([
      'promote-backup-agent-gha-30512741172-1.json',
    ]);
    expect(
      selectStagingBackupEvidenceJsonFiles(
        `${archiveEntries}\npromote-backup-agent-gha-30512741172-1-waste.json\n`
      )
    ).toEqual([
      'promote-backup-agent-gha-30512741172-1.json',
      'promote-backup-agent-gha-30512741172-1-waste.json',
    ]);
    expect(
      selectStagingBackupEvidenceJsonFiles(
        `${archiveEntries}\npromote-backup-agent-gha-30512741172-1-waste.json\npromote-backup-agent-gha-duplicate.json\n`
      )
    ).toBeUndefined();
  });

  it('downloads parity artifacts through gh api without unsupported output flags', () => {
    expect(buildArtifactDownloadArgs('smart-village-solutions/sva-studio', 42)).toEqual([
      'api',
      'repos/smart-village-solutions/sva-studio/actions/artifacts/42/zip',
    ]);
  });

  it('accepts artifacts only from successful Promote workflow runs', () => {
    expect(
      isSuccessfulPromoteWorkflowRun({
        conclusion: 'success',
        path: '.github/workflows/promote.yml',
      })
    ).toBe(true);
    expect(
      isSuccessfulPromoteWorkflowRun({
        conclusion: 'failure',
        path: '.github/workflows/promote.yml',
      })
    ).toBe(false);
    expect(
      isSuccessfulPromoteWorkflowRun({
        conclusion: 'success',
        path: '.github/workflows/build.yml',
      })
    ).toBe(false);
  });

  it('accepts staging backup evidence only from successful staging drill runs', () => {
    expect(
      isSuccessfulStagingBackupWorkflowRun({
        conclusion: 'success',
        path: '.github/workflows/staging-backup-drill.yml',
      })
    ).toBe(true);
    expect(
      isSuccessfulStagingBackupWorkflowRun({
        conclusion: 'failure',
        path: '.github/workflows/staging-backup-drill.yml',
      })
    ).toBe(false);
    expect(
      isSuccessfulStagingBackupWorkflowRun({
        conclusion: 'success',
        path: '.github/workflows/promote.yml',
      })
    ).toBe(false);
  });
});
