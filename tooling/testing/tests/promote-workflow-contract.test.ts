import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../../.github/workflows/promote.yml'),
  'utf8'
);
const backupDrillWorkflow = readFileSync(
  resolve(import.meta.dirname, '../../../.github/workflows/staging-backup-drill.yml'),
  'utf8'
);
const productionBackupDrillWorkflow = readFileSync(
  resolve(import.meta.dirname, '../../../.github/workflows/production-backup-drill.yml'),
  'utf8'
);

describe('Promote workflow contract', () => {
  it('removes the completed live config transition while keeping fail-closed evidence', () => {
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

    const requiredOrder = [
      'capture previous live app digest',
      'validate recovery and live revision contract',
      'run read-only candidate preflight',
      'create database backup before deployment',
      '- name: deploy',
      'wait for terminal Swarm convergence',
      'verify deployed runtime',
      'verify deployed runtime image digest',
    ].map((phase) => workflow.indexOf(phase));
    expect(requiredOrder.every((offset) => offset >= 0)).toBe(true);
    expect(requiredOrder).toEqual([...requiredOrder].sort((left, right) => left - right));
    expect(workflow).toContain("inputs.environment == 'staging' && success()");
    expect(workflow).toContain(
      'PROMOTE_PREVIOUS_CONFIG_REVISION: ${{ steps.previous_live_image.outputs.previous_config_revision }}'
    );
    expect(workflow).not.toContain('PROMOTE_SEED_');
  });

  it('runs staging phases in the required fail-closed order', () => {
    const phases = [
      'verify promoted release source contract',
      'capture previous live app digest',
      'run read-only candidate preflight',
      'create database backup before deployment',
      'verify database backup object',
      'run migration one-shot job',
      'run bootstrap one-shot job',
      'run one-shot postconditions',
      '- name: deploy',
      'wait for terminal Swarm convergence',
      'verify deployed runtime',
      'verify deployed runtime image digest',
    ];
    const offsets = phases.map((phase) => workflow.indexOf(phase));

    expect(offsets.every((offset) => offset >= 0)).toBe(true);
    expect(offsets).toEqual([...offsets].sort((left, right) => left - right));
    expect(workflow).toMatch(/- name: deploy\s+id: deploy/u);
    expect(workflow.indexOf('Login to GHCR')).toBeLessThan(
      workflow.indexOf('validate image contract')
    );
    expect(workflow).toContain(
      "trap 'rm -f .env config/runtime/base.vars config/runtime/studio.vars' EXIT"
    );
    expect(
      workflow.match(
        /cp "\$\{RUNNER_TEMP\}\/promote-app-config\.vars" config\/runtime\/base\.vars/gu
      )
    ).toHaveLength(2);
    for (const completedTransition of [
      'PROMOTE_CONFIG_BUILDER_MODE',
      'vars.MAIN_E2E_GATE',
      'CANDIDATE_PREFLIGHT_GATE',
      'BACKUP_CAPABILITY_GATE',
      'BACKUP_EXECUTOR',
      'backup_fallback_job',
      'create temporary database backup fallback',
      'PROMOTE_GATE_BACKUP_FALLBACK',
    ])
      expect(workflow).not.toContain(completedTransition);
    expect(workflow).not.toContain('APP_CONFIG: ${{ secrets.APP_CONFIG }}');
    expect(
      workflow.match(/SVA_STACK_NAME: \$\{\{ steps\.target\.outputs\.stack_name \}\}/gu)
    ).toHaveLength(2);
    expect(
      workflow.match(/SVA_PUBLIC_BASE_URL: \$\{\{ steps\.target\.outputs\.public_base_url \}\}/gu)
    ).toHaveLength(3);
    expect(workflow).toContain(
      'pnpm exec tsx "${PROMOTE_CONTROLLER_DIR}/scripts/ci/promote-target.ts" "${{ inputs.environment }}"'
    );
    expect(workflow).toContain('SVA_STACK_NAME: ${{ steps.target.outputs.stack_name }}');
    expect(workflow).toContain('--stack "${{ steps.target.outputs.stack_name }}"');
    expect(workflow).toContain('QUANTUM_ENDPOINT: ${{ vars.QUANTUM_ENDPOINT }}');
  });

  it('requires canonical Main App E2E evidence only for standard staging before remote mutation', () => {
    const gate = workflow.match(
      /- name: require canonical Main App E2E evidence[\s\S]*?run: pnpm exec tsx "\$\{PROMOTE_CONTROLLER_DIR\}\/scripts\/ci\/verify-main-e2e-evidence\.ts"/u
    )?.[0];
    expect(gate).toContain(
      "if: ${{ inputs.environment == 'staging' && inputs.promote_mode == 'standard' }}"
    );
    expect(gate).not.toContain('continue-on-error:');
    expect(gate).toContain(
      'PROMOTE_FAILURE_PATH: ${{ runner.temp }}/promote-terminal-failure.json'
    );
    expect(gate).toContain('EXPECTED_CHANGE_HEAD: ${{ steps.source_contract.outputs.head_sha }}');
    expect(workflow).toContain(
      'pnpm exec tsx "${PROMOTE_CONTROLLER_DIR}/scripts/ci/verify-staging-promote-evidence.ts"'
    );
    expect(workflow).toContain(
      'run: pnpm exec tsx "${PROMOTE_CONTROLLER_DIR}/scripts/ci/write-staging-promote-evidence.ts"'
    );
    const gateOffset = workflow.indexOf('require canonical Main App E2E evidence');
    expect(gateOffset).toBeGreaterThan(workflow.indexOf('validate image contract'));
    for (const mutationBoundary of [
      'run read-only candidate preflight',
      'create database backup before deployment',
      'run migration one-shot job',
      '- name: deploy',
    ]) {
      expect(gateOffset).toBeLessThan(workflow.indexOf(mutationBoundary));
    }
    expect(workflow).toContain(
      'PROMOTE_GATE_MAIN_E2E_EVIDENCE: ${{ steps.main_e2e_evidence.outcome }}'
    );
    expect(workflow).toContain(
      'PROMOTE_GATE_WORKER_DATABASE_SECRET: ${{ steps.worker_database_secret.outcome }}'
    );
    expect(workflow).toContain(
      'PROMOTE_GATE_WORKER_DATABASE_SECRET_INJECTION: ${{ steps.worker_database_secret_injection.outcome }}'
    );
    expect(workflow).toContain(
      'PROMOTE_MAIN_E2E_REFERENCE: ${{ steps.main_e2e_evidence.outputs.e2e_attestation }}'
    );
    expect(workflow).toContain(
      "PROMOTE_GATE_MAIN_E2E_EVIDENCE_BLOCKING: 'true'"
    );
    expect(workflow).toContain('MAIN_E2E_GATE_MODE: enforce');
    expect(workflow).toMatch(
      /- name: write staging parity evidence\n\s+id: staging_evidence\n\s+if: \$\{\{ inputs\.environment == 'staging' && success\(\) \}\}/u
    );
    expect(workflow).toMatch(
      /- name: upload staging parity evidence\n\s+id: staging_evidence_upload\n\s+if: \$\{\{ inputs\.environment == 'staging' && success\(\) \}\}/u
    );
  });

  it('does not require a maintenance reference and guards production mutations with staging parity', () => {
    expect(workflow).not.toContain('maintenance_window');
    expect(workflow).not.toContain('MAINTENANCE_WINDOW');
    expect(workflow).toContain('--environment "${ENVIRONMENT}"');
    expect(workflow).toContain('upload redacted one-shot evidence');
    expect(workflow).toContain('if-no-files-found: ignore');
    expect(workflow).toContain('previous_live_image');
    expect(workflow).toContain('packages: read');
    expect(workflow).toContain('actions: read');
    expect(workflow).toContain('require successful staging parity for production mutation');
    expect(workflow).toContain('create database backup before deployment');
    expect(workflow).toContain('verify database backup object');
    expect(workflow).toContain(
      'S3_OBJECT_KEY: ${{ steps.backup_job.outputs.backup_object }}'
    );
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('submit-backup-agent-request.ts "${{ inputs.environment }}"');
    expect(workflow).not.toContain('promote-backup-job.ts "${{ inputs.environment }}"');
    expect(workflow).toContain(
      "STAGING_MUTATION: ${{ steps.gate_eval.outputs.migration_should_run == 'true' || steps.gate_eval.outputs.bootstrap_should_run == 'true' }}"
    );
    expect(workflow).toContain(
      'name: promote-staging-parity-${{ github.run_id }}-${{ github.run_attempt }}'
    );
    expect(workflow).toContain(
      '--expected-revision "$(git rev-parse --verify "${CHANGE_HEAD}^{commit}")"'
    );
    expect(workflow).toContain(
      'PROMOTE_RECOVERY_CONTRACT: ${{ steps.recovery_contract.outputs.recovery_contract }}'
    );
    expect(workflow).toContain(
      'PROMOTE_PREVIOUS_CONFIG_REVISION: ${{ steps.previous_live_image.outputs.previous_config_revision }}'
    );
  });

  it('runs backups before every staging or production deployment and blocks production mutations behind parity', () => {
    expect(workflow).toContain("inputs.environment == 'staging' || inputs.environment == 'prod'");
    expect(workflow).toContain("if: ${{ inputs.environment == 'prod' }}");
    expect(workflow).toContain('require successful staging parity for production mutation');
    expect(
      workflow.indexOf('require successful staging parity for production mutation')
    ).toBeLessThan(workflow.indexOf('create database backup before deployment'));
    expect(workflow).toContain(
      "if: ${{ inputs.environment == 'staging' || inputs.environment == 'prod' }}"
    );
    expect(workflow).toContain(
      "if: ${{ (inputs.environment == 'staging' || inputs.environment == 'prod') && vars.WASTE_POSTGRES_BACKUP_ENABLED == 'true' }}"
    );
  });

  it('uses automatic diff-based one-shot execution for main-to-Dev promotion', () => {
    const buildWorkflow = readFileSync(
      resolve(import.meta.dirname, '../../../.github/workflows/build.yml'),
      'utf8'
    );

    expect(buildWorkflow).toContain('bootstrap_mode: auto');
    expect(buildWorkflow).toContain('migration_mode: auto');
    expect(buildWorkflow).toContain('image_ref: ${{ needs.build.outputs.image_digest }}');
    expect(buildWorkflow).toContain('actions: read');
    expect(buildWorkflow).toContain('id-token: write');
    expect(buildWorkflow).toContain('SVA_IMAGE_REVISION=${{ github.sha }}');
    expect(buildWorkflow).toContain('file: ./deploy/backup-agent/Dockerfile');
    expect(buildWorkflow).toContain(
      'ghcr.io/smart-village-solutions/sva-studio-backup-agent:${{ github.sha }}'
    );
    expect(workflow).toContain('migration_should_run');
    expect(workflow).toContain('bootstrap_should_run');
    expect(workflow).toContain('CHANGE_BASE: ${{ steps.deployment_base.outputs.base_sha }}');
    expect(workflow.indexOf('capture previous live app digest')).toBeLessThan(
      workflow.indexOf('evaluate migration and bootstrap gates')
    );
    expect(workflow).toContain('scripts/ci/promote-deployment-base.ts');
  });

  it('verifies runtime health and the live digest after every environment deploy', () => {
    const convergence = workflow.indexOf('wait for terminal Swarm convergence');
    expect(convergence).toBeGreaterThan(workflow.indexOf('- name: deploy'));
    expect(convergence).toBeLessThan(workflow.indexOf('verify deployed runtime'));
    expect(workflow).toContain(
      'run: pnpm exec tsx "${PROMOTE_CONTROLLER_DIR}/scripts/ci/verify-swarm-convergence.ts" "${{ inputs.environment }}"'
    );
    expect(workflow).toContain(
      'PROMOTE_GATE_SWARM_CONVERGENCE: ${{ steps.swarm_convergence.outcome }}'
    );
    expect(workflow).toMatch(/- name: verify deployed runtime\n\s+id: runtime_smoke\n\s+env:/u);
    expect(workflow).toMatch(
      /- name: verify deployed runtime image digest\n\s+id: digest_verification\n\s+env:/u
    );
  });

  it('keeps controller and release sources in revision-bound checkouts without a copy list', () => {
    const releaseCheckout = workflow.match(
      /- name: checkout promoted release revision[\s\S]*?ref: \$\{\{ inputs\.change_head \}\}/u
    )?.[0];
    const controllerCheckout = workflow.match(
      /- name: checkout workflow controller revision[\s\S]*?ref: \$\{\{ github\.workflow_sha \}\}/u
    )?.[0];
    const sourceContract = workflow.match(
      /- name: verify promoted release source contract[\s\S]*?echo "head_sha=\$\{head\}"/u
    )?.[0];

    expect(releaseCheckout).toContain('fetch-depth: 0');
    expect(releaseCheckout).not.toContain('path:');
    expect(controllerCheckout).toContain('fetch-depth: 1');
    expect(controllerCheckout).toContain('path: .promote-controller');
    expect(workflow.indexOf('checkout promoted release revision')).toBeLessThan(
      workflow.indexOf('checkout workflow controller revision')
    );
    expect(workflow.indexOf('checkout workflow controller revision')).toBeLessThan(
      workflow.indexOf('setup pnpm workspace for promoted source')
    );
    expect(workflow).toContain(
      'PROMOTE_CONTROLLER_DIR=${GITHUB_WORKSPACE}/.promote-controller'
    );
    expect(workflow).not.toContain('preserve promote evidence controller');
    expect(workflow).not.toMatch(/^\s*cp .*PROMOTE_CONTROLLER_DIR/mu);
    expect(workflow).not.toContain('promote-evidence-controller');
    expect(workflow).not.toContain('working-directory: .promote-controller');
    expect(workflow.match(/uses: \.\/\.github\/actions\/setup-pnpm-workspace/gu)).toHaveLength(1);

    expect(sourceContract).toContain('workspace_head="$(git rev-parse --verify HEAD)"');
    expect(sourceContract).toContain('base="$(git rev-parse --verify "${CHANGE_BASE}^{commit}")"');
    expect(sourceContract).toContain('head="$(git rev-parse --verify "${CHANGE_HEAD}^{commit}")"');
    expect(sourceContract).toContain('[ "${workspace_head}" != "${head}" ]');
    expect(sourceContract).toContain('git merge-base --is-ancestor "${base}" "${head}"');
    expect(sourceContract).not.toContain('git checkout');

    for (const controllerCommand of [
      'scripts/ci/record-promote-failure.ts',
      'scripts/ci/verify-main-e2e-evidence.ts',
      'scripts/ci/verify-staging-promote-evidence.ts',
      'scripts/ci/write-staging-promote-evidence.ts',
      'scripts/ci/write-promote-evidence.ts',
      'scripts/ci/build-remote-app-config.ts',
      'scripts/ci/inject-worker-database-secret.ts',
      'scripts/ci/promote-deployment-base.ts',
      'scripts/ci/promote-live-digest.ts',
      'scripts/ci/promote-target.ts',
      'scripts/ci/verify-backup-agent-capabilities.ts',
      'scripts/ci/verify-swarm-convergence.ts',
    ])
      expect(workflow).toContain(`\${PROMOTE_CONTROLLER_DIR}/${controllerCommand}`);

    for (const releaseCommand of [
      'scripts/ci/promote-image-contract.ts',
      'scripts/ci/promote-deploy-gates.ts',
      'scripts/ci/render-compose-env.ts',
      'scripts/ci/promote-one-shot-job.ts',
      'scripts/ci/submit-backup-agent-request.ts',
      'scripts/ci/verify-promote-backup.ts',
      'scripts/ci/render-quantum-stack.ts',
      'scripts/ops/runtime-env.ts',
    ]) {
      expect(workflow).toContain(releaseCommand);
      expect(workflow).not.toContain(`\${PROMOTE_CONTROLLER_DIR}/${releaseCommand}`);
    }
    expect(workflow).toContain('profile_path="config/runtime/remote/${{ inputs.environment }}.vars"');
    expect(workflow).toContain('"deploy/compose.${{ inputs.environment }}.yaml"');
  });

  it('publishes one redacted promote evidence contract after every terminal outcome', () => {
    const writer = workflow.indexOf('write redacted promote evidence');
    const upload = workflow.indexOf('upload redacted promote evidence');
    const setupNode = workflow.indexOf('uses: actions/setup-node@v6');
    const firstTypeScriptController = workflow.indexOf('node --experimental-strip-types');
    expect(writer).toBeGreaterThan(workflow.indexOf('- name: deploy'));
    expect(upload).toBeGreaterThan(writer);
    expect(workflow).toMatch(
      /- name: write redacted promote evidence\n(?:.*\n){0,3}\s+if: always\(\)/u
    );
    expect(workflow).toMatch(/- name: upload redacted promote evidence\n\s+if: always\(\)/u);
    expect(workflow).toContain(
      'run: node --experimental-strip-types "${PROMOTE_CONTROLLER_DIR}/scripts/ci/write-promote-evidence.ts"'
    );
    expect(workflow).not.toMatch(/node (?!--experimental-strip-types)[^\n]*\.ts/u);
    expect(workflow).toContain('ref: ${{ github.workflow_sha }}');
    expect(workflow).toMatch(
      /uses: actions\/setup-node@v6\n\s+with:\n\s+node-version-file: \.nvmrc/u
    );
    expect(setupNode).toBeGreaterThanOrEqual(0);
    expect(firstTypeScriptController).toBeGreaterThan(setupNode);
    expect(workflow.indexOf('setup pnpm workspace for promoted source')).toBeGreaterThan(
      workflow.indexOf('verify promoted release source contract')
    );
    expect(workflow).not.toContain('record-promote-failure.ts" PROMOTE_PARITY_DIGEST_MISMATCH');
    expect(workflow).toContain('PROMOTE_LIVE_DIGEST_MISMATCH');
    expect(workflow).toContain(
      'runtime-env.ts smoke studio 2>"${RUNNER_TEMP}/runtime-smoke.stderr"'
    );
    expect(workflow).toContain('PROMOTE_INTERNAL_ERROR "${{ inputs.environment }}" external-smoke');
    expect(workflow).toContain('PROMOTE_SOURCE_CONTRACT_INVALID');
    expect(workflow).toContain('PROMOTE_INPUT_INVALID');
    expect(workflow).not.toContain(`printf '{"code":"PROMOTE_`);
    expect(workflow).not.toMatch(
      /^\s{6}PROMOTE_(?:FAILURE_PATH|CONTROLLER_DIR):\s+\$\{\{\s*runner\./mu
    );
    expect(workflow).toMatch(
      /- name: initialize promote controller paths\n\s+run: \|\n\s+set -euo pipefail\n[\s\S]*?PROMOTE_FAILURE_PATH=\$\{RUNNER_TEMP\}\/promote-terminal-failure\.json[\s\S]*?PROMOTE_CONTROLLER_DIR=\$\{GITHUB_WORKSPACE\}\/\.promote-controller[\s\S]*?GITHUB_ENV/u
    );
    expect(workflow.indexOf('initialize promote controller paths')).toBeLessThan(
      workflow.indexOf('checkout workflow controller revision')
    );
    expect(workflow).toContain('PROMOTE_JOB_STATUS: ${{ job.status }}');
    expect(workflow).toContain(
      'PROMOTE_BASE_SHA: ${{ steps.deployment_base.outputs.base_sha || steps.source_contract.outputs.base_sha }}'
    );
    expect(workflow).toContain('PROMOTE_HEAD_SHA: ${{ steps.source_contract.outputs.head_sha }}');
    expect(workflow).toContain(
      'PROMOTE_BASE_REF: ${{ steps.deployment_base.outputs.base_sha || inputs.change_base }}'
    );
    expect(workflow).toContain('PROMOTE_HEAD_REF: ${{ inputs.change_head }}');
    expect(workflow).toContain(
      'PROMOTE_CONFIG_REVISION: ${{ steps.remote_config.outputs.config_revision }}'
    );
    expect(workflow).toContain(
      'PROMOTE_SECRET_REFERENCES: ${{ steps.remote_config.outputs.secret_references }}'
    );
    expect(workflow).toContain(
      'PROMOTE_BACKUP_AGENT: ${{ steps.backup_capabilities.outputs.backup_agent }}'
    );
    expect(workflow).toContain(
      'name: promote-evidence-${{ github.run_id }}-${{ github.run_attempt }}'
    );
    expect(workflow).toContain(
      'path: ${{ runner.temp }}/promote-evidence-${{ github.run_id }}-${{ github.run_attempt }}.json'
    );
    expect(workflow).toContain('if-no-files-found: error');
    expect(workflow).toContain('PROMOTE_GATE_WASTE_BACKUP_REQUEST');
    expect(workflow).toContain('PROMOTE_GATE_WASTE_BACKUP');
    expect(workflow).toContain('PROMOTE_GATE_POSTCONDITIONS');
    expect(workflow).toContain('PROMOTE_GATE_POLICY_EVALUATION');
    expect(workflow).toContain('PROMOTE_GATE_TARGET');
    expect(workflow).toContain('PROMOTE_GATE_PREVIOUS_LIVE');
    expect(workflow).toContain(
      'PROMOTE_GATE_CONFIG_REVISION_CONTRACT: ${{ steps.config_revision_contract.outcome }}'
    );
    expect(workflow).toContain('PROMOTE_GATE_STAGING_EVIDENCE_UPLOAD');
    expect(workflow).toContain('PROMOTE_GATE_ONE_SHOT_EVIDENCE_UPLOAD');
    expect(workflow).toContain(
      'PROMOTE_GATE_CANDIDATE_PREFLIGHT: ${{ steps.candidate_job.outcome }}'
    );
    expect(workflow).toContain(
      "PROMOTE_GATE_CANDIDATE_PREFLIGHT_BLOCKING: 'true'"
    );
    expect(workflow).toContain(
      'PROMOTE_GATE_BACKUP_CAPABILITIES: ${{ steps.backup_capabilities.outcome }}'
    );
    expect(workflow).toContain(
      "PROMOTE_GATE_BACKUP_CAPABILITIES_BLOCKING: 'true'"
    );
    expect(workflow).not.toContain('path: ${{ runner.temp }}/promote-*.json');
    expect(workflow).toContain(
      'PROMOTE_FAILURE_PATH: ${{ runner.temp }}/promote-terminal-failure.json'
    );
    expect(workflow).toContain('- name: build authoritative remote config');
    expect(workflow).not.toContain('--selected-input');
    expect(workflow).not.toContain('--shadow');
    expect(workflow).not.toContain('echo "## Promote summary"');
  });

  it('offers a staging-only backup drill without application mutation', () => {
    expect(backupDrillWorkflow).toContain('name: Staging Backup Drill');
    expect(backupDrillWorkflow).toContain('environment: staging');
    expect(backupDrillWorkflow).toContain('submit-backup-agent-request.ts staging');
    expect(backupDrillWorkflow).toContain('promote-backup-job.ts staging');
    expect(backupDrillWorkflow).toContain('verify-promote-backup.ts');
    expect(backupDrillWorkflow).toContain(
      'staging-backup-drill-${{ github.run_id }}-${{ github.run_attempt }}'
    );
    expect(backupDrillWorkflow).not.toContain('promote-one-shot-job.ts');
    expect(backupDrillWorkflow).not.toContain('quantum-cli stacks deploy');
  });

  it('offers an approved production backup drill without application mutation', () => {
    expect(productionBackupDrillWorkflow).toContain('name: Production Backup Drill');
    expect(productionBackupDrillWorkflow).toContain('environment: prod');
    expect(productionBackupDrillWorkflow).not.toContain('maintenance_window');
    expect(productionBackupDrillWorkflow).not.toContain('MAINTENANCE_WINDOW');
    expect(productionBackupDrillWorkflow).toContain('require successful staging backup parity');
    expect(productionBackupDrillWorkflow).toContain(
      'verify-staging-promote-evidence.ts backup-drill'
    );
    expect(productionBackupDrillWorkflow).toContain('submit-backup-agent-request.ts prod');
    expect(productionBackupDrillWorkflow).toContain('verify-promote-backup.ts');
    expect(productionBackupDrillWorkflow).not.toContain('promote-one-shot-job.ts');
    expect(productionBackupDrillWorkflow).not.toContain('quantum-cli stacks deploy');
  });
});
