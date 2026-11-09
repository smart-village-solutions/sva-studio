import type { createCatalogDelivery } from '@sva/core';
import { loadDefaultExternalInterfaceRecord } from '@sva/data-repositories/server';
import { z } from 'zod';
import { readBoundedJson } from './app-translations-binding-response.js';
import { readEffectiveSvaMainserverCredentialsWithStatus } from './mainserver-effective-credentials.js';
import { normalizePublicUpstreamUrl } from './upstream-url-validation.js';

export const publishAppTextCatalog = async (
  catalog: Awaited<ReturnType<typeof createCatalogDelivery>>
): Promise<void> => {
  const { instanceId, organizationId } = catalog;
  const connection = await loadDefaultExternalInterfaceRecord(instanceId, 'sva_mainserver');
  if (!connection?.enabled) throw new Error('catalog_unavailable');
  const { graphqlBaseUrl, oauthTokenUrl } = connection.publicConfig;
  const graphql =
    typeof graphqlBaseUrl === 'string' && (await normalizePublicUpstreamUrl(graphqlBaseUrl));
  const tokenUrl =
    typeof oauthTokenUrl === 'string' && (await normalizePublicUpstreamUrl(oauthTokenUrl));
  if (!graphql || !tokenUrl || new URL(graphql).origin !== new URL(tokenUrl).origin)
    throw new Error('catalog_unavailable');

  const access = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId,
    activeOrganizationId: organizationId,
    keycloakSubject: '',
    actingPrincipalType: 'organization',
  });
  if (access.status !== 'ok' || access.source !== 'organization')
    throw new Error('catalog_unavailable');

  const body = JSON.stringify({
    query:
      'mutation PublishAppTextCatalog($catalog: JSON!) { publishAppTextCatalog(catalog: $catalog) { revision } }',
    variables: { catalog },
  });
  if (Buffer.byteLength(body) > 4 * 1024 * 1024) throw new Error('catalog_unavailable');
  const signal = AbortSignal.timeout(15000);
  const token = z
    .object({
      access_token: z
        .string()
        .max(4096)
        .regex(/^[A-Za-z0-9._~+/-]+=*$/),
    })
    .parse(
      await readBoundedJson(
        await fetch(tokenUrl, {
          method: 'POST',
          redirect: 'error',
          signal,
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: access.credentials.apiKey,
            client_secret: access.credentials.apiSecret,
          }),
        })
      )
    );
  const result = z
    .object({
      data: z.object({
        publishAppTextCatalog: z.object({ revision: z.literal(catalog.revision) }),
      }),
    })
    .strict()
    .safeParse(
      await readBoundedJson(
        await fetch(graphql, {
          method: 'POST',
          redirect: 'error',
          signal,
          body,
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
          },
        })
      )
    );
  if (!result.success) throw new Error('catalog_unavailable');
};
