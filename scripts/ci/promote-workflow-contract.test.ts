import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(resolve(import.meta.dirname, '../../.github/workflows/promote.yml'), 'utf8');

describe('Promote workflow contract', () => {
  it('runs staging phases in the required fail-closed order', () => {
    const phases = [
      'bind executor source to promoted change head',
      'capture previous live app digest',
      'create database backup before one-shot jobs',
      'run migration one-shot job',
      'run bootstrap one-shot job',
      'run one-shot postconditions',
      '- name: deploy',
      'verify deployed runtime',
      'verify deployed runtime image digest',
    ];
    const offsets = phases.map((phase) => workflow.indexOf(phase));

    expect(offsets.every((offset) => offset >= 0)).toBe(true);
    expect(offsets).toEqual([...offsets].sort((left, right) => left - right));
    expect(workflow).toMatch(/- name: deploy\s+id: deploy/u);
  });

  it('requires a maintenance reference and guards production mutations with staging parity', () => {
    expect(workflow).toContain('maintenance_window');
    expect(workflow).toContain("'maintenance_window' must be a non-sensitive, revisionable reference");
    expect(workflow).toContain('--environment "${ENVIRONMENT}"');
    expect(workflow).toContain('upload redacted one-shot evidence');
    expect(workflow).toContain('if-no-files-found: ignore');
    expect(workflow).toContain('previous_live_image');
    expect(workflow).toContain('packages: read');
    expect(workflow).toContain('actions: read');
    expect(workflow).toContain('require successful staging parity for production mutation');
    expect(workflow).toContain('create database backup before one-shot jobs');
    expect(workflow).toContain('STAGING_MUTATION: ${{ steps.gate_eval.outputs.migration_should_run == \'true\' || steps.gate_eval.outputs.bootstrap_should_run == \'true\' }}');
    expect(workflow).toContain('--expected-revision "$(git rev-parse --verify "${CHANGE_HEAD}^{commit}")"');
  });

  it('runs backups only for staging or production mutations and blocks production deploys behind parity', () => {
    expect(workflow).toContain("inputs.environment == 'staging' || inputs.environment == 'prod'");
    expect(workflow).toContain("inputs.environment == 'prod' && (steps.gate_eval.outputs.migration_should_run == 'true' || steps.gate_eval.outputs.bootstrap_should_run == 'true')");
    expect(workflow).toContain('require successful staging parity for production mutation');
    expect(workflow.indexOf('require successful staging parity for production mutation')).toBeLessThan(
      workflow.indexOf('create database backup before one-shot jobs'),
    );
  });

  it('uses automatic diff-based one-shot execution for main-to-Dev promotion', () => {
    const buildWorkflow = readFileSync(resolve(import.meta.dirname, '../../.github/workflows/build.yml'), 'utf8');

    expect(buildWorkflow).toContain('bootstrap_mode: auto');
    expect(buildWorkflow).toContain('migration_mode: auto');
    expect(workflow).toContain('migration_should_run');
    expect(workflow).toContain('bootstrap_should_run');
  });
});
