import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderQuantumDeployProject } from './acceptance-maintenance-report.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('renderQuantumDeployProject', () => {
  it('validates the rendered compose document against the compose app service key', () => {
    const assertComposeServiceNetworks = vi.fn(() => ({ labels: {}, networks: ['internal', 'public'] }));
    const assertComposeServiceIngressLabels = vi.fn();

    const project = renderQuantumDeployProject({
      assertComposeServiceIngressLabels,
      assertComposeServiceNetworks,
      buildAcceptanceIngressConsistencyCheck: vi.fn(),
      buildAppPrincipalReadinessCheck: vi.fn(),
      buildLocalRuntimeDeployReportPaths: vi.fn(),
      buildQuantumDeployComposeDocument: vi.fn((compose) => compose),
      checkHttpHealth: vi.fn(),
      commandExists: vi.fn(),
      createStepResult: vi.fn(),
      deployReportDir: '/tmp',
      getConfiguredQuantumEndpoint: vi.fn(),
      getConfiguredStackName: vi.fn(),
      getGooseConfiguredVersion: vi.fn(),
      getRemoteAppServiceName: vi.fn(() => 'studio-app'),
      getRemoteComposeFile: () => 'deploy/portainer/docker-compose.studio.yml',
      getRuntimeContractSummary: vi.fn(),
      getRuntimeProfileDerivedEnvKeys: vi.fn(),
      getRuntimeProfileRequiredEnvKeys: vi.fn(),
      inspectRemoteServiceContract: vi.fn(),
      isRemoteRuntimeProfile: (runtimeProfile): runtimeProfile is 'studio' => runtimeProfile === 'studio',
      listGooseMigrationFiles: vi.fn(),
      parseJsonFromCommandOutput: vi.fn(),
      readRemoteStackEvidence: vi.fn(),
      rootDir: '/repo',
      run: vi.fn(),
      runBootstrapJobAgainstAcceptance: vi.fn(),
      runCapture: vi.fn(() => JSON.stringify({ services: { app: {} } })),
      runCaptureDetailed: vi.fn(),
      runMigrationJobAgainstAcceptance: vi.fn(),
      runQuantumExec: vi.fn(),
      runSchemaGuard: vi.fn(),
      shouldSkipQuantumPrePull: vi.fn(),
      summarizeSchemaGuardFailures: vi.fn(),
      withoutDebugEnv: vi.fn(),
    }, { SVA_RUNTIME_PROFILE: 'studio' });

    expect(assertComposeServiceNetworks).toHaveBeenCalledWith({ services: { app: {} } }, 'app', ['internal', 'public']);
    expect(assertComposeServiceIngressLabels).toHaveBeenCalledWith({ services: { app: {} } }, 'app');

    project.cleanup();
  });
});
