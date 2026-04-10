import { describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { formatRemoteStackSnapshot, inspectRemoteStack } from '../../../scripts/ops/runtime/remote-stack-state.ts';

describe('remote-stack-state runtime helpers', () => {
  it('builds a stack snapshot from the Portainer API and formats it for status output', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              ID: 'service-app',
              ServiceStatus: {
                DesiredTasks: 1,
              },
              Spec: {
                Labels: {
                  'com.docker.stack.namespace': 'studio',
                },
                Name: 'studio_app',
                TaskTemplate: {
                  ContainerSpec: {
                    Image: 'ghcr.io/example/app@sha256:abc',
                  },
                },
              },
            },
            {
              ID: 'service-bootstrap',
              ServiceStatus: {
                DesiredTasks: 0,
              },
              Spec: {
                Labels: {
                  'com.docker.stack.namespace': 'studio',
                },
                Name: 'studio_bootstrap',
                TaskTemplate: {
                  ContainerSpec: {
                    Image: 'ghcr.io/example/app@sha256:abc',
                  },
                },
              },
            },
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              ID: 'task-running',
              DesiredState: 'running',
              ServiceID: 'service-app',
              Slot: 1,
              Status: {
                State: 'running',
                Timestamp: '2026-04-09T17:58:07.018392917Z',
              },
            },
            {
              ID: 'task-shutdown',
              DesiredState: 'shutdown',
              ServiceID: 'service-app',
              Slot: 1,
              Status: {
                State: 'shutdown',
                Timestamp: '2026-04-09T17:58:00.295813375Z',
              },
            },
          ]),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    try {
      const snapshot = await inspectRemoteStack(
        {
          commandExists: () => false,
          runCapture: () => '[]',
        },
        {
          QUANTUM_API_KEY: 'ptr_example',
          QUANTUM_ENDPOINT_ID: '64',
          QUANTUM_HOST: 'https://console.example.test',
        },
        {
          quantumEndpoint: 'sva',
          stackName: 'studio',
        },
      );

      expect(snapshot.channel).toBe('portainer-api');
      expect(snapshot.services.map((service) => [service.shortName, service.runningReplicas, service.desiredReplicas])).toEqual([
        ['app', 1, 1],
        ['bootstrap', 0, 0],
      ]);
      expect(formatRemoteStackSnapshot(snapshot)).toContain('service app');
      expect(formatRemoteStackSnapshot(snapshot)).toContain('replicated 1/1');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
