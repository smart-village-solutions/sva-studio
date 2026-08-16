import { describe, expect, it, vi } from 'vitest';

import {
  cutoverPublicWasteStackDomain,
  ensurePublicWasteCertificateResolver,
  parseWasteWebReleaseTag,
  releasePublicWasteStack,
  setPublicWasteStackMaintenance,
  updatePublicWasteDatabaseUrl,
  updatePublicWasteDomainEnv,
  updatePublicWasteReplicas,
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
          {
            name: 'PUBLIC_WASTE_PUBLIC_HOST',
            value: 'bb-prignitz.abfallkalender.smart-village.app',
          },
        ],
        'v1.2.3'
      )
    ).toEqual([
      { name: 'PUBLIC_WASTE_IMAGE_TAG', value: 'v1.2.3' },
      { name: 'PUBLIC_WASTE_PUBLIC_HOST', value: 'bb-prignitz.abfallkalender.smart-village.app' },
    ]);
  });

  it('renders the stopped and PostgreSQL-backed running stack without touching other settings', () => {
    const stack =
      'services:\n  app:\n    image: example\n    deploy:\n      replicas: 1\n      restart_policy:\n        condition: any\n';
    expect(updatePublicWasteReplicas(stack, 0)).toContain('      replicas: 0');
    expect(updatePublicWasteReplicas(updatePublicWasteReplicas(stack, 0), 1)).toContain(
      '      replicas: 1'
    );
    expect(() => updatePublicWasteReplicas('services: {}\n', 0)).toThrow('eindeutigen');
    expect(
      updatePublicWasteDatabaseUrl(
        [
          { name: 'PUBLIC_WASTE_DATABASE_URL', value: 'postgres://supabase' },
          { name: 'PUBLIC_WASTE_INSTANCE_ID', value: 'bb-prignitz' },
        ],
        'postgres://tenant-db'
      )
    ).toEqual([
      { name: 'PUBLIC_WASTE_DATABASE_URL', value: 'postgres://tenant-db' },
      { name: 'PUBLIC_WASTE_INSTANCE_ID', value: 'bb-prignitz' },
    ]);
  });

  it('updates only the public host and base URL for the expected tenant', () => {
    const current = [
      { name: 'PUBLIC_WASTE_INSTANCE_ID', value: 'bb-prignitz' },
      { name: 'PUBLIC_WASTE_PUBLIC_HOST', value: 'old.example' },
      { name: 'PUBLIC_WASTE_BASE_URL', value: 'https://old.example' },
      { name: 'PUBLIC_WASTE_DATABASE_URL', value: 'postgres://secret' },
    ];
    expect(updatePublicWasteDomainEnv(current, 'bb-prignitz', 'Prignitz.Example.')).toEqual([
      { name: 'PUBLIC_WASTE_INSTANCE_ID', value: 'bb-prignitz' },
      { name: 'PUBLIC_WASTE_PUBLIC_HOST', value: 'prignitz.example' },
      { name: 'PUBLIC_WASTE_BASE_URL', value: 'https://prignitz.example' },
      { name: 'PUBLIC_WASTE_DATABASE_URL', value: 'postgres://secret' },
    ]);
    expect(() => updatePublicWasteDomainEnv(current, 'other-tenant', 'prignitz.example')).toThrow(
      'stimmt nicht ueberein'
    );
    expect(() =>
      updatePublicWasteDomainEnv(current, 'bb-prignitz', 'https://prignitz.example/path')
    ).toThrow('ungueltig');
  });

  it('adds the explicit Traefik certificate resolver idempotently', () => {
    const stack = [
      'services:',
      '  app:',
      '    deploy:',
      '      labels:',
      "        - 'traefik.http.routers.public-waste.tls=true'",
      '',
    ].join('\n');
    const updated = ensurePublicWasteCertificateResolver(stack);
    expect(updated).toContain(
      "        - 'traefik.http.routers.public-waste.tls.certresolver=default'"
    );
    expect(ensurePublicWasteCertificateResolver(updated)).toBe(updated);
    expect(
      ensurePublicWasteCertificateResolver(
        '      labels:\n        - "traefik.http.routers.public-waste.tls=true"\n'
      )
    ).toContain('        - "traefik.http.routers.public-waste.tls.certresolver=default"');
    expect(() => ensurePublicWasteCertificateResolver('services: {}\n')).toThrow('eindeutiges');
  });

  it('cuts over the remote stack domain while preserving unrelated env values', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ Id: 42, Name: 'web-waste-calendar', EndpointId: 7 }]))
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Env: [
              { name: 'PUBLIC_WASTE_INSTANCE_ID', value: 'bb-prignitz' },
              { name: 'PUBLIC_WASTE_PUBLIC_HOST', value: 'old.example' },
              { name: 'PUBLIC_WASTE_BASE_URL', value: 'https://old.example' },
              { name: 'PUBLIC_WASTE_DATABASE_URL', value: 'postgres://secret' },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            StackFileContent:
              'services:\n  app:\n    image: example\n    deploy:\n      labels:\n        - "traefik.http.routers.public-waste.tls=true"\n',
          })
        )
      )
      .mockResolvedValueOnce(new Response('{}'));

    await expect(
      cutoverPublicWasteStackDomain(
        {
          PUBLIC_WASTE_EXPECTED_INSTANCE_ID: 'bb-prignitz',
          PUBLIC_WASTE_STACK_NAME: 'web-waste-calendar',
          PUBLIC_WASTE_TARGET_HOST: 'prignitz.abfallkalender.pro',
          QUANTUM_API_KEY: 'secret',
          QUANTUM_ENDPOINT_ID: '7',
          QUANTUM_HOST: 'https://portainer.example.invalid',
        },
        { commandExists: vi.fn().mockReturnValue(false), fetch, runCapture: vi.fn() }
      )
    ).resolves.toMatchObject({
      changed: true,
      previousHost: 'old.example',
      targetHost: 'prignitz.abfallkalender.pro',
    });

    const payload = JSON.parse(String(fetch.mock.calls[3]?.[1]?.body));
    expect(payload.Env).toEqual([
      { name: 'PUBLIC_WASTE_INSTANCE_ID', value: 'bb-prignitz' },
      { name: 'PUBLIC_WASTE_PUBLIC_HOST', value: 'prignitz.abfallkalender.pro' },
      { name: 'PUBLIC_WASTE_BASE_URL', value: 'https://prignitz.abfallkalender.pro' },
      { name: 'PUBLIC_WASTE_DATABASE_URL', value: 'postgres://secret' },
    ]);
    expect(payload.StackFileContent).toContain(
      '        - "traefik.http.routers.public-waste.tls.certresolver=default"'
    );
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
              {
                name: 'PUBLIC_WASTE_PUBLIC_HOST',
                value: 'bb-prignitz.abfallkalender.smart-village.app',
              },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            StackFileContent:
              "version: '3.8'\nservices:\n  app:\n    image: ghcr.io/example/public-waste:v1.2.2\n",
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
      StackFileContent:
        "version: '3.8'\nservices:\n  app:\n    image: ghcr.io/example/public-waste:v1.2.2\n",
    });
  });

  it('starts the remote stack with the tenant PostgreSQL URL and one replica', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ Id: 42, Name: 'web-waste-calendar', EndpointId: 7 }]))
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Env: [
              { name: 'PUBLIC_WASTE_DATABASE_URL', value: 'postgres://supabase' },
              { name: 'PUBLIC_WASTE_INSTANCE_ID', value: 'bb-prignitz' },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            StackFileContent: 'services:\n  app:\n    deploy:\n      replicas: 0\n',
          })
        )
      )
      .mockResolvedValueOnce(new Response('{}'));

    await expect(
      setPublicWasteStackMaintenance(
        { mode: 'start', databaseUrl: 'postgres://tenant-db' },
        {
          PUBLIC_WASTE_STACK_NAME: 'web-waste-calendar',
          QUANTUM_API_KEY: 'secret',
          QUANTUM_ENDPOINT_ID: '7',
          QUANTUM_HOST: 'https://portainer.example.invalid',
        },
        { commandExists: vi.fn().mockReturnValue(false), fetch, runCapture: vi.fn() }
      )
    ).resolves.toMatchObject({ mode: 'start', stackId: 42 });

    const payload = JSON.parse(String(fetch.mock.calls[3]?.[1]?.body));
    expect(payload.StackFileContent).toContain('      replicas: 1');
    expect(payload.Env).toEqual([
      { name: 'PUBLIC_WASTE_DATABASE_URL', value: 'postgres://tenant-db' },
      { name: 'PUBLIC_WASTE_INSTANCE_ID', value: 'bb-prignitz' },
    ]);
  });
});
