import type {
  AcceptanceDeployOptions,
  AcceptanceProbeResult,
  DoctorCheck,
  RemoteRuntimeProfile,
  RuntimeProfile,
} from '../runtime-env.shared.ts';
import type { RemoteServiceContract } from './remote-service-spec.ts';

export type RunCaptureDetailedResult = Readonly<{
  status: number | null;
  stderr: string;
  stdout: string;
}>;

export type RuntimeImageSmokeDeps = {
  buildAcceptanceIngressConsistencyCheck: (env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildAppPrincipalReadinessCheck: (env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildLiveRuntimeEnvCheck: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildProdParityProbePlan: (env: NodeJS.ProcessEnv) => {
    rootHost: string;
    tenantHosts: readonly Readonly<{ host: string; instanceId: string }>[];
  };
  buildTenantAuthProofCheck: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildTrustedForwardedHeaders: (host: string) => HeadersInit;
  commandExists: (commandName: string) => boolean;
  createProbeResult: (input: {
    details?: Readonly<Record<string, unknown>>;
    durationMs: number;
    httpStatus?: number;
    message: string;
    name: string;
    scope: AcceptanceProbeResult['scope'];
    status: AcceptanceProbeResult['status'];
    target: string;
  }) => AcceptanceProbeResult;
  ensureDirs: () => void;
  getConfiguredQuantumEndpoint: (env: NodeJS.ProcessEnv) => string;
  getConfiguredStackName: (env: NodeJS.ProcessEnv) => string;
  getRemoteAppServiceName: (env: NodeJS.ProcessEnv) => string;
  hasLocalEmergencyRemoteMutationOverride: (env: NodeJS.ProcessEnv) => boolean;
  inspectRemoteServiceContract: (
    env: NodeJS.ProcessEnv,
    input: {
      quantumEndpoint: string;
      serviceName: string;
      stackName: string;
    },
  ) => Promise<RemoteServiceContract | null>;
  isExpectedOidcRedirect: (location: string, env: NodeJS.ProcessEnv) => boolean;
  isRemoteRuntimeProfile: (runtimeProfile: RuntimeProfile) => runtimeProfile is RemoteRuntimeProfile;
  parseRuntimeProfile: (value: RuntimeProfile | undefined) => RuntimeProfile | undefined;
  runCapture: (command: string, args: readonly string[], env: NodeJS.ProcessEnv) => string;
  runCaptureDetailed: (command: string, args: readonly string[], env: NodeJS.ProcessEnv) => RunCaptureDetailedResult;
  runHttpProbe: (input: {
    expect: (response: Response, payload: unknown) => string | null;
    headers?: HeadersInit;
    name: string;
    scope: AcceptanceProbeResult['scope'];
    target: string;
  }) => Promise<AcceptanceProbeResult>;
  runtimeArtifactsDir: string;
  summarizeProcessOutput: (output: string) => string;
  wait: (ms: number) => Promise<unknown>;
};

export type ImageSmokeContainer = Readonly<{
  containerName: string;
  envFilePath: string;
  smokeBaseUrl: string;
  smokePort: number;
  start: () => RunCaptureDetailedResult;
}>;
