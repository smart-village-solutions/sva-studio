import { loadInstanceIntegrationRecord } from '@sva/data/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';

import type { SvaMainserverInstanceConfig } from '../types';
import { SvaMainserverError } from './errors';
import { normalizeSvaMainserverUpstreamUrl } from './upstream-url-validation';

const logger = createSdkLogger({ component: 'sva-mainserver-config', level: 'debug' });

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

const validateUpstreamUrl = async (
  instanceId: string,
  fieldName: 'graphql_base_url' | 'oauth_token_url',
  value: string
): Promise<string> => {
  try {
    return await normalizeSvaMainserverUpstreamUrl(value, fieldName, 500);
  } catch (error) {
    logger.warn('Invalid SVA Mainserver upstream URL configuration detected', {
      ...buildLogContext(instanceId, {
        operation: 'load_instance_config',
        field_name: fieldName,
        error_code: 'invalid_config',
      }),
    });
    throw error;
  }
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
      graphqlBaseUrl: await validateUpstreamUrl(instanceId, 'graphql_base_url', record.graphqlBaseUrl),
      oauthTokenUrl: await validateUpstreamUrl(instanceId, 'oauth_token_url', record.oauthTokenUrl),
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
