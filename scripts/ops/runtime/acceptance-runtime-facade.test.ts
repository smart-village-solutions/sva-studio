import { describe, expect, it, vi } from 'vitest';

import { createAcceptanceRuntimeCore } from './acceptance-runtime-facade.ts';
import type { AcceptanceDeployOptions } from '../runtime-env.shared.ts';

const acceptanceOptions: AcceptanceDeployOptions = {
  actor: 'codex',
  imageDigest: 'sha256:deadbeef',
  imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeef',
  imageRepository: 'sva-studio',
  releaseMode: 'app-only',
  reportSlug: 'runtime-facade',
  rollbackHint: 'rollback',
  workflow: 'Studio Image Verify',
};

describe('createAcceptanceRuntimeCore', () => {
  it('uses the resolved remote app service name for live-image fallback inspection', async () => {
    const runCaptureDetailed = vi.fn(() => ({
      status: 0,
      stderr: '',
      stdout: 'ghcr.io/smart-village-solutions/sva-studio@sha256:live',
    }));

    const core = createAcceptanceRuntimeCore({
      acceptanceRemoteStateOps: {
        readRemoteStackEvidence: vi.fn(async () => ({
          channel: 'portainer-api' as const,
          hasRunningService: () => true,
          summary: 'ok',
        })),
        runBootstrapJobAgainstAcceptance: vi.fn(),
        runMigrationJobAgainstAcceptance: vi.fn(),
      },
      assertComposeServiceIngressLabels: vi.fn(),
      assertComposeServiceNetworks: vi.fn(() => ({ env: {}, labels: {}, networks: ['internal', 'network-node-005'] })),
      assertDeterministicRemoteMutationContext: vi.fn(),
      buildAcceptanceReportPaths: vi.fn(),
      buildInstanceHostnameMappingCheck: vi.fn(),
      buildProdParityProbePlan: vi.fn(),
      buildQuantumDeployComposeDocument: vi.fn(),
      buildTrustedForwardedHeaders: vi.fn(),
      checkHttpHealth: vi.fn(),
      cliOptions: {},
      commandExists: vi.fn(() => true),
      createProbeResult: vi.fn(),
      createStepResult: vi.fn(),
      deployReportDir: '/tmp',
      ensureDirs: vi.fn(),
      getConfiguredQuantumEndpoint: vi.fn(() => 'https://quantum.example.test'),
      getConfiguredStackName: vi.fn(() => 'studio'),
      getGooseConfiguredVersion: vi.fn(() => '0001'),
      getRemoteAppServiceName: vi.fn(() => 'studio-app'),
      getRemoteComposeFile: () => 'deploy/portainer/docker-compose.studio.yml',
      getRuntimeContractSummary: vi.fn((runtimeProfile) => ({
        enableOtel: true,
        mainserverRequired: false,
        parentDomain: null,
        publicBaseUrl: null,
        quantumEndpoint: 'https://quantum.example.test',
        runtimeProfile,
        stackName: 'studio',
        supportedTenantHosts: [],
      })),
      getRuntimeProfileDerivedEnvKeys: vi.fn(() => []),
      getRuntimeProfileRequiredEnvKeys: vi.fn(() => []),
      hasLocalEmergencyRemoteMutationOverride: vi.fn(() => false),
      inspectRemoteServiceContract: vi.fn(async () => null),
      isExpectedOidcRedirect: vi.fn(),
      isRemoteRuntimeProfile: (runtimeProfile): runtimeProfile is 'studio' => runtimeProfile === 'studio',
      jsonOutput: false,
      listGooseMigrationFiles: vi.fn(() => []),
      parseJsonFromCommandOutput: vi.fn(),
      parseRuntimeProfile: vi.fn(),
      printJsonIfRequested: vi.fn(),
      resolveAcceptanceDeployOptions: vi.fn(),
      rootDir: '/repo',
      run: vi.fn(),
      runCapture: vi.fn(() => JSON.stringify({ services: { 'studio-app': {} } })),
      runCaptureDetailed,
      runHttpProbe: vi.fn(),
      runQuantumExec: vi.fn(),
      runSchemaGuard: vi.fn(),
      shouldSkipQuantumPrePull: vi.fn(() => false),
      summarizeProcessOutput: vi.fn(),
      summarizeSchemaGuardFailures: vi.fn(),
      toDoctorCheck: vi.fn((name, status, code, message, details) => ({ code, details, message, name, status })),
      wait: vi.fn(async () => {}),
      withoutDebugEnv: vi.fn((env) => env),
    });

    await core.buildAcceptanceLiveSpecCheck('studio', {} as NodeJS.ProcessEnv, acceptanceOptions);

    expect(runCaptureDetailed).toHaveBeenCalledWith(
      'docker',
      ['service', 'inspect', 'studio_studio-app', '--format', '{{.Spec.TaskTemplate.ContainerSpec.Image}}'],
      {} as NodeJS.ProcessEnv,
    );
  });
});
