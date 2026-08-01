import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { sharedCoverageConfig } from '../../vitest.config';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: projectRoot,
  test: {
    include: [
      'tests/**/*.test.ts',
      '../../scripts/ci/guardrail-report.test.ts',
      '../../scripts/ci/pr-scope.test.ts',
      '../../scripts/ci/affected-unit-gate.test.ts',
      '../../scripts/ci/cleanup-e2e-webserver-conflicts.test.ts',
      '../../scripts/ci/run-pr-gate.test.ts',
      '../../scripts/ci/run-integration-gate.test.ts',
      '../../scripts/ci/check-db-schema-snapshot.test.ts',
      '../../scripts/ci/database-restore-workflow-contract.test.ts',
      '../../scripts/ci/pr-review-intake.test.ts',
      '../../scripts/ci/promote-deploy-gates.test.ts',
      '../../scripts/ci/promote-image-contract.test.ts',
      '../../scripts/ci/backup-agent-contract.test.ts',
      '../../scripts/ci/restore-agent-contract.test.ts',
      '../../scripts/ci/submit-backup-agent-request.test.ts',
      '../../scripts/ci/submit-restore-agent-request.test.ts',
      '../../scripts/ci/tenant-ingress-compose.test.ts',
      '../../scripts/ci/render-compose-env.test.ts',
      '../../scripts/ci/render-quantum-stack.test.ts',
      '../../scripts/ci/render-restore-stack.test.ts',
      '../../scripts/ci/restore-authenticated-iam-smoke.test.ts',
      '../../scripts/ci/test-runner-standardization.test.ts',
      '../../scripts/ops/runtime-env-guardrails.test.ts',
      '../../scripts/ops/runtime-env.test.ts',
      '../../scripts/ops/runtime-env.remote.test.ts',
      '../../scripts/ops/runtime/acceptance-deploy.test.ts',
      '../../scripts/ops/runtime/acceptance-runtime-checks.test.ts',
      '../../scripts/ops/runtime/doctor.test.ts',
      '../../scripts/ops/runtime/local-command.test.ts',
      '../../scripts/ops/runtime/remote-verification.test.ts',
      '../../scripts/ops/runtime/smoke.test.ts',
      '../../scripts/ops/runtime/studio-image-verify-evidence.test.ts',
      '../../scripts/ops/tenant-ingress-audit.test.ts',
      '../../deploy/backup-agent/agent.test.ts',
      '../../deploy/backup-agent-stack.test.ts',
    ],
    exclude: ['coverage/**', 'node_modules/**'],
    environment: 'node',
    coverage: {
      ...sharedCoverageConfig,
      reportsDirectory: resolve(projectRoot, 'coverage'),
    },
  },
});
