import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/promote.yml'),
  'utf8'
);

const stepBlock = (name: string): string => {
  const start = workflow.indexOf(`- name: ${name}`);
  const next = workflow.indexOf('\n      - name:', start + 1);
  return workflow.slice(start, next === -1 ? workflow.length : next);
};

describe('promote workflow hardening contract', () => {
  it('keeps shadow as the safe default and allows protected staged activation', () => {
    expect(workflow).toContain('--shadow');
    expect(workflow).toContain('mode="${PROMOTE_CONFIG_BUILDER_MODE:-shadow}"');
    expect(workflow).toContain('APP_CONFIG: ${{ secrets.APP_CONFIG }}');
    expect(workflow).toContain('PROMOTE_CONFIG_OVERRIDES: ${{ secrets.PROMOTE_CONFIG_OVERRIDES }}');
    expect(workflow).toContain('authoritative)');
    expect(workflow).toContain('PROMOTE_CONFIG_INVALID "${{ inputs.environment }}" config-build');
    expect(workflow).toContain('PROMOTE_CONFIG_SHADOW_MISMATCH');
  });

  it('checks production parity independently of migration and bootstrap modes', () => {
    expect(workflow).toContain("if: ${{ inputs.environment == 'prod' }}");
    expect(workflow).not.toContain(
      "inputs.environment == 'prod' && (steps.gate_eval.outputs.migration_should_run"
    );
  });

  it('validates capabilities before either backup request', () => {
    expect(workflow.indexOf('verify live backup agent capabilities')).toBeGreaterThan(-1);
    expect(workflow.indexOf('verify live backup agent capabilities')).toBeLessThan(
      workflow.indexOf('create database backup before deployment')
    );
    expect(workflow).toContain(
      "continue-on-error: ${{ vars.BACKUP_CAPABILITY_GATE != 'enforce' }}"
    );
  });

  it('supports explicit standard and recovery modes in dispatch and reusable calls', () => {
    expect(workflow.match(/^ {6}promote_mode:/gmu)).toHaveLength(2);
    expect(workflow).toContain('PROMOTE_RECOVERY_REASON_REQUIRED');
    expect(workflow).toContain('PROMOTE_MODE_INVALID');
    expect(workflow).toContain('record-promote-failure.ts');
    expect(workflow).toContain('input-validation');
    expect(workflow).not.toContain('recovery_failure_code');
    expect(workflow).toContain('validate recovery and live revision contract');
    expect(workflow).toContain(
      'PREVIOUS_CONFIG_REVISION: ${{ steps.previous_live_image.outputs.previous_config_revision }}'
    );
    expect(workflow).toContain('environment: ${{ inputs.environment }}');
    expect(workflow.indexOf('validate recovery and live revision contract')).toBeLessThan(
      workflow.indexOf('create database backup before deployment')
    );
    expect(workflow).toContain(
      'FORCE_STAGING_PARITY: ${{ steps.recovery_contract.outputs.force_staging_parity }}'
    );
    expect(stepBlock('build and select remote config')).toContain(
      '--selected-input "${RUNNER_TEMP}/promote-app-config.vars"'
    );
    expect(stepBlock('build and select remote config')).toContain('GITHUB_OUTPUT=');
    expect(stepBlock('verify target config revision label contract')).toContain(
      'sva\\\\.config\\\\.revision=\\\\$\\\\{SVA_CONFIG_REVISION\\\\}'
    );
    expect(workflow.indexOf('verify target config revision label contract')).toBeLessThan(
      workflow.indexOf('create database backup before deployment')
    );
    expect(stepBlock('verify deployed runtime image digest')).toContain(
      '--expected-config-revision "${{ steps.remote_config.outputs.config_revision }}"'
    );
    const orderedGates = [
      'capture previous live app digest',
      'validate recovery and live revision contract',
      'require successful staging parity for production mutation',
      'create database backup before deployment',
      'run migration one-shot job',
      'run bootstrap one-shot job',
      'run one-shot postconditions',
      'deploy',
      'wait for terminal Swarm convergence',
      'verify deployed runtime',
      'verify deployed runtime image digest',
    ];
    expect(orderedGates.map((name) => workflow.indexOf(`- name: ${name}`))).toEqual(
      [...orderedGates]
        .map((name) => workflow.indexOf(`- name: ${name}`))
        .sort((left, right) => left - right)
    );
    for (const name of orderedGates.slice(2)) {
      expect(stepBlock(name)).not.toContain('promote_mode');
    }
    expect(workflow.match(/SVA_CONFIG_REVISION=%s/gu)).toHaveLength(7);
  });

  it('injects the permission snapshot HMAC as a dedicated protected secret', () => {
    expect(
      workflow.match(
        /REDIS_SNAPSHOT_HMAC_SECRET: \$\{\{ secrets\.REDIS_SNAPSHOT_HMAC_SECRET \}\}/gu
      )
    ).toHaveLength(2);
    expect(workflow).toContain('PROMOTE_PERMISSION_SNAPSHOT_SECRET_INVALID');
    expect(workflow).toContain('trimmed_secret="${REDIS_SNAPSHOT_HMAC_SECRET#');
    expect(workflow).toContain('if [ "${#trimmed_secret}" -lt 32 ]');
    expect(workflow.indexOf('validate permission snapshot secret')).toBeLessThan(
      workflow.indexOf('capture previous live app digest')
    );
  });

  it('injects the worker password as a dedicated environment secret', () => {
    expect(
      workflow.match(
        /STUDIO_JOB_WORKER_DB_PASSWORD: \$\{\{ secrets\.STUDIO_JOB_WORKER_DB_PASSWORD \}\}/gu
      )
    ).toHaveLength(2);
    expect(workflow).toContain('STUDIO_JOB_WORKER_DB_PASSWORD fehlt oder ist zu kurz.');
    expect(workflow).toContain('scripts/ci/inject-worker-database-secret.ts');
    expect(workflow.indexOf('inject worker database secret')).toBeLessThan(
      workflow.indexOf('evaluate migration and bootstrap gates')
    );
  });

  it('binds risk evaluation to the actual live image revision and separates Swarm from HTTP', () => {
    expect(workflow).toContain('bind deploy gates to actual live revision');
    expect(workflow).toContain(
      '--live-image "${{ steps.previous_live_image.outputs.previous_live_image }}"'
    );
    expect(workflow).toContain('CHANGE_BASE: ${{ steps.deployment_base.outputs.base_sha }}');
    expect(workflow.indexOf('wait for terminal Swarm convergence')).toBeGreaterThan(
      workflow.indexOf('- name: deploy')
    );
    expect(workflow.indexOf('wait for terminal Swarm convergence')).toBeLessThan(
      workflow.indexOf('verify deployed runtime')
    );
    expect(workflow).toContain('${{ runner.temp }}/promote-swarm-convergence-*.json');
  });
});
