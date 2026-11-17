import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SvaMainserverOwnershipTransferContent } from '../../types.js';
import { createSvaMainserverService } from '../service.js';

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
const inputFor = (content: SvaMainserverOwnershipTransferContent) => ({
  instanceId: config.instanceId,
  keycloakSubject: 'actor-1',
  content,
  expectedSourceDataProviderId: '201',
  targetDataProviderId: '202',
});
const setup = (graphResponse?: Response) => {
  const loadInstanceConfig = vi.fn().mockResolvedValue(config);
  const readCredentials = vi
    .fn()
    .mockResolvedValue({ apiKey: 'test-key', apiSecret: 'test-secret' });
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
    const { fetchImpl, service } = setup(
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
