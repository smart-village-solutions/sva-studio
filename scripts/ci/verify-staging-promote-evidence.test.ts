import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  buildArtifactDownloadArgs,
  isSuccessfulPromoteWorkflowRun,
  isSuccessfulStagingBackupWorkflowRun,
  listArtifacts,
  matchesSuccessfulStagingBackupEvidence,
  matchesSuccessfulStagingBackupEvidenceSet,
  matchesSuccessfulStagingEvidence,
  requiresStagingParity,
  selectEvidenceJsonFile,
  selectStagingBackupEvidenceJsonFiles,
} from './verify-staging-promote-evidence.ts';

const productionBackupWorkflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/production-backup-drill.yml'),
  'utf8'
);

describe('staging parity evidence', () => {
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
    expect(requiresStagingParity(target, `ghcr.io/example/app@sha256:${'b'.repeat(64)}`)).toBe(true);
    expect(requiresStagingParity(target, undefined)).toBe(true);
  });

  it('accepts only successful staging evidence for the exact target digest', () => {
    expect(
      matchesSuccessfulStagingEvidence(
        {
          digest: 'sha256:expected',
          environment: 'staging',
          mutation: 'completed',
          postflight: 'passed',
        },
        'sha256:expected'
      )
    ).toBe(true);
    expect(
      matchesSuccessfulStagingEvidence(
        {
          digest: 'sha256:expected',
          environment: 'staging',
          mutation: 'not-run',
          postflight: 'passed',
        },
        'sha256:expected'
      )
    ).toBe(true);
    expect(
      matchesSuccessfulStagingEvidence(
        { digest: 'sha256:expected', environment: 'staging', postflight: 'passed' },
        'sha256:expected'
      )
    ).toBe(false);
    expect(
      matchesSuccessfulStagingEvidence(
        {
          digest: 'sha256:other',
          environment: 'staging',
          mutation: 'completed',
          postflight: 'passed',
        },
        'sha256:expected'
      )
    ).toBe(false);
    expect(
      matchesSuccessfulStagingEvidence(
        {
          digest: 'sha256:expected',
          environment: 'prod',
          mutation: 'completed',
          postflight: 'passed',
        },
        'sha256:expected'
      )
    ).toBe(false);
    expect(
      matchesSuccessfulStagingEvidence(
        {
          digest: 'sha256:expected',
          environment: 'staging',
          mutation: 'completed',
          postflight: 'failed',
        },
        'sha256:expected'
      )
    ).toBe(false);
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
