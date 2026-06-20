import { describe, expect, it, vi } from 'vitest';

import type {
  AcceptanceDeployOptions,
  AcceptanceDeployReport,
  AcceptanceDeployStep,
  AcceptanceFailureCategory,
  DoctorReport,
  RemoteRuntimeProfile,
} from '../runtime-env.shared.ts';
import { createAcceptanceDeployRunner } from './acceptance-deploy.ts';

const createDoctorReport = (status: DoctorReport['status']): DoctorReport => ({
  checks: [],
  generatedAt: '2026-06-19T10:00:00.000Z',
  profile: 'studio',
  status,
});

describe('createAcceptanceDeployRunner', () => {
  it('marks precheck failures as config failures and writes a failed report', async () => {
    const writeAcceptanceDeployReport = vi.fn();
    const printJsonIfRequested = vi.fn();

    const runAcceptanceDeploy = createAcceptanceDeployRunner({
      captureAcceptanceStackStatus: vi.fn(async () => ({ services: 'svc', tasks: 'task' })),
      createBaseAcceptanceDeployReport: vi.fn(
        (_runtimeProfile: RemoteRuntimeProfile, _env: NodeJS.ProcessEnv, options: AcceptanceDeployOptions, migrationFiles: readonly string[]): AcceptanceDeployReport => ({
          actor: options.actor,
          artifacts: {
            bootstrapJobPath: 'bootstrap-job.json',
            bootstrapReportPath: 'bootstrap-report.json',
            externalSmokePath: 'external-smoke.json',
            internalVerifyPath: 'internal-verify.json',
            jsonPath: 'report.json',
            markdownPath: 'report.md',
            migrationJobPath: 'migration-job.json',
            migrationReportPath: 'migration-report.json',
            phaseReportPath: 'phase-report.json',
            releaseManifestPath: 'manifest.json',
          },
          externalProbes: [],
          generatedAt: '2026-06-19T10:00:00.000Z',
          imageDigest: options.imageDigest,
          imageRef: options.imageRef,
          imageRepository: options.imageRepository,
          internalProbes: [],
          migrationFiles,
          observability: { notes: [] },
          profile: 'studio',
          releaseDecision: { summary: 'pending', technicalGatePassed: false },
          releaseManifest: {
            actor: options.actor,
            imageDigest: options.imageDigest,
            imageRef: options.imageRef,
            imageRepository: options.imageRepository,
            profile: 'studio',
            releaseMode: options.releaseMode,
            workflow: options.workflow,
          },
          releaseMode: options.releaseMode,
          reportId: options.reportSlug,
          rollbackHint: options.rollbackHint,
          runtimeContract: {
            derivedKeys: [],
            effectiveSummary: {},
            requiredKeys: [],
          },
          stackName: 'studio',
          status: 'ok',
          steps: [],
          workflow: options.workflow,
        }),
      ),
      createStepResult: vi.fn(
        (name: AcceptanceDeployStep['name'], _startedAt: number, status: AcceptanceDeployStep['status'], summary: string) => ({
          durationMs: 1,
          finishedAt: '2026-06-19T10:00:01.000Z',
          name,
          startedAt: '2026-06-19T10:00:00.000Z',
          status,
          summary,
        }),
      ),
      getGooseConfiguredVersion: vi.fn(() => '0001'),
      listGooseMigrationFiles: vi.fn(() => []),
      precheckAcceptance: vi.fn(async () => createDoctorReport('error')),
      printJsonIfRequested,
      resolveAcceptanceDeployOptions: vi.fn(
        (): AcceptanceDeployOptions => ({
          actor: 'codex',
          imageDigest: 'sha256:deadbeef',
          imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeef',
          imageRepository: 'sva-studio',
          releaseMode: 'app-only',
          reportSlug: 'report-id',
          rollbackHint: 'rollback',
          workflow: 'Studio Image Verify',
        }),
      ),
      waitForPostDeployStabilization: vi.fn(async () => 0),
      writeAcceptanceDeployReport,
      assertDeterministicRemoteMutationContext: vi.fn(() => ({ mode: 'local-operator' as const })),
      runImageSmoke: vi.fn(),
      runMigrationJobAgainstAcceptance: vi.fn(),
      runBootstrapJobAgainstAcceptance: vi.fn(),
      buildInstanceHostnameMappingCheck: vi.fn(),
      runSchemaGuard: vi.fn(),
      summarizeSchemaGuardFailures: vi.fn(),
      deployAcceptanceStack: vi.fn(),
      runInternalVerify: vi.fn(),
      runExternalSmokeWithWarmup: vi.fn(),
      jsonOutput: true,
    });

    await expect(runAcceptanceDeploy('studio', {} as NodeJS.ProcessEnv)).rejects.toThrow(
      'Acceptance-Deploy fehlgeschlagen (config). Bericht: report.md',
    );

    const failedReport = writeAcceptanceDeployReport.mock.calls[0]?.[0] as AcceptanceDeployReport | undefined;
    expect(failedReport?.failureCategory).toBe('config' satisfies AcceptanceFailureCategory);
    expect(failedReport?.status).toBe('error');
    expect(printJsonIfRequested).toHaveBeenCalled();
  });
});
