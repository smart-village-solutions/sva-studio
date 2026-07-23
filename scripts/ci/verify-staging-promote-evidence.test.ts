import { describe, expect, it } from 'vitest';

import {
  buildArtifactDownloadArgs,
  isSuccessfulPromoteWorkflowRun,
  listArtifacts,
  matchesSuccessfulStagingEvidence,
} from './verify-staging-promote-evidence.ts';

describe('staging parity evidence', () => {
  it('accepts only successful staging evidence for the exact target digest', () => {
    expect(matchesSuccessfulStagingEvidence({ digest: 'sha256:expected', environment: 'staging', mutation: 'completed', postflight: 'passed' }, 'sha256:expected')).toBe(true);
    expect(matchesSuccessfulStagingEvidence({ digest: 'sha256:expected', environment: 'staging', postflight: 'passed' }, 'sha256:expected')).toBe(false);
    expect(matchesSuccessfulStagingEvidence({ digest: 'sha256:other', environment: 'staging', mutation: 'completed', postflight: 'passed' }, 'sha256:expected')).toBe(false);
    expect(matchesSuccessfulStagingEvidence({ digest: 'sha256:expected', environment: 'prod', mutation: 'completed', postflight: 'passed' }, 'sha256:expected')).toBe(false);
    expect(matchesSuccessfulStagingEvidence({ digest: 'sha256:expected', environment: 'staging', mutation: 'completed', postflight: 'failed' }, 'sha256:expected')).toBe(false);
  });

  it('reads paginated artifact responses before filtering parity evidence', () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }));
    const artifacts = listArtifacts((page) => page === 1
      ? { artifacts: firstPage, total_count: 101 }
      : { artifacts: [{ id: 101, name: 'promote-staging-parity-101' }], total_count: 101 });

    expect(artifacts).toHaveLength(101);
    expect(artifacts.at(-1)).toMatchObject({ name: 'promote-staging-parity-101' });
  });

  it('downloads parity artifacts through gh api without unsupported output flags', () => {
    expect(buildArtifactDownloadArgs('smart-village-solutions/sva-studio', 42)).toEqual([
      'api',
      'repos/smart-village-solutions/sva-studio/actions/artifacts/42/zip',
    ]);
  });

  it('accepts artifacts only from successful Promote workflow runs', () => {
    expect(isSuccessfulPromoteWorkflowRun({
      conclusion: 'success',
      path: '.github/workflows/promote.yml@refs/heads/main',
    })).toBe(true);
    expect(isSuccessfulPromoteWorkflowRun({
      conclusion: 'failure',
      path: '.github/workflows/promote.yml@refs/heads/main',
    })).toBe(false);
    expect(isSuccessfulPromoteWorkflowRun({
      conclusion: 'success',
      path: '.github/workflows/build.yml@refs/heads/main',
    })).toBe(false);
  });
});
