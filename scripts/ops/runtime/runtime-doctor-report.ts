import { mkdirSync } from 'node:fs';

import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type {
  AcceptanceDeployOptions,
  AcceptanceDeployStep,
  DoctorCheck,
  DoctorCheckStatus,
  DoctorReport,
  RemoteRuntimeProfile,
} from '../runtime-env.shared.ts';
import type { GuardrailReport } from '../../ci/guardrail-report.ts';
import type { LocalState } from './local-runtime.ts';
import { createDoctorCheckDecorator } from './runtime-doctor-check-decorator.ts';
import type { GuardrailDoctorDeps, RuntimeDoctorReportDeps } from './runtime-doctor-report.types.ts';

type ToDoctorCheck = (
  name: string,
  status: DoctorCheckStatus,
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
) => DoctorCheck;

const createToDoctorCheck = (decorateDoctorCheck: (check: DoctorCheck) => DoctorCheck): ToDoctorCheck =>
  (name, status, code, message, details) =>
    decorateDoctorCheck({
      name,
      status,
      code,
      message,
      ...(details ? { details } : {}),
    });

const mapGuardrailReportCheckToDoctorCheck = (
  toDoctorCheck: ToDoctorCheck,
  check: GuardrailReport['checks'][number],
): DoctorCheck =>
  toDoctorCheck(check.id, check.status, check.code, check.summary, {
    affectedTargets: check.affectedTargets,
    details: check.details,
    enforcementReady: check.enforcementReady,
    evidence: check.evidence,
    suggestedNextStep: check.suggestedNextStep,
    wouldFailInEnforcement: check.wouldFailInEnforcement,
  });

const buildGuardrailUnavailableChecks = (
  deps: RuntimeDoctorReportDeps,
  toDoctorCheck: ToDoctorCheck,
  error: unknown,
): readonly DoctorCheck[] => {
  const message = error instanceof Error ? error.message : String(error);
  return deps.guardrailCheckOrder.map((checkId) =>
    toDoctorCheck(
      checkId,
      'warn',
      'guardrail_report_unavailable',
      'Der report-only Guardrail-Runner konnte nicht geladen werden.',
      {
        affectedTargets: [checkId],
        enforcementReady: false,
        error: message,
        wouldFailInEnforcement: false,
      },
    ),
  );
};

const buildGuardrailDoctorChecks = async (
  deps: RuntimeDoctorReportDeps,
  toDoctorCheck: ToDoctorCheck,
  runtimeProfile: RuntimeProfile,
  input: GuardrailDoctorDeps = {},
): Promise<readonly DoctorCheck[]> => {
  const guardrailRunner = input.runGuardrailReport ?? deps.runGuardrailReport;

  try {
    const report = await guardrailRunner({ runtimeProfile, env: input.env });
    return report.checks.map((check) => mapGuardrailReportCheckToDoctorCheck(toDoctorCheck, check));
  } catch (error) {
    return buildGuardrailUnavailableChecks(deps, toDoctorCheck, error);
  }
};

const buildStudioImageVerifyEvidenceCheck = (
  deps: RuntimeDoctorReportDeps,
  toDoctorCheck: ToDoctorCheck,
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
  options?: AcceptanceDeployOptions,
): DoctorCheck => {
  const imageDigest = options?.imageDigest ?? env.SVA_IMAGE_DIGEST?.trim();
  if (!imageDigest) {
    return toDoctorCheck('studio-image-verify-evidence', 'skipped', 'image_digest_missing', 'Kein Image-Digest fuer die Studio-Image-Verify-Evidenz gesetzt.');
  }

  const evidence = deps.studioImageVerifyEvidenceReaders.readStudioImageVerifyEvidence(imageDigest, {
    imageTag: options?.imageTag ?? env.SVA_IMAGE_TAG?.trim(),
  });
  if (!evidence) {
    return toDoctorCheck(
      'studio-image-verify-evidence',
      runtimeProfile === 'studio' ? 'warn' : 'skipped',
      'image_verify_evidence_missing',
      'Keine passende Studio-Image-Verify-Evidenz fuer den Image-Digest gefunden.',
      {
        acceptedSources: ['artifacts/runtime/image-verify', 'GitHub Actions artifact "Studio Image Verify"'],
        imageDigest,
        expectedArtifactDir: 'artifacts/runtime/image-verify',
      },
    );
  }

  return toDoctorCheck(
    'studio-image-verify-evidence',
    'ok',
    'image_verify_evidence_present',
    'Passende Studio-Image-Verify-Evidenz fuer den Image-Digest gefunden.',
    {
      evidenceSource: evidence.source,
      imageDigest,
      imageRef: evidence.imageRef,
      reportId: evidence.reportId,
      reportPath: evidence.path,
      status: evidence.status,
    },
  );
};

const printDoctorReport = (jsonOutput: boolean, report: DoctorReport) => {
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Diagnose fuer ${report.profile}: ${report.status}`);
  for (const check of report.checks) {
    console.log(`[${check.status.toUpperCase()}] ${check.name}: ${check.message}`);
    if (check.reasonCode || check.recommendedAction || typeof check.repairable === 'boolean') {
      console.log(`  ${JSON.stringify({ reasonCode: check.reasonCode, recommendedAction: check.recommendedAction, repairable: check.repairable })}`);
    }
    if (check.details && Object.keys(check.details).length > 0) console.log(`  ${JSON.stringify(check.details)}`);
  }
};

const finalizeDoctorReport = (runtimeProfile: RuntimeProfile, checks: readonly DoctorCheck[]): DoctorReport => ({
  profile: runtimeProfile,
  status: checks.some((check) => check.status === 'error') ? 'error' : checks.some((check) => check.status === 'warn') ? 'warn' : 'ok',
  generatedAt: new Date().toISOString(),
  checks,
});

const createStepResult = (
  name: AcceptanceDeployStep['name'],
  startedAt: number,
  status: AcceptanceDeployStep['status'],
  summary: string,
  details?: Readonly<Record<string, unknown>>,
): AcceptanceDeployStep => ({
  name,
  status,
  summary,
  startedAt: new Date(startedAt).toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: Date.now() - startedAt,
  ...(details ? { details } : {}),
});

const ensureDirs = (deps: RuntimeDoctorReportDeps) => {
  mkdirSync(deps.runtimeArtifactsDir, { recursive: true });
  mkdirSync(deps.appLogDir, { recursive: true });
  mkdirSync(deps.deployReportDir, { recursive: true });
};

const buildMissingWorkerCheck = (toDoctorCheck: ToDoctorCheck, runtimeProfile: RuntimeProfile) =>
  toDoctorCheck(
    'keycloak-provisioning-worker',
    'warn',
    'local_keycloak_provisioning_worker_missing',
    'Kein lokaler Keycloak-Provisioning-Worker registriert. Neue Provisioning-Laeufe bleiben sonst in planned/queued stehen.',
    { profile: runtimeProfile },
  );

const buildWorkerStateDetails = (workerState: LocalState) => ({
  logFile: workerState.logFile,
  pid: workerState.pid,
  profile: workerState.profile,
  startedAt: workerState.startedAt,
});

const buildLocalProvisioningWorkerCheck = (
  deps: RuntimeDoctorReportDeps,
  toDoctorCheck: ToDoctorCheck,
  runtimeProfile: RuntimeProfile,
  workerState: LocalState | null,
  isAlive: (pid: number) => boolean,
): DoctorCheck => {
  if (!deps.shouldRunLocalProvisioningWorker(runtimeProfile)) {
    return toDoctorCheck('keycloak-provisioning-worker', 'skipped', 'local_provisioning_worker_not_applicable', 'Provisioning-Worker-Check ist fuer dieses Runtime-Profil nicht anwendbar.');
  }
  if (!workerState) return buildMissingWorkerCheck(toDoctorCheck, runtimeProfile);
  if (!isAlive(workerState.pid)) {
    return toDoctorCheck('keycloak-provisioning-worker', 'warn', 'local_keycloak_provisioning_worker_stale', 'Der lokale Keycloak-Provisioning-Worker ist nicht mehr aktiv. Neue Provisioning-Laeufe werden nicht abgearbeitet.', buildWorkerStateDetails(workerState));
  }
  return toDoctorCheck('keycloak-provisioning-worker', 'ok', 'local_keycloak_provisioning_worker_running', 'Der lokale Keycloak-Provisioning-Worker laeuft.', buildWorkerStateDetails(workerState));
};

export const createRuntimeDoctorReportOps = (deps: RuntimeDoctorReportDeps) => {
  const { decorateDoctorCheck } = createDoctorCheckDecorator();
  const toDoctorCheck = createToDoctorCheck(decorateDoctorCheck);

  return {
    buildGuardrailDoctorChecks: (runtimeProfile: RuntimeProfile, input?: GuardrailDoctorDeps) =>
      buildGuardrailDoctorChecks(deps, toDoctorCheck, runtimeProfile, input),
    buildLocalProvisioningWorkerCheck: (runtimeProfile: RuntimeProfile, workerState: LocalState | null, isAlive: (pid: number) => boolean) =>
      buildLocalProvisioningWorkerCheck(deps, toDoctorCheck, runtimeProfile, workerState, isAlive),
    buildStudioImageVerifyEvidenceCheck: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv, options?: AcceptanceDeployOptions) =>
      buildStudioImageVerifyEvidenceCheck(deps, toDoctorCheck, runtimeProfile, env, options),
    createStepResult,
    decorateDoctorCheck,
    ensureDirs: () => ensureDirs(deps),
    finalizeDoctorReport,
    printDoctorReport: (report: DoctorReport) => printDoctorReport(deps.jsonOutput, report),
    printJsonIfRequested: (payload: unknown) => {
      if (deps.jsonOutput) console.log(JSON.stringify(payload, null, 2));
    },
    toDoctorCheck,
  } as const;
};
