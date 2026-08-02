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
      workflow.match(/printf '%s\\n' "\$\{APP_CONFIG\}" > config\/runtime\/base\.vars/gu)
    ).toHaveLength(2);
    expect(
      workflow.match(/SVA_STACK_NAME: \$\{\{ steps\.target\.outputs\.stack_name \}\}/gu)
    ).toHaveLength(2);
    expect(
      workflow.match(/SVA_PUBLIC_BASE_URL: \$\{\{ steps\.target\.outputs\.public_base_url \}\}/gu)
    ).toHaveLength(3);
    expect(workflow).toContain('pnpm exec tsx scripts/ci/promote-target.ts "${{ inputs.environment }}"');
    expect(workflow).toContain('SVA_STACK_NAME: ${{ steps.target.outputs.stack_name }}');
    expect(workflow).toContain('--stack "${{ steps.target.outputs.stack_name }}"');
    expect(workflow).toContain('QUANTUM_ENDPOINT: ${{ vars.QUANTUM_ENDPOINT }}');
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
    expect(workflow).toContain(
      "if: ${{ inputs.environment == 'prod' }}"
    );
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
    expect(workflow).toMatch(/- name: verify deployed runtime\n\s+env:/u);
    expect(workflow).toMatch(/- name: verify deployed runtime image digest\n\s+env:/u);
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
