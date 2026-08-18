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
  it('runs staging phases in the required fail-closed order', () => {
    const phases = [
      'bind executor source to promoted change head',
      'capture previous live app digest',
      'run read-only candidate preflight',
      'create database backup before deployment',
      'verify database backup object',
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
    expect(workflow).toContain(
      'PROMOTE_CONFIG_BUILDER_MODE: ${{ vars.PROMOTE_CONFIG_BUILDER_MODE }}'
    );
    expect(workflow).toContain(
      "continue-on-error: ${{ vars.CANDIDATE_PREFLIGHT_GATE != 'enforce' }}"
    );
    expect(
      workflow.match(/SVA_STACK_NAME: \$\{\{ steps\.target\.outputs\.stack_name \}\}/gu)
    ).toHaveLength(2);
    expect(
      workflow.match(/SVA_PUBLIC_BASE_URL: \$\{\{ steps\.target\.outputs\.public_base_url \}\}/gu)
    ).toHaveLength(3);
    expect(workflow).toContain(
      'pnpm exec tsx scripts/ci/promote-target.ts "${{ inputs.environment }}"'
    );
    expect(workflow).toContain('SVA_STACK_NAME: ${{ steps.target.outputs.stack_name }}');
    expect(workflow).toContain('--stack "${{ steps.target.outputs.stack_name }}"');
    expect(workflow).toContain('QUANTUM_ENDPOINT: ${{ vars.QUANTUM_ENDPOINT }}');
  });

  it('requires canonical Main App E2E evidence only for standard staging before remote mutation', () => {
    const gate = workflow.match(
      /- name: require canonical Main App E2E evidence[\s\S]*?run: pnpm exec tsx "\$\{PROMOTE_CONTROLLER_DIR\}\/verify-main-e2e-evidence\.ts"/u
    )?.[0];
    expect(gate).toContain(
      "if: ${{ inputs.environment == 'staging' && inputs.promote_mode == 'standard' }}"
    );
    expect(gate).toContain("continue-on-error: ${{ vars.MAIN_E2E_GATE != 'enforce' }}");
    expect(gate).toContain("PROMOTE_FAILURE_PATH: ${{ vars.MAIN_E2E_GATE == 'enforce'");
    expect(gate).toContain('EXPECTED_CHANGE_HEAD: ${{ steps.source_contract.outputs.head_sha }}');
    expect(workflow).toContain(
      'cp scripts/ci/app-e2e-evidence.ts "${PROMOTE_CONTROLLER_DIR}/app-e2e-evidence.ts"'
    );
    expect(workflow).toContain(
      'cp scripts/ci/verify-main-e2e-evidence.ts "${PROMOTE_CONTROLLER_DIR}/verify-main-e2e-evidence.ts"'
    );
    expect(workflow).toContain(
      'cp scripts/ci/verify-staging-promote-evidence.ts "${PROMOTE_CONTROLLER_DIR}/verify-staging-promote-evidence.ts"'
    );
    expect(workflow).toContain(
      'cp scripts/ci/write-staging-promote-evidence.ts "${PROMOTE_CONTROLLER_DIR}/write-staging-promote-evidence.ts"'
    );
    expect(workflow).toContain(
      'pnpm exec tsx "${PROMOTE_CONTROLLER_DIR}/verify-staging-promote-evidence.ts"'
    );
    expect(workflow).toContain(
      'run: pnpm exec tsx "${PROMOTE_CONTROLLER_DIR}/write-staging-promote-evidence.ts"'
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
      "PROMOTE_GATE_MAIN_E2E_EVIDENCE_BLOCKING: ${{ vars.MAIN_E2E_GATE == 'enforce' }}"
    );
    expect(workflow).toContain(
      "inputs.promote_mode == 'recovery' || steps.main_e2e_evidence.outputs.e2e_attestation != ''"
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
      'S3_OBJECT_KEY: ${{ steps.backup_job.outputs.backup_object || steps.backup_fallback_job.outputs.backup_object }}'
    );
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('submit-backup-agent-request.ts "${{ inputs.environment }}"');
    expect(workflow).toContain("vars.BACKUP_EXECUTOR == 'temporary'");
    expect(workflow).toContain(
      "STAGING_MUTATION: ${{ steps.gate_eval.outputs.migration_should_run == 'true' || steps.gate_eval.outputs.bootstrap_should_run == 'true' }}"
    );
    expect(workflow).toContain(
      'name: promote-staging-parity-${{ github.run_id }}-${{ github.run_attempt }}'
    );
    expect(workflow).toContain(
      '--expected-revision "$(git rev-parse --verify "${CHANGE_HEAD}^{commit}")"'
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
      "if: ${{ (inputs.environment == 'staging' || inputs.environment == 'prod') && vars.BACKUP_EXECUTOR != 'temporary' }}"
    );
    expect(workflow).toContain(
      "if: ${{ (inputs.environment == 'staging' || inputs.environment == 'prod') && vars.BACKUP_EXECUTOR == 'temporary' }}"
    );
    expect(workflow).toContain(
      "if: ${{ inputs.environment == 'staging' || inputs.environment == 'prod' }}"
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
  });

  it('verifies runtime health and the live digest after every environment deploy', () => {
    expect(workflow).toMatch(/- name: verify deployed runtime\n\s+id: runtime_smoke\n\s+env:/u);
    expect(workflow).toMatch(
      /- name: verify deployed runtime image digest\n\s+id: digest_verification\n\s+env:/u
    );
  });

  it('publishes one redacted promote evidence contract after every terminal outcome', () => {
    const writer = workflow.indexOf('write redacted promote evidence');
    const upload = workflow.indexOf('upload redacted promote evidence');
    expect(writer).toBeGreaterThan(workflow.indexOf('- name: deploy'));
    expect(upload).toBeGreaterThan(writer);
    expect(workflow).toMatch(
      /- name: write redacted promote evidence\n(?:.*\n){0,3}\s+if: always\(\)/u
    );
    expect(workflow).toMatch(/- name: upload redacted promote evidence\n\s+if: always\(\)/u);
    expect(workflow).toContain('run: node "${PROMOTE_CONTROLLER_DIR}/write-promote-evidence.ts"');
    expect(workflow).toContain('ref: ${{ github.workflow_sha }}');
    expect(workflow).toContain('node-version-file: .nvmrc');
    expect(workflow.indexOf('preserve promote evidence controller')).toBeLessThan(
      workflow.indexOf('validate inputs')
    );
    expect(workflow.indexOf('preserve promote evidence controller')).toBeLessThan(
      workflow.indexOf('bind executor source to promoted change head')
    );
    expect(workflow.indexOf('setup pnpm workspace for promoted source')).toBeGreaterThan(
      workflow.indexOf('bind executor source to promoted change head')
    );
    expect(workflow).toContain('PROMOTE_PARITY_DIGEST_MISMATCH');
    expect(workflow).toContain('PROMOTE_LIVE_DIGEST_MISMATCH');
    expect(workflow).toContain(
      'runtime-env.ts smoke studio 2>"${RUNNER_TEMP}/runtime-smoke.stderr"'
    );
    expect(workflow).toContain('PROMOTE_INTERNAL_ERROR "${{ inputs.environment }}" external-smoke');
    expect(workflow).toContain('PROMOTE_SOURCE_CONTRACT_INVALID');
    expect(workflow).toContain('PROMOTE_INPUT_INVALID');
    expect(workflow).not.toContain(`printf '{"code":"PROMOTE_`);
    expect(workflow).toContain(
      'PROMOTE_FAILURE_PATH: ${{ runner.temp }}/promote-terminal-failure.json'
    );
    expect(workflow).toContain('PROMOTE_JOB_STATUS: ${{ job.status }}');
    expect(workflow).toContain('PROMOTE_BASE_SHA: ${{ steps.source_contract.outputs.base_sha }}');
    expect(workflow).toContain('PROMOTE_HEAD_SHA: ${{ steps.source_contract.outputs.head_sha }}');
    expect(workflow).toContain('PROMOTE_BASE_REF: ${{ inputs.change_base }}');
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
    expect(workflow).toContain('PROMOTE_GATE_STAGING_EVIDENCE_UPLOAD');
    expect(workflow).toContain('PROMOTE_GATE_ONE_SHOT_EVIDENCE_UPLOAD');
    expect(workflow).toContain(
      'PROMOTE_GATE_CANDIDATE_PREFLIGHT: ${{ steps.candidate_job.outcome }}'
    );
    expect(workflow).toContain(
      "PROMOTE_GATE_CANDIDATE_PREFLIGHT_BLOCKING: ${{ vars.CANDIDATE_PREFLIGHT_GATE == 'enforce' }}"
    );
    expect(workflow).toContain(
      'PROMOTE_GATE_BACKUP_CAPABILITIES: ${{ steps.backup_capabilities.outcome }}'
    );
    expect(workflow).toContain(
      "PROMOTE_GATE_BACKUP_CAPABILITIES_BLOCKING: ${{ vars.BACKUP_CAPABILITY_GATE == 'enforce' }}"
    );
    expect(workflow).not.toContain('path: ${{ runner.temp }}/promote-*.json');
    expect(workflow).toContain(
      "PROMOTE_FAILURE_PATH: ${{ vars.BACKUP_CAPABILITY_GATE == 'enforce'"
    );
    expect(workflow).toContain(
      'PROMOTE_FAILURE_PATH= pnpm exec tsx scripts/ci/build-remote-app-config.ts'
    );
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
