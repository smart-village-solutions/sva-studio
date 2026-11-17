import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveMainserverOwnershipTarget } from '@sva/auth-runtime/server';
import type { SvaMainserverOwnershipTransferContent } from '../../types.js';
import { createSvaMainserverService } from '../service.js';

vi.mock('@sva/auth-runtime/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/auth-runtime/server')>()),
  resolveMainserverOwnershipTarget: vi.fn(),
}));

const contents = [
  { type: 'news', id: '101', resourceType: 'NEWS_ITEM' },
  { type: 'event', id: '102', resourceType: 'EVENT_RECORD' },
  { type: 'poi', id: '103', resourceType: 'POINT_OF_INTEREST' },
  { type: 'generic-item', id: '104', resourceType: 'GENERIC_ITEM' },
] as const satisfies readonly (SvaMainserverOwnershipTransferContent & { resourceType: string })[];

const config = {
  instanceId: 'de-studio-sandbox',
  providerKey: 'sva_mainserver' as const,
  graphqlBaseUrl: 'https://de-studio-sandbox.staging-server.smart-village.app/graphql',
  oauthTokenUrl: 'https://de-studio-sandbox.staging-server.smart-village.app/oauth/token',
  enabled: true,
};
const writerOrganizationId = '7418fe43-8bbe-430b-95ef-2214c7639b17';
const writerPrincipal = { type: 'organization', id: writerOrganizationId } as const;
const writerConnection = {
  instanceId: config.instanceId,
  keycloakSubject: 'actor-1',
  activeOrganizationId: writerOrganizationId,
  actingPrincipalType: 'organization',
  credentialFingerprint: 'f'.repeat(64),
} as const;
const inputFor = (content: SvaMainserverOwnershipTransferContent) => ({
  instanceId: config.instanceId,
  keycloakSubject: 'actor-1',
  actingPrincipalType: 'user' as const,
  credentialFingerprint: 'a'.repeat(64),
  content,
  expectedSourceDataProviderId: '201',
  targetDataProviderId: '202',
});
const setup = (graphResponse?: Response) => {
  vi.stubEnv('SVA_MAINSERVER_OWNERSHIP_TRANSFER_ORGANIZATION_ID', writerOrganizationId);
  vi.mocked(resolveMainserverOwnershipTarget).mockReset().mockResolvedValue({
    ok: true,
    target: {
      principal: writerPrincipal,
      dataProviderId: '999',
      bindingId: 'writer-binding',
      bindingVersion: 'writer-binding-version',
      connection: writerConnection,
    },
  });
  const loadInstanceConfig = vi.fn().mockResolvedValue(config);
  const readCredentials = vi
    .fn()
    .mockImplementation(async ({ activeOrganizationId }: { activeOrganizationId?: string }) =>
      activeOrganizationId === writerOrganizationId
        ? {
            apiKey: 'writer-key',
            apiSecret: 'writer-secret',
            credentialFingerprint: writerConnection.credentialFingerprint,
          }
        : { apiKey: 'actor-key', apiSecret: 'actor-secret' }
    );
  const fetchImpl = vi.fn<typeof fetch>();
  if (graphResponse) {
    fetchImpl
      .mockResolvedValueOnce(Response.json({ access_token: 'test-access-token', expires_in: 300 }))
      .mockResolvedValueOnce(graphResponse);
  }
  const service = createSvaMainserverService({ loadInstanceConfig, readCredentials, fetchImpl });
  return { loadInstanceConfig, readCredentials, fetchImpl, service };
};

afterEach(() => vi.unstubAllEnvs());

describe('Mainserver ownership transfer protection', () => {
  it.each(contents)('refuses $type transfers in production before any I/O', async (content) => {
    vi.stubEnv('SVA_DEPLOYMENT_ENVIRONMENT', 'production');
    const { loadInstanceConfig, readCredentials, fetchImpl, service } = setup();

    await expect(service.transferContentOwnership(inputFor(content))).rejects.toMatchObject({
      code: 'content_transfer_temporarily_disabled',
      statusCode: 409,
    });
    expect(loadInstanceConfig).not.toHaveBeenCalled();
    expect(readCredentials).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(['development', undefined])('keeps the transfer disabled in %s', async (environment) => {
    vi.stubEnv('SVA_DEPLOYMENT_ENVIRONMENT', environment);
    const { loadInstanceConfig, service } = setup();
    await expect(service.transferContentOwnership(inputFor(contents[0]))).rejects.toMatchObject({
      code: 'content_transfer_temporarily_disabled',
    });
    expect(loadInstanceConfig).not.toHaveBeenCalled();
  });

  it('blocks a different Studio tenant before loading the sandbox endpoints', async () => {
    vi.stubEnv('SVA_DEPLOYMENT_ENVIRONMENT', 'staging');
    const { loadInstanceConfig, readCredentials, fetchImpl, service } = setup();

    await expect(
      service.transferContentOwnership({
        ...inputFor(contents[0]),
        instanceId: 'other-tenant',
      })
    ).rejects.toMatchObject({ code: 'content_transfer_temporarily_disabled' });
    expect(loadInstanceConfig).not.toHaveBeenCalled();
    expect(readCredentials).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(['graphqlBaseUrl', 'oauthTokenUrl'] as const)(
    'blocks a non-sandbox %s before credential lookup',
    async (key) => {
      vi.stubEnv('SVA_DEPLOYMENT_ENVIRONMENT', 'staging');
      const { loadInstanceConfig, readCredentials, fetchImpl, service } = setup();
      loadInstanceConfig.mockResolvedValue({ ...config, [key]: 'https://production.example/' });
      await expect(service.transferContentOwnership(inputFor(contents[0]))).rejects.toMatchObject({
        code: 'content_transfer_temporarily_disabled',
      });
      expect(readCredentials).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  );

  it.each(contents)('uses only the ownership mutation for $type', async (content) => {
    vi.stubEnv('SVA_DEPLOYMENT_ENVIRONMENT', 'staging');
    const { fetchImpl, readCredentials, service } = setup(
      Response.json({
        data: {
          transferContentOwnership: {
            resourceType: content.resourceType,
            resourceId: content.id,
            dataProviderId: '202',
          },
        },
      })
    );

    await expect(service.transferContentOwnership(inputFor(content))).resolves.toEqual({
      contentType: content.type,
      contentId: content.id,
      sourceDataProviderId: '201',
      targetDataProviderId: '202',
    });
    expect(resolveMainserverOwnershipTarget).toHaveBeenCalledWith({
      instanceId: config.instanceId,
      actorKeycloakSubject: 'actor-1',
      principal: writerPrincipal,
    });
    expect(readCredentials).toHaveBeenCalledTimes(1);
    expect(readCredentials).toHaveBeenCalledWith({
      instanceId: config.instanceId,
      keycloakSubject: 'actor-1',
      activeOrganizationId: writerOrganizationId,
      actingPrincipalType: 'organization',
    });
    const [tokenUrl, tokenRequest] = fetchImpl.mock.calls[0] ?? [];
    expect(tokenUrl).toBe(config.oauthTokenUrl);
    expect(new URLSearchParams(String(tokenRequest?.body)).get('client_id')).toBe('writer-key');
    const [url, request] = fetchImpl.mock.calls[1] ?? [];
    expect(url).toBe(config.graphqlBaseUrl);
    expect(JSON.parse(String(request?.body))).toMatchObject({
      operationName: 'SvaMainserverTransferContentOwnership',
      query: expect.stringContaining('transferContentOwnership('),
      variables: {
        resourceType: content.resourceType,
        resourceId: content.id,
        expectedSourceDataProviderId: '201',
        targetDataProviderId: '202',
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each(['missing', 'inactive'] as const)(
    'never falls back to the acting user when the writer is %s',
    async (state) => {
      vi.stubEnv('SVA_DEPLOYMENT_ENVIRONMENT', 'staging');
      const { service, readCredentials, fetchImpl } = setup();
      if (state === 'missing') {
        vi.stubEnv('SVA_MAINSERVER_OWNERSHIP_TRANSFER_ORGANIZATION_ID', undefined);
      } else {
        vi.mocked(resolveMainserverOwnershipTarget).mockResolvedValue({
          ok: false,
          code: 'content_transfer_target_invalid',
        });
      }

      await expect(service.transferContentOwnership(inputFor(contents[0]))).rejects.toMatchObject({
        code: 'content_transfer_write_unavailable',
      });
      expect(readCredentials).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  );

  it('reports a failed token request before sending a transfer mutation', async () => {
    vi.stubEnv('SVA_DEPLOYMENT_ENVIRONMENT', 'staging');
    const { service, fetchImpl } = setup();
    fetchImpl.mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(service.transferContentOwnership(inputFor(contents[0]))).rejects.toMatchObject({
      code: 'content_transfer_write_unavailable',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a success payload for a different owner', async () => {
    vi.stubEnv('SVA_DEPLOYMENT_ENVIRONMENT', 'staging');
    const { service } = setup(
      Response.json({
        data: {
          transferContentOwnership: {
            resourceType: 'NEWS_ITEM',
            resourceId: '101',
            dataProviderId: '203',
          },
        },
      })
    );
    await expect(service.transferContentOwnership(inputFor(contents[0]))).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('maps a known Mainserver rejection without retry', async () => {
    vi.stubEnv('SVA_DEPLOYMENT_ENVIRONMENT', 'staging');
    const { service, fetchImpl } = setup(
      Response.json({
        errors: [{ message: 'Owner changed', extensions: { code: 'source_provider_mismatch' } }],
      })
    );
    await expect(service.transferContentOwnership(inputFor(contents[0]))).rejects.toMatchObject({
      code: 'content_transfer_provider_rejected',
      statusCode: 409,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('leaves an unavailable response to reconciliation without retry', async () => {
    vi.stubEnv('SVA_DEPLOYMENT_ENVIRONMENT', 'staging');
    const { service, fetchImpl } = setup(new Response(null, { status: 503 }));
    await expect(service.transferContentOwnership(inputFor(contents[0]))).rejects.toMatchObject({
      code: 'network_error',
      statusCode: 503,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
