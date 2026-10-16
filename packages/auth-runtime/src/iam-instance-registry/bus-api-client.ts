/** Server-only adapter for the published Bus 0.7.3 key administration contract. */
import { z } from 'zod';

export class BusApiError extends Error {
  constructor(
    readonly code:
      'bus_not_configured' | 'bus_unavailable' | 'bus_outcome_unknown' | 'bus_key_not_found',
    readonly status: number
  ) {
    super(code);
  }
}

const metadataSchema = z.object({
  keyId: z.string().min(1).max(256),
  owner: z.string(),
  label: z.string().optional(),
  contact: z.string().optional(),
  createdBy: z.string().optional(),
  createdAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
  revoked: z.boolean(),
  revokedAt: z.iso.datetime({ offset: true }).optional(),
});

export type BusKeyMetadata = z.output<typeof metadataSchema>;
export type BusCreatedKey = { keyId: string; apiKey: string };

const readConfiguration = () => {
  try {
    const url = new URL(process.env.BUS_API_BASE_URL ?? '');
    const token = process.env.BUS_API_ADMIN_TOKEN?.trim();
    const local =
      ['local-builder', 'local-keycloak'].includes(process.env.SVA_RUNTIME_PROFILE ?? '') &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      !token ||
      /[\r\n]/u.test(token) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    ) {
      throw new Error();
    }
    return { origin: url.origin, token };
  } catch {
    throw new BusApiError('bus_not_configured', 503);
  }
};

export const createBusApiClient = (actorId: string, requestId: string) => {
  if (!actorId.trim() || actorId.length > 256 || /[\p{Cc},]/u.test(actorId)) {
    throw new BusApiError('bus_unavailable', 502);
  }
  const { origin, token } = readConfiguration();
  const call = async (path: string, method: 'GET' | 'POST', body?: unknown): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(new URL(path, origin), {
        method,
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          'x-admin-actor-id': actorId,
          'x-request-id': requestId,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        throw new BusApiError(
          response.status === 404
            ? 'bus_key_not_found'
            : method === 'POST' && response.status >= 500
              ? 'bus_outcome_unknown'
              : 'bus_unavailable',
          response.status === 404 ? 404 : 502
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof BusApiError) throw error;
      throw new BusApiError(method === 'POST' ? 'bus_outcome_unknown' : 'bus_unavailable', 502);
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    list: async (instanceId: string): Promise<BusKeyMetadata[]> => {
      const result = z
        .object({ items: z.array(z.unknown()) })
        .safeParse(
          await call(`/internal/api-keys?${new URLSearchParams({ label: instanceId })}`, 'GET')
        );
      if (!result.success) throw new BusApiError('bus_unavailable', 502);
      const matching = result.data.items.filter(
        (item) =>
          typeof item === 'object' && item !== null && 'label' in item && item.label === instanceId
      );
      const parsed = z.array(metadataSchema).safeParse(matching);
      if (!parsed.success) throw new BusApiError('bus_unavailable', 502);
      return parsed.data;
    },
    create: async (input: {
      owner: string;
      label: string;
      contact: string;
      createdBy: string;
      expiresAt: string;
    }): Promise<BusCreatedKey> => {
      const parsed = z
        .object({ keyId: z.string().min(1).max(256), apiKey: z.string().min(1) })
        .safeParse(await call('/internal/api-keys', 'POST', input));
      if (!parsed.success) throw new BusApiError('bus_outcome_unknown', 502);
      return parsed.data;
    },
    mutate: async (
      instanceId: string,
      keyId: string,
      action: 'revoke' | 'activate'
    ): Promise<void> => {
      if (
        !keyId ||
        keyId === '.' ||
        keyId === '..' ||
        keyId.length > 256 ||
        /[\p{Cc}]/u.test(keyId)
      ) {
        throw new BusApiError('bus_key_not_found', 404);
      }
      const result = await call(
        `/internal/api-keys/${encodeURIComponent(keyId)}/${action}?${new URLSearchParams({ label: instanceId })}`,
        'POST'
      );
      if (!z.object({ ok: z.literal(true) }).safeParse(result).success) {
        throw new BusApiError('bus_outcome_unknown', 502);
      }
    },
  };
};
