import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { AcceptanceProbeResult, RemoteRuntimeProfile } from '../runtime-env.shared.ts';

export type RuntimeCommandRunnerDeps = {
  rootDir: string;
  run: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => void;
  runCapture: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => string;
  runCaptureDetailed: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => {
    status: number | null;
    stderr: string;
    stdout: string;
  };
  runHttpProbe: (input: {
    expect: (response: Response, payload: unknown) => string | null;
    headers?: HeadersInit;
    name: string;
    scope: AcceptanceProbeResult['scope'];
    target: string;
  }) => Promise<AcceptanceProbeResult>;
  runLocalGooseStatus: (env: NodeJS.ProcessEnv) => { summary: string; version: string };
  runQuantumExec: (args: readonly string[], env: NodeJS.ProcessEnv, options: { failureMessage: string; marker?: string }) => string;
  runtimeArtifactsDir: string;
};

export type RuntimeCommandProcessDeps = Pick<
  RuntimeCommandRunnerDeps,
  'rootDir' | 'run' | 'runCapture' | 'runCaptureDetailed' | 'runHttpProbe' | 'runQuantumExec'
>;

export type RuntimeProfileInspectionDeps = {
  getGooseConfiguredVersion: () => string | undefined;
  getRemoteAppServiceName: ReturnType<typeof import('./runtime-config.ts').createRuntimeConfigOps>['getRemoteAppServiceName'];
  getRemoteComposeFile: ReturnType<typeof import('./runtime-config.ts').createRuntimeConfigOps>['getRemoteComposeFile'];
  getRuntimeContractSummary: ReturnType<typeof import('./runtime-config.ts').createRuntimeConfigOps>['getRuntimeContractSummary'];
  getRuntimeProfileDefinition: typeof import('../../../packages/core/src/runtime-profile.ts').getRuntimeProfileDefinition;
  getRuntimeProfileDerivedEnvKeys: typeof import('../../../packages/core/src/runtime-profile.ts').getRuntimeProfileDerivedEnvKeys;
  getRuntimeProfileRequiredEnvKeys: typeof import('../../../packages/core/src/runtime-profile.ts').getRuntimeProfileRequiredEnvKeys;
  getRuntimeStatusExecutionMode: typeof import('../runtime-env.shared.ts').getRuntimeStatusExecutionMode;
  hasLocalEmergencyRemoteMutationOverride: typeof import('../runtime-env.shared.ts').hasLocalEmergencyRemoteMutationOverride;
  inspectRemoteServiceContract: typeof import('./remote-service-spec.ts').inspectRemoteServiceContract;
  isExpectedOidcRedirect: typeof import('./acceptance-runtime-checks.ts').isExpectedOidcRedirect;
  isMainserverCheckRequired: ReturnType<typeof import('./runtime-config.ts').createRuntimeConfigOps>['isMainserverCheckRequired'];
  isMigrationStatusCheckRequired: ReturnType<typeof import('./runtime-config.ts').createRuntimeConfigOps>['isMigrationStatusCheckRequired'];
  isMockAuthRuntimeProfile: typeof import('../../../packages/core/src/runtime-profile.ts').isMockAuthRuntimeProfile;
  isProcessAlive: typeof import('./local-runtime.ts').isProcessAlive;
  isRemoteRuntimeProfile: (runtimeProfile: RuntimeProfile) => runtimeProfile is RemoteRuntimeProfile;
  jsonOutput: boolean;
  listGooseMigrationFiles: () => readonly string[];
  loadActiveLocalTenantSecretStates: (env: NodeJS.ProcessEnv) => Promise<readonly unknown[]>;
  localInstanceOps: ReturnType<typeof import('./runtime-local-instance-ops.ts').createRuntimeLocalInstanceOps>;
};

export type RuntimeContractDeps = Pick<
  RuntimeProfileInspectionDeps,
  'getRuntimeContractSummary' | 'getRuntimeProfileDerivedEnvKeys' | 'getRuntimeProfileRequiredEnvKeys'
>;

export type RemoteRuntimeConfigDeps = Pick<
  RuntimeProfileInspectionDeps,
  'getGooseConfiguredVersion' | 'getRemoteAppServiceName' | 'getRemoteComposeFile'
> & {
  getConfiguredQuantumEndpoint: (env: NodeJS.ProcessEnv) => string;
  getConfiguredStackName: (env: NodeJS.ProcessEnv) => string;
};
