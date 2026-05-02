import { describe, expect, it, vi } from 'vitest';

import { inspectRemoteServiceContract } from '../../../scripts/ops/runtime/remote-service-spec.ts';

describe('remote-service-spec runtime helpers', () => {
  it('loads the remote service contract from the Portainer API and resolves network names', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              Spec: {
                Name: 'studio_app',
                Labels: {
                  'traefik.enable': 'true',
                },
                TaskTemplate: {
                  ContainerSpec: {
                    Env: ['SVA_RUNTIME_PROFILE=studio'],
                    Image: 'ghcr.io/example/app@sha256:abc',
                  },
                  Networks: [{ Target: 'internal-id' }, { Target: 'public-id' }],
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
            { Id: 'internal-id', Name: 'studio_internal' },
            { Id: 'public-id', Name: 'public' },
          ]),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await inspectRemoteServiceContract(
        {
          commandExists: () => false,
          runCapture: () => JSON.stringify([{ Id: 64, Name: 'sva' }]),
        },
        {
          QUANTUM_ENDPOINT_ID: '64',
          QUANTUM_API_KEY: 'ptr_example',
          QUANTUM_HOST: 'https://console.example.test',
        },
        {
          quantumEndpoint: 'sva',
          serviceName: 'app',
          stackName: 'studio',
        },
      );

      expect(result).toEqual({
        env: {
          SVA_RUNTIME_PROFILE: 'studio',
        },
        image: 'ghcr.io/example/app@sha256:abc',
        labels: {
          'traefik.enable': 'true',
        },
        networkNames: ['studio_internal', 'public'],
        serviceName: 'studio_app',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fails fast when neither endpoint id nor quantum-cli are available', async () => {
    await expect(
      inspectRemoteServiceContract(
        {
          commandExists: () => false,
          runCapture: () => '[]',
        },
        {
          QUANTUM_API_KEY: 'ptr_example',
        },
        {
          quantumEndpoint: 'sva',
          serviceName: 'app',
          stackName: 'studio',
        },
      ),
    ).rejects.toThrow(/QUANTUM_ENDPOINT_ID/);
  });
});
