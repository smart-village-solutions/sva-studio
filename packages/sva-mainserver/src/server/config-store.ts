import { isIP } from 'node:net';

import { loadInstanceIntegrationRecord } from '@sva/data/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';
import { z } from 'zod';

import type { SvaMainserverInstanceConfig } from '../types';
import { SvaMainserverError } from './errors';

const logger = createSdkLogger({ component: 'sva-mainserver-config', level: 'debug' });

const localhostHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const isPrivateOrLocalHost = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  if (localhostHosts.has(normalized) || normalized.endsWith('.local')) {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    const octets = normalized.split('.').map((segment) => Number.parseInt(segment, 10));
    if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) {
      return true;
    }

    const [a, b] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  if (ipVersion === 6) {
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }

  return false;
};

const upstreamUrlSchema = z.string().url().transform((value) => new URL(value)).superRefine((value, context) => {
  if (value.username || value.password) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Credentials in Upstream-URLs sind nicht erlaubt.',
    });
  }

  if (value.hash) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'URL-Fragmente sind für Upstream-Endpunkte nicht erlaubt.',
    });
  }

  if (value.protocol !== 'https:') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Erlaubt sind ausschließlich https-URLs für Upstream-Endpunkte.',
    });
  }

  if (isPrivateOrLocalHost(value.hostname)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Lokale oder private Upstream-Hosts sind nicht erlaubt.',
    });
  }
});

const buildLogContext = (instanceId: string, extra: Record<string, unknown> = {}) => {
  const context = getWorkspaceContext();

  return {
    workspace_id: instanceId,
    instance_id: instanceId,
    request_id: context.requestId,
    trace_id: context.traceId,
    ...extra,
  };
};

const validateUpstreamUrl = (instanceId: string, fieldName: 'graphql_base_url' | 'oauth_token_url', value: string): string => {
  const parsed = upstreamUrlSchema.safeParse(value);
  if (!parsed.success) {
    logger.warn('Invalid SVA Mainserver upstream URL configuration detected', {
      ...buildLogContext(instanceId, {
        operation: 'load_instance_config',
        field_name: fieldName,
        error_code: 'invalid_config',
      }),
    });
    throw new SvaMainserverError({
      code: 'invalid_config',
      message: `Die konfigurierte Upstream-URL ${fieldName} ist ungültig.`,
      statusCode: 500,
    });
  }

  return parsed.data.toString();
};

export const loadSvaMainserverInstanceConfig = async (
  instanceId: string
): Promise<SvaMainserverInstanceConfig> => {
  logger.debug('Loading SVA Mainserver instance config', {
    ...buildLogContext(instanceId, {
      operation: 'load_instance_config',
    }),
  });

  try {
    const record = await loadInstanceIntegrationRecord(instanceId, 'sva_mainserver');
    if (!record) {
      throw new SvaMainserverError({
        code: 'config_not_found',
        message: `Keine SVA-Mainserver-Konfiguration für Instanz ${instanceId} gefunden.`,
        statusCode: 404,
      });
    }

    if (!record.enabled) {
      throw new SvaMainserverError({
        code: 'integration_disabled',
        message: `Die SVA-Mainserver-Integration ist für Instanz ${instanceId} deaktiviert.`,
        statusCode: 409,
      });
    }

    const config = {
      instanceId: record.instanceId,
      providerKey: record.providerKey,
      graphqlBaseUrl: validateUpstreamUrl(instanceId, 'graphql_base_url', record.graphqlBaseUrl),
      oauthTokenUrl: validateUpstreamUrl(instanceId, 'oauth_token_url', record.oauthTokenUrl),
      enabled: record.enabled,
      lastVerifiedAt: record.lastVerifiedAt,
      lastVerifiedStatus: record.lastVerifiedStatus,
    } satisfies SvaMainserverInstanceConfig;

    logger.info('SVA Mainserver instance config loaded', {
      ...buildLogContext(instanceId, {
        operation: 'load_instance_config',
      }),
    });

    return config;
  } catch (error) {
    if (error instanceof SvaMainserverError) {
      logger.warn('SVA Mainserver instance config load failed', {
        ...buildLogContext(instanceId, {
          operation: 'load_instance_config',
          error_code: error.code,
          error_message: error.message,
        }),
      });
      throw error;
    }

    logger.error('SVA Mainserver instance config load hit a database error', {
      ...buildLogContext(instanceId, {
        operation: 'load_instance_config',
        error_code: 'database_unavailable',
        error_message: error instanceof Error ? error.message : String(error),
      }),
    });

    throw new SvaMainserverError({
      code: 'database_unavailable',
      message: 'Die Instanzkonfiguration des SVA-Mainservers konnte nicht geladen werden.',
      statusCode: 503,
    });
  }
};
