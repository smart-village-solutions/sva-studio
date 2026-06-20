import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { AcceptanceDeployOptions, DoctorCheck, RemoteRuntimeProfile } from '../runtime-env.shared.ts';
import type { GuardrailReport } from '../../ci/guardrail-report.ts';
import type { StudioImageVerifyEvidence } from './studio-image-verify-evidence.ts';

export type GuardrailDoctorDeps = Readonly<{
  env?: NodeJS.ProcessEnv;
  runGuardrailReport?: (input: { runtimeProfile: string; env?: NodeJS.ProcessEnv }) => Promise<GuardrailReport>;
}>;

export type RuntimeDoctorReportDeps = Readonly<{
  appLogDir: string;
  deployReportDir: string;
  getRuntimeProfileDefinition: (runtimeProfile: RuntimeProfile) => { isLocal: boolean };
  guardrailCheckOrder: readonly string[];
  jsonOutput: boolean;
  runtimeArtifactsDir: string;
  runGuardrailReport: (input: { runtimeProfile: string; env?: NodeJS.ProcessEnv }) => Promise<GuardrailReport>;
  shouldRunLocalProvisioningWorker: (runtimeProfile: RuntimeProfile) => boolean;
  studioImageVerifyEvidenceReaders: {
    readStudioImageVerifyEvidence: (imageDigest?: string, options?: { readonly imageTag?: string }) => StudioImageVerifyEvidence | undefined;
  };
}>;

export type DoctorCheckFactory = (
  name: string,
  status: DoctorCheck['status'],
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
) => DoctorCheck;
