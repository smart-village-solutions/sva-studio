import { describe, expect, it, vi } from 'vitest';

import {
  parseWasteWebReleaseTag,
  releasePublicWasteStack,
  updateStackEnv,
} from './portainer-release.ts';

describe('public waste portainer release', () => {
  it('accepts waste-web SemVer tags', () => {
    expect(parseWasteWebReleaseTag('refs/tags/waste-web-v1.2.3')).toEqual({
      gitTag: 'waste-web-v1.2.3',
      imageTag: 'v1.2.3',
      version: '1.2.3',
    });
  });

  it('updates only PUBLIC_WASTE_IMAGE_TAG and preserves other stack env values', () => {
    expect(
      updateStackEnv(
        [
          { name: 'PUBLIC_WASTE_IMAGE_TAG', value: 'v1.2.2' },
          { name: 'PUBLIC_WASTE_PUBLIC_HOST', value: 'bb-prignitz.abfallkalender.smart-village.app' },
        ],
        'v1.2.3'
      )
    ).toEqual([
      { name: 'PUBLIC_WASTE_IMAGE_TAG', value: 'v1.2.3' },
      { name: 'PUBLIC_WASTE_PUBLIC_HOST', value: 'bb-prignitz.abfallkalender.smart-village.app' },
    ]);
  });

  it('updates the remote stack payload without changing unrelated env values', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              Id: 42,
              Name: 'web-waste-calendar',
              EndpointId: 7,
            },
          ])
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Id: 42,
            Name: 'web-waste-calendar',
            EndpointId: 7,
            Env: [
              { name: 'PUBLIC_WASTE_IMAGE_TAG', value: 'v1.2.2' },
              { name: 'PUBLIC_WASTE_PUBLIC_HOST', value: 'bb-prignitz.abfallkalender.smart-village.app' },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            StackFileContent: "version: '3.8'\nservices:\n  app:\n    image: ghcr.io/example/public-waste:v1.2.2\n",
          })
        )
      )
      .mockResolvedValueOnce(new Response('{}'));

    const result = await releasePublicWasteStack(
      {
        GITHUB_REF: 'refs/tags/waste-web-v1.2.3',
        PUBLIC_WASTE_STACK_NAME: 'web-waste-calendar',
        QUANTUM_API_KEY: 'secret',
        QUANTUM_ENDPOINT_ID: '7',
        QUANTUM_HOST: 'https://portainer.example.invalid',
      },
      {
        commandExists: vi.fn().mockReturnValue(false),
        fetch,
        runCapture: vi.fn(),
      }
    );

    expect(result).toMatchObject({
      gitTag: 'waste-web-v1.2.3',
      imageTag: 'v1.2.3',
      previousImageTag: 'v1.2.2',
      stackId: 42,
      stackName: 'web-waste-calendar',
    });

    expect(fetch).toHaveBeenCalledTimes(4);

    const updateCall = fetch.mock.calls[3];
    expect(updateCall?.[0]).toBe('https://portainer.example.invalid/api/stacks/42?endpointId=7');
    expect(updateCall?.[1]).toMatchObject({
      method: 'PUT',
      headers: {
        'X-API-Key': 'secret',
        'content-type': 'application/json',
      },
    });
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
      Env: [
        { name: 'PUBLIC_WASTE_IMAGE_TAG', value: 'v1.2.3' },
        { name: 'PUBLIC_WASTE_PUBLIC_HOST', value: 'bb-prignitz.abfallkalender.smart-village.app' },
      ],
      Prune: false,
      StackFileContent: "version: '3.8'\nservices:\n  app:\n    image: ghcr.io/example/public-waste:v1.2.2\n",
    });
  });
});
