import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../../.github/workflows/database-restore.yml'),
  'utf8'
);

describe('controlled database restore workflow', () => {
  it('is manually dispatched, environment-protected and globally serialized per target', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('environment: ${{ inputs.environment }}');
    expect(workflow).toContain('group: database-restore-${{ inputs.environment }}');
    expect(workflow).toContain('cancel-in-progress: false');
  });

  it('binds source object, checksum, maintenance window, image and executor revision', () => {
    for (const input of [
      'source_object_key:',
      'source_sha256:',
      'maintenance_window:',
      'image_ref:',
      'change_head:',
    ])
      expect(workflow).toContain(input);
    expect(workflow).toContain('promote-image-contract.ts');
    expect(workflow).toContain('promote-live-digest.ts');
    expect(workflow).toContain('git merge-base --is-ancestor');
    expect(workflow.indexOf('Login to GHCR')).toBeLessThan(
      workflow.indexOf('validate image contract')
    );
  });

  it('requires successful staging evidence before production mutation', () => {
    expect(workflow).toContain("if: ${{ inputs.environment == 'prod' }}");
    expect(workflow).toContain('verify-staging-restore-evidence.ts');
    expect(workflow.indexOf('verify-staging-restore-evidence.ts')).toBeLessThan(
      workflow.indexOf('stop application writers')
    );
  });

  it('stops writers before the request and re-stops after every incomplete postcheck', () => {
    expect(workflow.indexOf('stop application writers')).toBeLessThan(
      workflow.indexOf('submit-restore-agent-request.ts')
    );
    expect(workflow).toContain(
      "steps.external_verify.outcome != 'success' || steps.workflow_evidence.outcome != 'success' || steps.evidence_upload.outcome != 'success'"
    );
    expect(workflow).toContain('restore-stack-stopped.yaml');
    expect(workflow).toContain('/health/live');
    expect(workflow).toContain('/health/ready');
    expect(workflow).toContain('runtime-env.ts smoke studio');
  });

  it('uses only the dedicated restore contract and emits redacted evidence', () => {
    expect(workflow).toContain('RESTORE_AGENT_SIGNING_KEY');
    expect(workflow).toContain('database-restore-workflow-');
    expect(workflow).not.toContain('quantum-cli exec');
    expect(workflow).not.toContain('pg_restore');
  });
});
