import { describe, expect, it, vi } from 'vitest';

import type { RemoteServiceContract } from './remote-service-spec.ts';

vi.mock('./remote-stack-state.ts', () => ({
  formatRemoteStackSnapshot: vi.fn(() => 'formatted'),
  inspectRemoteStack: vi.fn(async () => {
    throw new Error('portainer unavailable');
  }),
}));

vi.mock('./remote-service-spec.ts', () => ({
  inspectRemoteServiceContract: vi.fn(),
}));

vi.mock('./migration-job.ts', () => ({
  collectQuantumTaskSnapshots: vi.fn(),
  extractQuantumJsonPayload: vi.fn(),
  runMigrationJobAgainstAcceptance: vi.fn(),
  selectLatestMigrationTask: vi.fn(),
}));

vi.mock('./bootstrap-job.ts', () => ({
  runBootstrapJobAgainstAcceptance: vi.fn(),
}));

import { inspectRemoteServiceContract } from './remote-service-spec.ts';
import { createAcceptanceRemoteStateOps } from './acceptance-remote-state.ts';

const createRemoteServiceContract = (networkNames: readonly string[]): RemoteServiceContract => ({
  env: {},
  labels: {},
  networkNames,
  serviceName: 'studio_service',
});

describe('acceptance-remote-state', () => {
  it('derives the internal network for remote jobs without picking ingress-style overlay names', async () => {
    vi.mocked(inspectRemoteServiceContract)
      .mockResolvedValueOnce(createRemoteServiceContract(['public', 'network-node-005']))
      .mockResolvedValueOnce(createRemoteServiceContract(['public', 'internal']));

    const ops = createAcceptanceRemoteStateOps({
      commandExists: vi.fn(() => false),
      getConfiguredQuantumEndpoint: vi.fn(() => 'https://quantum.example.test'),
      getConfiguredStackName: vi.fn(() => 'studio'),
      getRemoteAppServiceName: vi.fn(() => 'studio-app'),
      getRemoteComposeFile: vi.fn(() => 'deploy/portainer/docker-compose.studio.yml'),
      jobCommands: {
        commandExists: vi.fn(() => true),
        run: vi.fn(),
        runCapture: vi.fn(),
        runCaptureDetailed: vi.fn(),
        spawnBackground: vi.fn(),
      },
      rootDir: '/repo',
      runCapture: vi.fn(),
      runCaptureDetailed: vi.fn(),
    });

    await ops.runMigrationJobAgainstAcceptance({} as NodeJS.ProcessEnv, 'studio', 'report-1');

    expect(inspectRemoteServiceContract).toHaveBeenNthCalledWith(
      1,
      { commandExists: expect.any(Function), runCapture: expect.any(Function) },
      {} as NodeJS.ProcessEnv,
      { quantumEndpoint: 'https://quantum.example.test', serviceName: 'postgres', stackName: 'studio' },
    );
  });
});
