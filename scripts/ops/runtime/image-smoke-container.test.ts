import { describe, expect, it, vi } from 'vitest';

import { runContainerHttpProbe, waitForContainerHttpOk } from './image-smoke-container.ts';
import type { RuntimeImageSmokeDeps } from './image-smoke.types.ts';

const createDeps = (): RuntimeImageSmokeDeps => ({
  buildAcceptanceIngressConsistencyCheck: vi.fn(),
  buildAppPrincipalReadinessCheck: vi.fn(),
  buildLiveRuntimeEnvCheck: vi.fn(),
  buildProdParityProbePlan: vi.fn(),
  buildTenantAuthProofCheck: vi.fn(),
  buildTrustedForwardedHeaders: vi.fn(),
  commandExists: vi.fn(),
  createProbeResult: vi.fn((input) => input),
  ensureDirs: vi.fn(),
  getConfiguredQuantumEndpoint: vi.fn(),
  getConfiguredStackName: vi.fn(),
  getRemoteAppServiceName: vi.fn(),
  hasLocalEmergencyRemoteMutationOverride: vi.fn(),
  inspectRemoteServiceContract: vi.fn(),
  isExpectedOidcRedirect: vi.fn(),
  isRemoteRuntimeProfile: (runtimeProfile): runtimeProfile is 'studio' => runtimeProfile === 'studio',
  parseRuntimeProfile: vi.fn(),
  runCapture: vi.fn(),
  runCaptureDetailed: vi.fn(),
  runHttpProbe: vi.fn(),
  runtimeArtifactsDir: '/tmp',
  summarizeProcessOutput: vi.fn(),
  wait: vi.fn(async () => {}),
});

describe('image-smoke-container', () => {
  it('uses an abort timeout while waiting for the container health endpoint', async () => {
    const deps = createDeps();
    const runCaptureDetailed = vi.mocked(deps.runCaptureDetailed);
    runCaptureDetailed.mockReturnValue({ status: 0, stderr: '', stdout: '' });

    await waitForContainerHttpOk(deps, 'smoke-container', '/health/live', 1_000, {} as NodeJS.ProcessEnv);

    const script = runCaptureDetailed.mock.calls[0]?.[1]?.[4];
    expect(script).toContain('AbortSignal.timeout(10000)');
    expect(script).toContain('fetch("http://127.0.0.1:3000/health/live", { signal })');
  });

  it('uses an abort timeout for direct container HTTP probes', async () => {
    const deps = createDeps();
    const runCaptureDetailed = vi.mocked(deps.runCaptureDetailed);
    runCaptureDetailed.mockReturnValue({
      status: 0,
      stderr: '',
      stdout: JSON.stringify({ ok: true, status: 200, text: '{"ok":true}' }),
    });

    await runContainerHttpProbe(deps, 'smoke-container', '/health/ready', {} as NodeJS.ProcessEnv, {
      expect: () => null,
      name: 'health-ready',
      scope: 'internal',
      target: '/health/ready',
    });

    const script = runCaptureDetailed.mock.calls[0]?.[1]?.[4];
    expect(script).toContain('AbortSignal.timeout(10000)');
    expect(script).toContain('fetch(url, { signal })');
  });
});
