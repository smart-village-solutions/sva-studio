import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/waste-database-restore-drill.yml'),
  'utf8'
);

describe('Waste database restore drill workflow', () => {
  it('binds source objects and the agent request to Waste', () => {
    expect(workflow).toContain('^${ENVIRONMENT}/waste/');
    expect(workflow).toContain('submit-restore-agent-request.ts "${{ inputs.environment }}" waste');
    expect(workflow).toContain('targetDatabase:"sva_waste_restore_drill"');
    expect(workflow).not.toContain('quantum-cli stacks deploy');
  });

  it('uses OIDC, environment approval and redacted long-lived evidence', () => {
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('environment: ${{ inputs.environment }}');
    expect(workflow).toContain('retention-days: 90');
    expect(workflow).not.toContain('RESTORE_WASTE_POSTGRES_PASSWORD');
  });
});
