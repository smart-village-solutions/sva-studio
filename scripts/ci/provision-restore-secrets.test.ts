import { afterEach, describe, expect, it, vi } from 'vitest';

import { provisionRestoreSecrets } from './provision-restore-secrets.ts';

const input = {
  apiKey: 'api-key',
  endpointId: '64',
  environment: 'staging' as const,
  portainerHost: 'https://portainer.example.test/',
  postgresPassword: 'postgres-password',
  signingKey: 'signing-key',
};

afterEach(() => vi.unstubAllGlobals());

describe('provisionRestoreSecrets', () => {
  it('creates only missing environment-bound secrets', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ Spec: { Name: 'restore_staging_signing_key' } }]))
      )
      .mockResolvedValueOnce(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(provisionRestoreSecrets(input)).resolves.toEqual({
      created: ['restore_staging_postgres_password'],
      preserved: ['restore_staging_signing_key'],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://portainer.example.test/api/endpoints/64/docker/secrets/create'
    );
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      Data: string;
      Name: string;
    };
    expect(body).toEqual({
      Data: Buffer.from('postgres-password').toString('base64'),
      Name: 'restore_staging_postgres_password',
    });
  });

  it('does not overwrite existing secrets', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            { Spec: { Name: 'restore_staging_postgres_password' } },
            { Spec: { Name: 'restore_staging_signing_key' } },
          ])
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(provisionRestoreSecrets(input)).resolves.toEqual({
      created: [],
      preserved: ['restore_staging_postgres_password', 'restore_staging_signing_key'],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports only the API path and status on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('sensitive body', { status: 403 }))
    );

    await expect(provisionRestoreSecrets(input)).rejects.toThrow(
      'Portainer-API secrets antwortet mit 403.'
    );
  });
});
