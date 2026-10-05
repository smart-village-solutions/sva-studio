import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  validateHotfixDispatch,
  verifyHotfixSource,
  type HotfixSourceGit,
} from './hotfix-source-contract.ts';

const controllerSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const sourceSha = 'c'.repeat(40);
const input = {
  event: 'workflow_dispatch',
  ref: 'refs/heads/main',
  controllerSha,
  workflowSha: controllerSha,
  baseTag: 'studio-v0.10.4',
  branchRef: 'refs/heads/hotfix/studio-v0-10-5-changelog',
  sourceSha,
};
const buildWorkflow = readFileSync(resolve(import.meta.dirname, '../../.github/workflows/build.yml'), 'utf8');
const e2eWorkflow = readFileSync(resolve(import.meta.dirname, '../../.github/workflows/app-e2e.yml'), 'utf8');
const promoteWorkflow = readFileSync(resolve(import.meta.dirname, '../../.github/workflows/promote.yml'), 'utf8');

describe('hotfix source contract', () => {
  it('accepts only an explicit dispatch on the exact Main controller', () => {
    expect(validateHotfixDispatch(input)).toEqual({ controllerSha, baseTag: input.baseTag, branchRef: input.branchRef, sourceSha });
    for (const invalid of [
      { event: 'push' },
      { ref: 'refs/heads/hotfix/studio-v0-10-5-changelog' },
      { workflowSha: baseSha },
      { baseTag: 'studio-v0.11.0-beta.1' },
      { branchRef: 'refs/heads/feature/unrelated' },
      { sourceSha: 'latest' },
    ]) {
      expect(() => validateHotfixDispatch({ ...input, ...invalid })).toThrow();
    }
  });

  it('binds the remote branch, annotated tag and descendant commit before checkout', () => {
    const remoteRef = vi.fn((ref: string) => ref.endsWith('^{}') ? baseSha : sourceSha);
    const fetch = vi.fn();
    const git: HotfixSourceGit = {
      remoteRef,
      fetch,
      commit: (ref) => ref === sourceSha ? sourceSha : baseSha,
      isAncestor: (base, head) => base === baseSha && head === sourceSha,
    };
    verifyHotfixSource(validateHotfixDispatch(input), git);
    expect(fetch).toHaveBeenCalledWith(input.branchRef, 'refs/tags/studio-v0.10.4');
    expect(remoteRef).toHaveBeenCalledTimes(4);
  });

  it('rejects a moved ref, wrong tag or unrelated source', () => {
    const source = validateHotfixDispatch(input);
    const git: HotfixSourceGit = {
      remoteRef: (ref) => ref.endsWith('^{}') ? baseSha : sourceSha,
      fetch: () => undefined,
      commit: (ref) => ref === sourceSha ? sourceSha : baseSha,
      isAncestor: () => true,
    };
    expect(() => verifyHotfixSource(source, { ...git, remoteRef: () => baseSha })).toThrow();
    expect(() => verifyHotfixSource(source, { ...git, commit: () => sourceSha })).toThrow();
    expect(() => verifyHotfixSource(source, { ...git, isAncestor: () => false })).toThrow();
    let reads = 0;
    expect(() => verifyHotfixSource(source, {
      ...git,
      remoteRef: (ref) => {
        reads += 1;
        return reads > 2 && !ref.endsWith('^{}') ? controllerSha : ref.endsWith('^{}') ? baseSha : sourceSha;
      },
    })).toThrow();
  });

  it('keeps all hotfix images on the source SHA without moving any latest alias or Dev', () => {
    expect(buildWorkflow).toContain('Validate hotfix source before checkout');
    expect(buildWorkflow).toContain('ref: ${{ steps.hotfix.outputs.source_sha || github.sha }}');
    expect(buildWorkflow.match(/SVA_IMAGE_REVISION=\$\{\{ steps\.source\.outputs\.sha \}\}/gu)).toHaveLength(3);
    expect(buildWorkflow.match(/:latest/g)).toHaveLength(3);
    expect(buildWorkflow.match(/inputs\.mode != 'hotfix' && 'ghcr\.io\/smart-village-solutions\/sva-studio[^']*:latest'/gu)).toHaveLength(3);
    expect(buildWorkflow).toContain('if: github.event_name == \'push\'');
    expect(buildWorkflow).toContain('needs.build.outputs.source_sha');
    expect(buildWorkflow).toContain('Verify backup agent image');
    expect(buildWorkflow).toContain('HOTFIX_BACKUP_AGENT_DIGEST: ${{ needs.build.outputs.backup_agent_image_digest }}');
    expect(buildWorkflow).toContain('hotfix-build-evidence-${{ github.run_id }}-${{ github.run_attempt }}');
  });

  it('tests the validated hotfix SHA in the full App E2E job and writes controller evidence', () => {
    expect(e2eWorkflow).toContain('Validate hotfix source before checkout');
    expect(e2eWorkflow).toContain('ref: ${{ steps.hotfix.outputs.source_sha || github.sha }}');
    expect(e2eWorkflow).toContain('test:e2e --skipNxCache');
    expect(e2eWorkflow).toContain("inputs.mode != 'hotfix' && 'true' || 'false'");
    expect(e2eWorkflow).toContain('HOTFIX_SOURCE_SHA: ${{ needs.e2e.outputs.source-sha }}');
    expect(e2eWorkflow).toContain('GITHUB_WORKFLOW_SHA: ${{ github.workflow_sha }}');
  });

  it('keeps Hotfix and Beta switches inside the protected Promote gates', () => {
    expect(promoteWorkflow).toContain('options: [none, beta-to-hotfix, hotfix-to-beta]');
    expect(promoteWorkflow).toContain("if: ${{ inputs.source_kind == 'hotfix' && inputs.environment == 'staging' }}");
    expect(promoteWorkflow).toContain('validate controlled hotfix source ref');
    expect(promoteWorkflow).toContain('require source-bound App E2E evidence');
    expect(promoteWorkflow).toContain('require source-bound controlled Build evidence');
    expect(promoteWorkflow).toContain('HOTFIX_BUILD_RUN_ID: ${{ inputs.hotfix_build_run_id }}');
    expect(promoteWorkflow).toContain('invalidate and recheck previous Staging parity before a line switch');
    expect(promoteWorkflow).toContain('diff_mode_args=(--diff-mode direct)');
    expect(promoteWorkflow).toContain('EXPECTED_SOURCE_KIND: ${{ inputs.source_kind }}');
    for (const step of [
      'create database backup before deployment',
      'run migration one-shot job',
      'run bootstrap one-shot job',
      'run one-shot postconditions',
      'wait for terminal Swarm convergence',
      'verify deployed runtime image digest',
      'write staging parity evidence',
    ]) expect(promoteWorkflow).toContain(step);
    expect(promoteWorkflow.indexOf('invalidate and recheck previous Staging parity')).toBeLessThan(
      promoteWorkflow.indexOf('create database backup before deployment')
    );
  });
});
