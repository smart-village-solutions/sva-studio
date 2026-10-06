import type { PluginServerExecutionHandler, PluginServerHandlerModuleFactory } from '@sva/plugin-sdk';
import type { Pool } from 'pg';
import { ZodError } from 'zod';

import { ssfSupportedLanguagesCatalogSchema, ssfSystemContentV2InputSchema, ssfTenantContentV2InputSchema } from '../content-v2-admin-contracts.js';
import {
  readSsfSystemContentV2, readSsfTenantContentV2,
  replaceSsfSystemContentV2, writeSsfTenantContentV2,
  type SsfSystemContentV2, type SsfTenantContentV2,
} from '../content-v2-repository.js';
import { jsonResponse, readCorrelationId } from './responses.js';

export type SsfAdminV2Dependencies = Readonly<{
  readSystemV2?: () => Promise<SsfSystemContentV2>;
  writeSystemV2?: (input: SsfSystemContentV2) => Promise<void>;
  readTenantV2?: (instanceId: string) => Promise<SsfTenantContentV2>;
  writeTenantV2?: (instanceId: string, input: Record<string, unknown>) => Promise<unknown>;
  readSupportedLanguages?: () => Promise<unknown>;
}>;

const withSupportedLanguages = async <T extends object>(
  value: T, read: SsfAdminV2Dependencies['readSupportedLanguages']
): Promise<T & { supportedLanguages: unknown | null }> => {
  if (!read) return { ...value, supportedLanguages: null };
  try {
    const catalog = ssfSupportedLanguagesCatalogSchema.safeParse(await read());
    return { ...value, supportedLanguages: catalog.success ? catalog.data : null };
  } catch {
    return { ...value, supportedLanguages: null };
  }
};

const invalidInput = (error: unknown): boolean => error instanceof ZodError ||
  (error instanceof Error && error.message.startsWith('ssf_v2_'));

const readSystem = (dependencies: SsfAdminV2Dependencies): PluginServerExecutionHandler => async (context) => {
  const correlationId = readCorrelationId(context.request);
  if (context.scope !== 'platform') return jsonResponse(403, { error: 'forbidden' }, correlationId);
  if (!dependencies.readSystemV2) return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
  try {
    return jsonResponse(200, await withSupportedLanguages(await dependencies.readSystemV2(), dependencies.readSupportedLanguages), correlationId);
  } catch {
    return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
  }
};

const writeSystem = (dependencies: SsfAdminV2Dependencies): PluginServerExecutionHandler => async (context) => {
  const correlationId = readCorrelationId(context.request);
  if (context.scope !== 'platform') return jsonResponse(403, { error: 'forbidden' }, correlationId);
  const parsed = ssfSystemContentV2InputSchema.safeParse(await context.request.json().catch(() => null));
  if (!parsed.success) return jsonResponse(422, { error: 'invalid_configuration' }, correlationId);
  if (!dependencies.writeSystemV2 || !dependencies.readSystemV2) return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
  try {
    await dependencies.writeSystemV2(parsed.data);
    return jsonResponse(200, await withSupportedLanguages(await dependencies.readSystemV2(), dependencies.readSupportedLanguages), correlationId);
  } catch (error) {
    const invalid = invalidInput(error);
    return jsonResponse(invalid ? 422 : 503,
      { error: invalid ? 'invalid_configuration' : 'configuration_unavailable' }, correlationId);
  }
};

const readTenant = (dependencies: SsfAdminV2Dependencies): PluginServerExecutionHandler => async (context) => {
  const correlationId = readCorrelationId(context.request);
  if (context.scope !== 'tenant' || !context.actor.instanceId) return jsonResponse(403, { error: 'forbidden' }, correlationId);
  if (!dependencies.readTenantV2) return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
  try {
    return jsonResponse(200, await withSupportedLanguages(await dependencies.readTenantV2(context.actor.instanceId), dependencies.readSupportedLanguages), correlationId);
  } catch {
    return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
  }
};

const writeTenant = (dependencies: SsfAdminV2Dependencies): PluginServerExecutionHandler => async (context) => {
  const correlationId = readCorrelationId(context.request);
  if (context.scope !== 'tenant' || !context.actor.instanceId) return jsonResponse(403, { error: 'forbidden' }, correlationId);
  const parsed = ssfTenantContentV2InputSchema.safeParse(await context.request.json().catch(() => null));
  if (!parsed.success) return jsonResponse(422, { error: 'invalid_configuration' }, correlationId);
  if (!dependencies.writeTenantV2 || !dependencies.readTenantV2) return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
  try {
    await dependencies.writeTenantV2(context.actor.instanceId, parsed.data);
    return jsonResponse(200, await withSupportedLanguages(await dependencies.readTenantV2(context.actor.instanceId), dependencies.readSupportedLanguages), correlationId);
  } catch (error) {
    const invalid = invalidInput(error);
    return jsonResponse(invalid ? 422 : 503,
      { error: invalid ? 'invalid_configuration' : 'configuration_unavailable' }, correlationId);
  }
};

export const createSsfAdminV2Handlers = (
  dependencies: SsfAdminV2Dependencies
): ReturnType<PluginServerHandlerModuleFactory> => ({
  'ssf.system-content-v2.read': readSystem(dependencies),
  'ssf.system-content-v2.write': writeSystem(dependencies),
  'ssf.tenant-content-v2.read': readTenant(dependencies),
  'ssf.tenant-content-v2.write': writeTenant(dependencies),
});

export const createDefaultSsfAdminV2Dependencies = (
  pool: Pool | null, rootPool: Pool | null
): SsfAdminV2Dependencies => {
  const unavailable = async (): Promise<never> => { throw new Error('ssf_database_unavailable'); };
  return {
    readSystemV2: pool ? () => readSsfSystemContentV2(pool) : unavailable,
    writeSystemV2: rootPool ? (input) => replaceSsfSystemContentV2(rootPool, input) : unavailable,
    readTenantV2: pool ? (instanceId) => readSsfTenantContentV2(pool, instanceId) : unavailable,
    writeTenantV2: pool ? (instanceId, input) => writeSsfTenantContentV2(pool, instanceId, input) : unavailable,
    readSupportedLanguages: async () => {
      const response = await fetch('https://api.dialog.kassel.de/api/languages/supported', {
        signal: AbortSignal.timeout(5_000),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error('ssf_supported_languages_unavailable');
      return response.json();
    },
  };
};
