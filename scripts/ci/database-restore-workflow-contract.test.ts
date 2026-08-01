import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/database-restore.yml'),
  'utf8'
);

describe('database restore workflow', () => {
  it('identifies a successful staging drill by its stable workflow path, not its dynamic run name', () => {
    expect(workflow).toContain('.path == ".github/workflows/database-restore.yml"');
    expect(workflow).not.toContain('.name == "Controlled Database Restore"');
  });

  it('validates the production staging evidence before binding execution to the live image revision', () => {
    const evidenceValidation = workflow.indexOf('verify staging drill evidence for production');
    const imageRevisionBinding = workflow.indexOf('materialize image-bound stack source');

    expect(evidenceValidation).toBeGreaterThan(-1);
    expect(imageRevisionBinding).toBeGreaterThan(evidenceValidation);
  });

  it('uses an image-bound worktree for stack inputs without replacing the current restore tooling source', () => {
    expect(workflow).toContain('git worktree add --detach');
    expect(workflow).not.toContain('git checkout --detach "${head}"');
    expect(workflow).toContain('SVA_COMPOSE_SOURCE_ROOT: ${{ steps.image_source.outputs.path }}');
  });

  it('migrates a historical dump before reconciling and restarting the application', () => {
    const restore = workflow.indexOf('execute database restore and database checks');
    const migration = workflow.indexOf('migrate restored database to the selected image schema');
    const reconcile = workflow.indexOf('reconcile application database principal after restore');
    const restart = workflow.indexOf('restart application after successful database checks');

    expect(migration).toBeGreaterThan(restore);
    expect(reconcile).toBeGreaterThan(migration);
    expect(restart).toBeGreaterThan(reconcile);
    expect(workflow).toContain(
      'pnpm exec tsx scripts/ci/promote-one-shot-job.ts --kind migration --environment "${{ inputs.environment }}"'
    );
  });

  it('requires an authenticated IAM smoke after restart and before successful evidence', () => {
    const restart = workflow.indexOf('restart application after successful database checks');
    const authenticatedIam = workflow.indexOf('verify authenticated IAM runtime after restore');
    const evidence = workflow.indexOf('write successful workflow evidence');

    expect(authenticatedIam).toBeGreaterThan(restart);
    expect(evidence).toBeGreaterThan(authenticatedIam);
    expect(workflow).toContain('scripts/ci/restore-authenticated-iam-smoke.ts');
    expect(workflow).toContain('authenticatedIam:"passed"');
    expect(workflow).toContain("steps.authenticated_iam_verify.outcome != 'success'");
  });
});
