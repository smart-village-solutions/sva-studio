import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(resolve(import.meta.dirname, '../../.github/workflows/backup-agent-rollout.yml'), 'utf8');

describe('backup agent rollout workflow', () => {
  it('uses the production approval gate for the shared service', () => {
    expect(workflow).toContain('environment: prod');
    expect(workflow).toContain('group: backup-agent-rollout');
  });

  it('accepts only the immutable repository image and binds its revision', () => {
    expect(workflow).toContain('sva-studio-backup-agent@sha256:');
    expect(workflow).toContain('org.opencontainers.image.revision');
    expect(workflow).toContain('git merge-base --is-ancestor');
    expect(workflow).not.toContain('git checkout --detach');
  });

  it('updates only the dedicated central stack', () => {
    expect(workflow).toContain('--file deploy/backup-agent-stack.yaml');
    expect(workflow).toContain('--stack studio-backup-agent');
    expect(workflow).toContain('--service backup-agent');
  });
});
