import type { PluginServerExecutionHandler } from '@sva/plugin-sdk';

import { readSsfInstallationContentV2, readSsfTenantContentV2 } from '../content-v2-repository.js';
import { resolveSsfInstallationContentV2, resolveSsfRuntimeContentV2 } from '../content-v2.js';
import type { SsfRuntimeConfigurationV2 } from '../content-v2-contracts.js';
import { resolveSsfDatabasePool } from '../database.js';
import { jsonResponse, readCorrelationId, unavailableResponse } from './responses.js';

export type SsfRuntimeV2Handler = (tenant: {
  id: string; displayName: string; timeZone: string;
}) => Promise<SsfRuntimeConfigurationV2>;

export const createSsfRuntimeV2ServerHandler = (
  handler?: SsfRuntimeV2Handler
): PluginServerExecutionHandler => async (context) => {
  const correlationId = readCorrelationId(context.request);
  if (context.scope !== 'service' || !handler) return unavailableResponse(correlationId, '2.0');
  try {
    const configuration = await handler({
      id: context.tenant.instanceId,
      displayName: context.tenant.displayName,
      timeZone: context.tenant.timeZone,
    });
    return jsonResponse(200, configuration, correlationId);
  } catch {
    return unavailableResponse(correlationId, '2.0');
  }
};

export const defaultSsfRuntimeV2Handler: SsfRuntimeV2Handler = async (tenant) => {
  const pool = resolveSsfDatabasePool();
  if (!pool) throw new Error('ssf_database_unavailable');
  const content = await readSsfTenantContentV2(pool, tenant.id);
  return resolveSsfRuntimeContentV2({ tenant, template: content.runtimeTemplate, overrides: content.overrides });
};

export const readResolvedSsfInstallationContentV2 = async () => {
  const pool = resolveSsfDatabasePool();
  if (!pool) throw new Error('ssf_database_unavailable');
  return resolveSsfInstallationContentV2(await readSsfInstallationContentV2(pool));
};
