import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(resolve(import.meta.dirname, '../../.github/workflows/promote.yml'), 'utf8');

describe('promote workflow hardening contract', () => {
  it('keeps the builder shadow-only and the legacy APP_CONFIG deploy path authoritative', () => {
    expect(workflow).toContain('--shadow');
    expect(workflow).toContain('name: shadow remote config builder\n        continue-on-error: true');
    expect(workflow).toContain('APP_CONFIG: ${{ secrets.APP_CONFIG }}');
    expect(workflow).not.toContain('PROMOTE_CONFIG_OVERRIDES:');
  });

  it('checks production parity independently of migration and bootstrap modes', () => {
    expect(workflow).toContain("if: ${{ inputs.environment == 'prod' }}");
    expect(workflow).not.toContain("inputs.environment == 'prod' && (steps.gate_eval.outputs.migration_should_run");
  });

  it('validates capabilities before either backup request', () => {
    expect(workflow.indexOf('verify live backup agent capabilities')).toBeGreaterThan(-1);
    expect(workflow.indexOf('verify live backup agent capabilities')).toBeLessThan(workflow.indexOf('create database backup before deployment'));
    expect(workflow).toContain("continue-on-error: ${{ vars.BACKUP_CAPABILITY_GATE != 'enforce' }}");
  });

  it('supports explicit standard and recovery modes in dispatch and reusable calls', () => {
    expect(workflow.match(/^ {6}promote_mode:/gmu)).toHaveLength(2);
    expect(workflow).toContain('PROMOTE_RECOVERY_REASON_REQUIRED');
  });
});
