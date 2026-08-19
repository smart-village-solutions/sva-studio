import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/promote.yml'),
  'utf8'
);

const stepBlock = (name: string): string => {
  const start = workflow.indexOf(`- name: ${name}`);
  if (start === -1) throw new Error(`Workflow step is missing: ${name}`);
  const next = workflow.indexOf('\n      - name:', start + 1);
  return workflow.slice(start, next === -1 ? workflow.length : next);
};

describe('promote workflow hardening contract', () => {
  it('fails fast when a referenced workflow step is missing', () => {
    expect(() => stepBlock('missing contract sentinel')).toThrow(
      'Workflow step is missing: missing contract sentinel'
    );
  });

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

  it('does not expose completed live config seed inputs or modes', () => {
    const dispatch = workflow.slice(
      workflow.indexOf('  workflow_dispatch:'),
      workflow.indexOf('  workflow_call:')
    );
    const reusable = workflow.slice(
      workflow.indexOf('  workflow_call:'),
      workflow.indexOf('\npermissions:')
    );
    for (const input of [
      'live_config_transition_mode',
      'staging_legacy_config_seed_run_id',
      'staging_legacy_config_seed_run_attempt',
      'production_legacy_config_seed_run_id',
      'production_legacy_config_seed_run_attempt',
    ]) {
      expect(dispatch).not.toContain(`${input}:`);
      expect(reusable).not.toContain(`${input}:`);
    }
    for (const mode of [
      'prepare-staging-live-config-label',
      'seed-staging-live-config-label',
      'prepare-production-live-config-label',
      'seed-production-live-config-label',
    ])
      expect(workflow).not.toContain(mode);
  });

  it('retains seed implementation only in the controller copy list', () => {
    const preservation = stepBlock('preserve promote evidence controller');
    for (const file of [
      'scripts/ci/verify-staging-live-config-seed.ts',
      'scripts/ci/staging-live-config-seed-contract.ts',
      'scripts/ci/staging-live-config-seed-context.ts',
      'scripts/ci/promote-evidence-seed-preparation.ts',
      'scripts/ci/promote-h4-failure-definitions.ts',
      'scripts/ci/promote-recovery-failure-definitions.ts',
      'scripts/ci/staging-live-config-seed-io.ts',
      'scripts/ci/staging-live-config-seed-runs.ts',
      'scripts/ci/promote-evidence-seed.ts',
      'scripts/ci/promote-evidence-seed-preparation.ts',
      'scripts/ci/staging-live-config-seed-overlay.ts',
      'scripts/ci/verify-staging-live-config-prepare.ts',
      'scripts/ci/build-remote-app-config.ts',
      'scripts/ci/promote-live-digest.ts',
      'scripts/ci/assets/compose.staging-live-config-label-seed.yaml',
      'scripts/ops/runtime/process.ts',
      'scripts/ops/runtime/remote-portainer.ts',
      'scripts/ops/runtime/remote-service-spec.ts',
    ]) {
      expect(preservation).toContain(file);
    }
    expect(workflow.indexOf('preserve promote evidence controller')).toBeLessThan(
      workflow.indexOf('bind executor source to promoted change head')
    );
    expect(stepBlock('build and select remote config')).toContain(
      '${PROMOTE_CONTROLLER_DIR}/scripts/ci/build-remote-app-config.ts'
    );
    expect(stepBlock('capture previous live app digest')).toContain(
      '${PROMOTE_CONTROLLER_DIR}/scripts/ci/promote-live-digest.ts'
    );
    expect(stepBlock('verify deployed runtime image digest')).toContain(
      '${PROMOTE_CONTROLLER_DIR}/scripts/ci/promote-live-digest.ts'
    );
    const activeWorkflow = workflow.replace(preservation, '');
    for (const invocation of [
      'verify-staging-live-config-prepare.ts"',
      'verify-staging-live-config-seed.ts"',
      'staging-live-config-seed-overlay.ts"',
      'verify-production-live-config-prepare.ts"',
      'verify-production-live-config-seed.ts"',
      'production-live-config-seed-overlay.ts"',
      'compose.staging-live-config-label-seed.yaml"',
      'compose.production-live-config-label-seed.yaml"',
    ])
      expect(activeWorkflow).not.toContain(invocation);
  });

  it('uses the regular deploy graph and emits null-compatible seed evidence', () => {
    const deploy = stepBlock('deploy');
    expect(deploy).toContain(
      'docker compose -f compose.yaml -f "./deploy/compose.${ENVIRONMENT}.yaml"'
    );
    expect(deploy).not.toContain('SEED_MODE');
    expect(stepBlock('write staging parity evidence')).toContain(
      "if: ${{ inputs.environment == 'staging' && success() }}"
    );
    expect(stepBlock('upload staging parity evidence')).toContain(
      "if: ${{ inputs.environment == 'staging' && success() }}"
    );
    expect(workflow).toContain("PROMOTE_SEED_PREPARATION: ''");
    expect(workflow).toContain("PROMOTE_SEED_AUTHORIZATION: ''");
    expect(workflow).not.toContain('steps.legacy_config_seed');
    expect(workflow).not.toContain('steps.production_config_seed');
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

  it('keeps the dual-source controller boundary while using regular runtime paths', () => {
    const preservation = stepBlock('preserve promote evidence controller');
    for (const file of [
      'production-live-config-seed-contract.ts',
      'production-live-config-seed-agent.ts',
      'production-live-config-seed-context.ts',
      'production-live-config-seed-io.ts',
      'production-live-config-seed-runs.ts',
      'production-live-config-seed-overlay.ts',
      'verify-production-live-config-prepare.ts',
      'verify-production-live-config-seed.ts',
      'compose.production-live-config-label-seed.yaml',
      'verify-backup-agent-capabilities.ts',
      'backup-agent-contract.ts',
    ])
      expect(preservation).toContain(file);
    expect(preservation).toContain(
      'cp scripts/ci/production-live-config-seed-agent.ts "${PROMOTE_CONTROLLER_DIR}/production-live-config-seed-agent.ts"'
    );
    expect(preservation).toContain(
      'cp config/runtime/remote/prod.vars "${PROMOTE_CONTROLLER_DIR}/config/runtime/remote/prod.vars"'
    );

    const productionRemoteConfig = stepBlock('build and select remote config');
    expect(productionRemoteConfig).toContain(
      'profile_path="config/runtime/remote/${{ inputs.environment }}.vars"'
    );
    expect(productionRemoteConfig).not.toContain('LIVE_CONFIG_TRANSITION_MODE');
    for (const controllerRuntime of [
      'inject-worker-database-secret.ts',
      'promote-deployment-base.ts',
      'promote-image-provenance.ts',
      'verify-swarm-convergence.ts',
    ])
      expect(preservation).toContain(
        `cp scripts/ci/${controllerRuntime} "\${PROMOTE_CONTROLLER_DIR}/scripts/ci/${controllerRuntime}"`
      );
    expect(preservation).toContain(
      'cp scripts/ops/runtime/remote-stack-state.ts "${PROMOTE_CONTROLLER_DIR}/scripts/ops/runtime/remote-stack-state.ts"'
    );
    expect(workflow).not.toContain('pnpm exec tsx scripts/ci/inject-worker-database-secret.ts');
    expect(workflow).not.toContain('pnpm exec tsx scripts/ci/promote-deployment-base.ts');
    expect(workflow).not.toContain('pnpm exec tsx scripts/ci/verify-swarm-convergence.ts');
    for (const controllerRuntime of [
      'inject-worker-database-secret.ts',
      'promote-deployment-base.ts',
      'verify-swarm-convergence.ts',
    ])
      expect(workflow).toContain(
        `pnpm exec tsx "\${PROMOTE_CONTROLLER_DIR}/scripts/ci/${controllerRuntime}"`
      );

    expect(stepBlock('verify live backup agent capabilities')).toContain(
      'pnpm exec tsx scripts/ci/verify-backup-agent-capabilities.ts'
    );
    const remoteConfig = stepBlock('build and select remote config');
    expect(remoteConfig.indexOf(': > "${shadow_output}"')).toBeLessThan(
      remoteConfig.indexOf('case "${mode}" in')
    );
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
