import { describe, expect, it, vi } from 'vitest';

import type { DoctorCheck, DoctorReport } from '../runtime-env.shared.ts';
import { createAcceptanceCommandRunner } from './acceptance-command.ts';

const createDoctorReport = (): DoctorReport => ({
  checks: [],
  generatedAt: '2026-06-20T10:00:00.000Z',
  profile: 'studio',
  status: 'ok',
});

const createCheck = (status: DoctorCheck['status'], message: string): DoctorCheck => ({
  code: 'check_code',
  message,
  name: 'instance-hostname-mapping',
  status,
});

describe('createAcceptanceCommandRunner', () => {
  it('verifies hostname mappings after reset before reporting success', async () => {
    const buildInstanceHostnameMappingCheck = vi.fn(async () => createCheck('ok', 'ok'));
    const runSchemaGuard = vi.fn(() => ({ ok: true }));
    const resetAcceptance = vi.fn(async (_runtimeProfile, _env, verifyPostReset: () => Promise<void>) => {
      await verifyPostReset();
    });

    const runAcceptanceCommand = createAcceptanceCommandRunner({
      applyCliOptionEnvOverrides: vi.fn((env) => env),
      assertDangerousOperationApproved: vi.fn(),
      assertDeterministicRemoteMutationContext: vi.fn(),
      assertRuntimeEnv: vi.fn(),
      buildProfileEnv: vi.fn(() => ({ SVA_STACK_NAME: 'studio' })),
      cliOptions: { approvalToken: 'studio:reset', releaseMode: 'app-only' },
      doctorRuntime: vi.fn(async () => createDoctorReport()),
      getConfiguredStackName: vi.fn(() => 'studio'),
      getRuntimeStatusExecutionMode: () => 'remote',
      migrateAcceptance: vi.fn(),
      precheckAcceptance: vi.fn(async () => createDoctorReport()),
      printDoctorReport: vi.fn(),
      readRemoteStackEvidence: vi.fn(async () => ({ summary: 'ok' })),
      resetAcceptance,
      resolveRemoteDangerousApprovalRequirement: vi.fn(() => ({
        reason: 'reset',
        token: 'studio:reset',
      })),
      rootDir: '/repo',
      run: vi.fn(),
      runAcceptanceDeploy: vi.fn(),
      runSchemaGuard,
      runtimeDoctorDbCheckOps: {
        buildInstanceHostnameMappingCheck,
        runSchemaGuard,
      },
      smokeRuntime: vi.fn(),
      summarizeSchemaGuardFailures: vi.fn(),
    });

    await runAcceptanceCommand('studio', 'reset');

    expect(buildInstanceHostnameMappingCheck).toHaveBeenCalledWith('studio', { SVA_STACK_NAME: 'studio' });
    expect(runSchemaGuard).toHaveBeenCalledWith('studio', { SVA_STACK_NAME: 'studio' });
    expect(resetAcceptance).toHaveBeenCalledTimes(1);
  });
});
