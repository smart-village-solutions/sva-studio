import { describe, expect, it, vi } from 'vitest';

import type { DoctorReport, RuntimeCommand, RuntimeProfile } from '../runtime-env.shared.ts';
import { createLocalRuntimeCommandRunner } from './local-command.ts';

describe('createLocalRuntimeCommandRunner', () => {
  it('runs the local up flow in the expected order', async () => {
    const calls: string[] = [];
    const runLocalCommand = createLocalRuntimeCommandRunner({
      appLogDir: '/tmp/logs',
      assertDangerousOperationApproved: vi.fn(),
      assertRuntimeEnv: vi.fn(() => {
        calls.push('assertRuntimeEnv');
      }),
      bootstrapLocalAppUser: vi.fn(() => {
        calls.push('bootstrapLocalAppUser');
      }),
      buildLocalHealthUrl: vi.fn(() => 'http://localhost:3000/health/live'),
      buildProfileEnv: vi.fn(() => ({ SVA_ENABLE_MONITORING: 'true' })),
      checkLocalInstanceRegistryDrift: vi.fn(() => {
        calls.push('checkLocalInstanceRegistryDrift');
      }),
      cliOptions: {
        approvalToken: undefined,
        authoritative: false,
        jsonOutput: false,
        localOverrideFile: undefined,
      },
      composeWithMonitoringArgs: ['compose'],
      createLocalRuntimeAuditLogger: vi.fn(() => ({
        run: async <T>(_phase: string, operation: () => Promise<T> | T) => await operation(),
      })),
      createRepairDeps: vi.fn(),
      doctorRuntime: vi.fn(async (): Promise<DoctorReport> => ({
        checks: [],
        generatedAt: '2026-06-19T10:00:00.000Z',
        profile: 'local-keycloak',
        status: 'ok',
      })),
      downLocalInfra: vi.fn(),
      getComposeArgs: vi.fn(() => ['compose']),
      getGitCommitSha: vi.fn(() => 'abc123'),
      jsonOutput: false,
      localStateFile: '/tmp/local-state.json',
      localWorkerStateFile: '/tmp/local-worker.json',
      migrateLocalDatabase: vi.fn(() => {
        calls.push('migrateLocalDatabase');
      }),
      printDoctorReport: vi.fn(),
      pullLocalInfra: vi.fn(),
      readLocalState: vi.fn(),
      readLocalWorkerState: vi.fn(),
      rebuildAuditLogFile: '/tmp/rebuild-audit.log',
      reconcileLocalInstanceRegistry: vi.fn(),
      repairLocalRuntimeWithDeps: vi.fn(),
      resolveLocalDangerousApprovalRequirement: vi.fn(),
      rootDir: '/repo',
      run: vi.fn(),
      runSchemaGuard: vi.fn(),
      shouldAuditLocalRuntimeCommand: vi.fn(() => true),
      shouldRunLocalProvisioningWorker: vi.fn(() => true),
      smokeRuntime: vi.fn(),
      startLocalApp: vi.fn(() => {
        calls.push('startLocalApp');
      }),
      startLocalProvisioningWorker: vi.fn(() => {
        calls.push('startLocalProvisioningWorker');
      }),
      stopLocalApp: vi.fn(),
      stopLocalProvisioningWorker: vi.fn(),
      summarizeSchemaGuardFailures: vi.fn(),
      syncLocalTenantSecretsToRegistry: vi.fn(),
      upLocalInfra: vi.fn(() => {
        calls.push('upLocalInfra');
      }),
      verifyLocalDbSchemaSnapshot: vi.fn(),
      processExitCodeSetter: vi.fn(),
      consoleLike: {
        log: vi.fn(),
      },
    });

    await runLocalCommand('local-keycloak', 'up');

    expect(calls).toEqual([
      'assertRuntimeEnv',
      'upLocalInfra',
      'migrateLocalDatabase',
      'bootstrapLocalAppUser',
      'checkLocalInstanceRegistryDrift',
      'startLocalApp',
      'startLocalProvisioningWorker',
    ]);
  });

  it('prints state and compose ps output for status', async () => {
    const log = vi.fn();
    const run = vi.fn();
    const runLocalCommand = createLocalRuntimeCommandRunner({
      appLogDir: '/tmp/logs',
      assertDangerousOperationApproved: vi.fn(),
      assertRuntimeEnv: vi.fn(),
      bootstrapLocalAppUser: vi.fn(),
      buildLocalHealthUrl: vi.fn(),
      buildProfileEnv: vi.fn(() => ({ SVA_ENABLE_MONITORING: 'false' })),
      checkLocalInstanceRegistryDrift: vi.fn(),
      cliOptions: {
        approvalToken: undefined,
        authoritative: false,
        jsonOutput: false,
        localOverrideFile: undefined,
      },
      composeWithMonitoringArgs: ['compose'],
      createLocalRuntimeAuditLogger: vi.fn(() => null),
      createRepairDeps: vi.fn(),
      doctorRuntime: vi.fn(),
      downLocalInfra: vi.fn(),
      getComposeArgs: vi.fn(() => ['compose']),
      getGitCommitSha: vi.fn(),
      jsonOutput: false,
      localStateFile: '/tmp/local-state.json',
      localWorkerStateFile: '/tmp/local-worker.json',
      migrateLocalDatabase: vi.fn(),
      printDoctorReport: vi.fn(),
      pullLocalInfra: vi.fn(),
      readLocalState: vi.fn(() => ({ pid: 1 })),
      readLocalWorkerState: vi.fn(() => ({ pid: 2 })),
      rebuildAuditLogFile: '/tmp/rebuild-audit.log',
      reconcileLocalInstanceRegistry: vi.fn(),
      repairLocalRuntimeWithDeps: vi.fn(),
      resolveLocalDangerousApprovalRequirement: vi.fn(),
      rootDir: '/repo',
      run,
      runSchemaGuard: vi.fn(),
      shouldAuditLocalRuntimeCommand: vi.fn(() => false),
      shouldRunLocalProvisioningWorker: vi.fn(() => false),
      smokeRuntime: vi.fn(),
      startLocalApp: vi.fn(),
      startLocalProvisioningWorker: vi.fn(),
      stopLocalApp: vi.fn(),
      stopLocalProvisioningWorker: vi.fn(),
      summarizeSchemaGuardFailures: vi.fn(),
      syncLocalTenantSecretsToRegistry: vi.fn(),
      upLocalInfra: vi.fn(),
      verifyLocalDbSchemaSnapshot: vi.fn(),
      processExitCodeSetter: vi.fn(),
      consoleLike: { log },
    });

    await runLocalCommand('local-builder', 'status');

    expect(log).toHaveBeenCalledWith(
      JSON.stringify({ app: { pid: 1 }, profile: 'local-builder', worker: { pid: 2 } }, null, 2),
    );
    expect(run).toHaveBeenCalledWith('docker', ['compose', 'ps'], { SVA_ENABLE_MONITORING: 'false' });
  });
});
