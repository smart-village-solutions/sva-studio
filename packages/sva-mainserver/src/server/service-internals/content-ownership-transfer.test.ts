import { describe, expect, it, vi } from 'vitest';

import type { SvaMainserverOwnershipTransferContent } from '../../types.js';
import { createSvaMainserverService } from '../service.js';

const contents = [
  { type: 'news', id: '101', resourceType: 'NEWS_ITEM' },
  { type: 'event', id: '102', resourceType: 'EVENT_RECORD' },
  { type: 'poi', id: '103', resourceType: 'POINT_OF_INTEREST' },
  { type: 'generic-item', id: '104', resourceType: 'GENERIC_ITEM' },
] as const satisfies readonly (SvaMainserverOwnershipTransferContent & { resourceType: string })[];

const config = {
  instanceId: 'de-testkommune',
  providerKey: 'sva_mainserver' as const,
  graphqlBaseUrl: 'https://mainserver.example.test/graphql',
  oauthTokenUrl: 'https://mainserver.example.test/oauth/token',
  enabled: true,
};
const actorCredentialFingerprint = 'a'.repeat(64);
const inputFor = (content: SvaMainserverOwnershipTransferContent) => ({
  instanceId: config.instanceId,
  keycloakSubject: 'actor-1',
  actingPrincipalType: 'user' as const,
  credentialFingerprint: actorCredentialFingerprint,
  content,
  expectedSourceDataProviderId: '201',
  targetDataProviderId: '202',
});
const setup = (graphResponse?: Response) => {
  const loadInstanceConfig = vi.fn().mockResolvedValue(config);
  const readCredentials = vi.fn().mockResolvedValue({
    apiKey: 'actor-key',
    apiSecret: 'actor-secret',
    credentialFingerprint: actorCredentialFingerprint,
  });
  const fetchImpl = vi.fn<typeof fetch>();
  if (graphResponse) {
    fetchImpl
      .mockResolvedValueOnce(Response.json({ access_token: 'test-access-token', expires_in: 300 }))
      .mockResolvedValueOnce(graphResponse);
  }
  const service = createSvaMainserverService({ loadInstanceConfig, readCredentials, fetchImpl });
  return { loadInstanceConfig, readCredentials, fetchImpl, service };
};

describe('Mainserver ownership transfer', () => {
  it.each(contents)('uses only the ownership mutation for $type', async (content) => {
    const { fetchImpl, loadInstanceConfig, readCredentials, service } = setup(
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
    expect(loadInstanceConfig).toHaveBeenCalledWith(config.instanceId);
    expect(readCredentials).toHaveBeenCalledTimes(1);
    expect(readCredentials).toHaveBeenCalledWith({
      instanceId: config.instanceId,
      keycloakSubject: 'actor-1',
      activeOrganizationId: undefined,
      actingPrincipalType: 'user',
    });
    const [tokenUrl, tokenRequest] = fetchImpl.mock.calls[0] ?? [];
    expect(tokenUrl).toBe(config.oauthTokenUrl);
    expect(new URLSearchParams(String(tokenRequest?.body)).get('client_id')).toBe('actor-key');
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

  it('uses the credentials of the selected organization principal', async () => {
    const { service, fetchImpl, readCredentials } = setup(
      Response.json({
        data: {
          transferContentOwnership: {
            resourceType: 'NEWS_ITEM',
            resourceId: '101',
            dataProviderId: '202',
          },
        },
      })
    );

    const organizationCredentialFingerprint = 'b'.repeat(64);
    readCredentials.mockResolvedValueOnce({
      apiKey: 'org-key',
      apiSecret: 'org-secret',
      credentialFingerprint: organizationCredentialFingerprint,
    });

    await service.transferContentOwnership({
      ...inputFor(contents[0]),
      activeOrganizationId: 'actor-org',
      actingPrincipalType: 'organization',
      credentialFingerprint: organizationCredentialFingerprint,
    });

    expect(readCredentials).toHaveBeenCalledExactlyOnceWith({
      instanceId: config.instanceId,
      keycloakSubject: 'actor-1',
      activeOrganizationId: 'actor-org',
      actingPrincipalType: 'organization',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [, tokenRequest] = fetchImpl.mock.calls[0] ?? [];
    expect(new URLSearchParams(String(tokenRequest?.body)).get('client_id')).toBe('org-key');
  });

  it('does not send a transfer when instance configuration is unavailable', async () => {
    const { service, loadInstanceConfig, readCredentials, fetchImpl } = setup();
    loadInstanceConfig.mockRejectedValueOnce(new Error('Configuration unavailable'));

    await expect(service.transferContentOwnership(inputFor(contents[0]))).rejects.toMatchObject({
      code: 'content_transfer_write_unavailable',
    });
    expect(readCredentials).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not send a transfer when the acting principal has no credentials', async () => {
    const { service, readCredentials, fetchImpl } = setup();
    readCredentials.mockResolvedValueOnce(null);

    await expect(service.transferContentOwnership(inputFor(contents[0]))).rejects.toMatchObject({
      code: 'content_transfer_write_unavailable',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not send a transfer after the acting credential context changes', async () => {
    const { service, fetchImpl } = setup();

    await expect(
      service.transferContentOwnership({
        ...inputFor(contents[0]),
        credentialFingerprint: 'c'.repeat(64),
      })
    ).rejects.toMatchObject({ code: 'content_transfer_write_unavailable' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports a failed token request before sending a transfer mutation', async () => {
    const { service, fetchImpl } = setup();
    fetchImpl.mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(service.transferContentOwnership(inputFor(contents[0]))).rejects.toMatchObject({
      code: 'content_transfer_write_unavailable',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a success payload for a different owner', async () => {
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
    const { service, fetchImpl } = setup(new Response(null, { status: 503 }));
    await expect(service.transferContentOwnership(inputFor(contents[0]))).rejects.toMatchObject({
      code: 'network_error',
      statusCode: 503,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
