import {
  SSF_CONTENT_REVISION_HEADER,
  SSF_EXPECTED_CONTENT_REVISION_HEADER,
  ssfAdminContentRevisionSchema,
} from '../content-v2-editor-contracts.js';
import {
  assertTenantLocalesAreAllowed,
  systemLocalesAreAllowed,
  readSupportedLanguages,
  readSsfLanguageCatalog as readCatalog,
} from './content-v2-admin-languages.js';
import type {
  PluginServerExecutionHandler,
  PluginServerHandlerModuleFactory,
} from '@sva/plugin-sdk';
import type { Pool } from 'pg';
import { ZodError } from 'zod';

import {
  ssfSystemContentV2InputSchema,
  ssfTenantContentV2InputSchema,
} from '../content-v2-admin-contracts.js';
import {
  createSsfAdminContentRevision,
  SsfContentRevisionConflict,
  type SsfContentWriteOptions,
  SsfContentV2TenantConflict,
  readSsfSystemContentV2,
  readSsfTenantContentV2,
  replaceSsfSystemContentV2,
  writeSsfTenantContentV2,
  type SsfSystemContentV2,
  type SsfTenantContentV2,
} from '../content-v2-repository.js';
import { jsonResponse, readCorrelationId } from './responses.js';

export type SsfAdminV2Dependencies = Readonly<{
  readSystemV2?: () => Promise<SsfSystemContentV2>;
  writeSystemV2?: (
    input: SsfSystemContentV2,
    options: SsfContentWriteOptions<SsfSystemContentV2>
  ) => Promise<SsfSystemContentV2>;
  readTenantV2?: (instanceId: string) => Promise<SsfTenantContentV2>;
  writeTenantV2?: (
    instanceId: string,
    input: Record<string, unknown>,
    options: SsfContentWriteOptions<SsfTenantContentV2>
  ) => Promise<SsfTenantContentV2>;
  readSupportedLanguages?: () => Promise<unknown>;
}>;

const withSupportedLanguages = async <T extends object>(
  value: Promise<T>,
  read: SsfAdminV2Dependencies['readSupportedLanguages']
): Promise<T & { supportedLanguages: unknown | null }> => {
  const [resolvedValue, catalog] = await Promise.all([value, readCatalog(read)]);
  return { ...resolvedValue, supportedLanguages: catalog };
};

const contentResponse = async (
  value: Promise<SsfSystemContentV2 | SsfTenantContentV2>,
  scope: string,
  correlationId: string,
  read: SsfAdminV2Dependencies['readSupportedLanguages']
) => {
  const content = await withSupportedLanguages(value, read);
  const { supportedLanguages: _catalog, ...stored } = content;
  const response = jsonResponse(200, content, correlationId);
  response.headers.set(
    SSF_CONTENT_REVISION_HEADER,
    createSsfAdminContentRevision(scope, stored as SsfSystemContentV2 | SsfTenantContentV2)
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
};
const expectedRevision = (request: Request, correlationId: string): string | Response => {
  const value = request.headers.get(SSF_EXPECTED_CONTENT_REVISION_HEADER);
  if (value === null)
    return jsonResponse(428, { error: 'content_revision_required' }, correlationId);
  const parsed = ssfAdminContentRevisionSchema.safeParse(value);
  return parsed.success
    ? parsed.data
    : jsonResponse(400, { error: 'invalid_content_revision' }, correlationId);
};
const invalidConfiguration = () => {
  throw new Error('ssf_v2_locale_invalid');
};

const invalidInput = (error: unknown): boolean =>
  error instanceof ZodError || (error instanceof Error && error.message.startsWith('ssf_v2_'));

const readSystem =
  (dependencies: SsfAdminV2Dependencies): PluginServerExecutionHandler =>
  async (context) => {
    const correlationId = readCorrelationId(context.request);
    if (context.scope !== 'platform')
      return jsonResponse(403, { error: 'forbidden' }, correlationId);
    if (!dependencies.readSystemV2)
      return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
    try {
      return await contentResponse(
        dependencies.readSystemV2(),
        'platform',
        correlationId,
        dependencies.readSupportedLanguages
      );
    } catch {
      return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
    }
  };

const writeSystem =
  (dependencies: SsfAdminV2Dependencies): PluginServerExecutionHandler =>
  async (context) => {
    const correlationId = readCorrelationId(context.request);
    if (context.scope !== 'platform')
      return jsonResponse(403, { error: 'forbidden' }, correlationId);
    const revision = expectedRevision(context.request, correlationId);
    if (revision instanceof Response) return revision;
    const parsed = ssfSystemContentV2InputSchema.safeParse(
      await context.request.json().catch(() => null)
    );
    if (!parsed.success)
      return jsonResponse(422, { error: 'invalid_configuration' }, correlationId);
    if (!dependencies.writeSystemV2 || !dependencies.readSystemV2)
      return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
    try {
      const catalog = await readCatalog(dependencies.readSupportedLanguages);
      const next = await dependencies.writeSystemV2(parsed.data, {
        expectedRevision: revision,
        validate: (previous) => {
          if (!systemLocalesAreAllowed(parsed.data, previous, catalog)) invalidConfiguration();
        },
      });
      return await contentResponse(
        Promise.resolve(next),
        'platform',
        correlationId,
        async () => catalog
      );
    } catch (error) {
      if (error instanceof SsfContentRevisionConflict)
        return jsonResponse(412, { error: 'content_revision_conflict' }, correlationId);
      if (error instanceof SsfContentV2TenantConflict)
        return jsonResponse(
          422,
          {
            error: 'invalid_configuration',
            affectedTenants: error.affectedTenants,
          },
          correlationId
        );
      const invalid = invalidInput(error);
      return jsonResponse(
        invalid ? 422 : 503,
        { error: invalid ? 'invalid_configuration' : 'configuration_unavailable' },
        correlationId
      );
    }
  };

const readTenant =
  (dependencies: SsfAdminV2Dependencies): PluginServerExecutionHandler =>
  async (context) => {
    const correlationId = readCorrelationId(context.request);
    if (context.scope !== 'tenant' || !context.actor.instanceId)
      return jsonResponse(403, { error: 'forbidden' }, correlationId);
    if (!dependencies.readTenantV2)
      return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
    try {
      return await contentResponse(
        dependencies.readTenantV2(context.actor.instanceId),
        context.actor.instanceId,
        correlationId,
        dependencies.readSupportedLanguages
      );
    } catch {
      return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
    }
  };

const writeTenant =
  (dependencies: SsfAdminV2Dependencies): PluginServerExecutionHandler =>
  async (context) => {
    const correlationId = readCorrelationId(context.request);
    if (context.scope !== 'tenant' || !context.actor.instanceId)
      return jsonResponse(403, { error: 'forbidden' }, correlationId);
    const revision = expectedRevision(context.request, correlationId);
    if (revision instanceof Response) return revision;
    const parsed = ssfTenantContentV2InputSchema.safeParse(
      await context.request.json().catch(() => null)
    );
    if (!parsed.success)
      return jsonResponse(422, { error: 'invalid_configuration' }, correlationId);
    if (!dependencies.writeTenantV2 || !dependencies.readTenantV2)
      return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
    try {
      const catalog = await readCatalog(dependencies.readSupportedLanguages);
      const next = await dependencies.writeTenantV2(context.actor.instanceId, parsed.data, {
        expectedRevision: revision,
        validate: (previous) => {
          assertTenantLocalesAreAllowed(parsed.data, previous, catalog);
        },
      });
      return await contentResponse(
        Promise.resolve(next),
        context.actor.instanceId,
        correlationId,
        async () => catalog
      );
    } catch (error) {
      if (error instanceof SsfContentRevisionConflict)
        return jsonResponse(412, { error: 'content_revision_conflict' }, correlationId);
      const invalid = invalidInput(error);
      return jsonResponse(
        invalid ? 422 : 503,
        { error: invalid ? 'invalid_configuration' : 'configuration_unavailable' },
        correlationId
      );
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
  pool: Pool | null,
  rootPool: Pool | null
): SsfAdminV2Dependencies => {
  const unavailable = async (): Promise<never> => {
    throw new Error('ssf_database_unavailable');
  };
  return {
    readSystemV2: pool ? () => readSsfSystemContentV2(pool) : unavailable,
    writeSystemV2: rootPool
      ? (input, options) => replaceSsfSystemContentV2(rootPool, input, options)
      : unavailable,
    readTenantV2: pool ? (instanceId) => readSsfTenantContentV2(pool, instanceId) : unavailable,
    writeTenantV2: pool
      ? (instanceId, input, options) => writeSsfTenantContentV2(pool, instanceId, input, options)
      : unavailable,
    readSupportedLanguages,
  };
};
