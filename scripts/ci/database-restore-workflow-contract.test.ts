import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/database-restore.yml'),
  'utf8',
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
});
