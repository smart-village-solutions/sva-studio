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
  value: Promise<T>, read: SsfAdminV2Dependencies['readSupportedLanguages']
): Promise<T & { supportedLanguages: unknown | null }> => {
  const [resolvedValue, catalog] = await Promise.all([value, readCatalog(read)]);
  return { ...resolvedValue, supportedLanguages: catalog };
};

const readCatalog = async (read: SsfAdminV2Dependencies['readSupportedLanguages']) => {
  if (!read) return null;
  try {
    const parsed = ssfSupportedLanguagesCatalogSchema.safeParse(await read());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const localeIsAllowed = (locale: string, previous: string | undefined, catalog: Awaited<ReturnType<typeof readCatalog>>) =>
  locale === previous || Boolean(catalog?.languages[locale]);

const systemLocalesAreAllowed = (
  input: { installation: SsfSystemContentV2['installation']; runtimeTemplate: SsfSystemContentV2['runtimeTemplate'] },
  previous: SsfSystemContentV2,
  catalog: Awaited<ReturnType<typeof readCatalog>>
): boolean => {
  if (input.installation && !localeIsAllowed(input.installation.localization.locale,
    previous.installation?.localization.locale, catalog)) return false;
  const previousRuntime = previous.runtimeTemplate;
  if (!catalog && previousRuntime && input.runtimeTemplate) {
    const previousGuests = previousRuntime.guestLanguages.map(({ locale }) => locale).sort();
    const requestedGuests = input.runtimeTemplate.guestLanguages.map(({ locale }) => locale).sort();
    if (previousGuests.length !== requestedGuests.length || previousGuests.some((locale, index) => locale !== requestedGuests[index])) return false;
  }
  if (!input.runtimeTemplate) return true;
  if (!localeIsAllowed(input.runtimeTemplate.staff.locale, previousRuntime?.staff.locale, catalog)) return false;
  const previousGuestLocales = new Set(previousRuntime?.guestLanguages.map(({ locale }) => locale) ?? []);
  return input.runtimeTemplate.guestLanguages.every(({ locale }) =>
    previousGuestLocales.has(locale) || Boolean(catalog?.languages[locale]));
};

const tenantGuestChangesAreAllowed = (
  input: Record<string, unknown>,
  previous: SsfTenantContentV2,
  catalog: Awaited<ReturnType<typeof readCatalog>>
): boolean => {
  if (catalog) return true;
  const guestLanguages = input['guestLanguages'];
  if (guestLanguages === undefined) return true;
  if (!Array.isArray(guestLanguages)) return false;
  const templateLocales = new Set(previous.runtimeTemplate?.guestLanguages.map(({ locale }) => locale) ?? []);
  return guestLanguages.every((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return false;
    const value = entry as Record<string, unknown>;
    return typeof value['locale'] === 'string' && templateLocales.has(value['locale']) && value['enabled'] === undefined;
  });
};

const tenantStaffLocale = (value: Record<string, unknown> | null | undefined): string | undefined => {
  const staff = value?.staff;
  if (typeof staff !== 'object' || staff === null || Array.isArray(staff)) return undefined;
  const locale = (staff as Record<string, unknown>).locale;
  return typeof locale === 'string' ? locale : undefined;
};

const SUPPORTED_LANGUAGES_CACHE_TTL_MS = 5 * 60 * 1000;
let supportedLanguagesCache: { expiresAt: number; value: Promise<unknown> } | null = null;

const readSupportedLanguages = (): Promise<unknown> => {
  const now = Date.now();
  if (supportedLanguagesCache && (supportedLanguagesCache.expiresAt === 0 || supportedLanguagesCache.expiresAt > now)) {
    return supportedLanguagesCache.value;
  }

  const value = fetch('https://api.dialog.kassel.de/api/languages/supported', {
    signal: AbortSignal.timeout(5_000),
    headers: { accept: 'application/json' },
  }).then(async (response) => {
    if (!response.ok) throw new Error('ssf_supported_languages_unavailable');
    return response.json();
  }).then((catalog) => {
    supportedLanguagesCache = { expiresAt: Date.now() + SUPPORTED_LANGUAGES_CACHE_TTL_MS, value: Promise.resolve(catalog) };
    return catalog;
  }).catch((error: unknown) => {
    supportedLanguagesCache = null;
    throw error;
  });
  supportedLanguagesCache = { expiresAt: 0, value };
  return value;
};

const invalidInput = (error: unknown): boolean => error instanceof ZodError ||
  (error instanceof Error && error.message.startsWith('ssf_v2_'));

const readSystem = (dependencies: SsfAdminV2Dependencies): PluginServerExecutionHandler => async (context) => {
  const correlationId = readCorrelationId(context.request);
  if (context.scope !== 'platform') return jsonResponse(403, { error: 'forbidden' }, correlationId);
  if (!dependencies.readSystemV2) return jsonResponse(503, { error: 'configuration_unavailable' }, correlationId);
  try {
    return jsonResponse(200, await withSupportedLanguages(dependencies.readSystemV2(), dependencies.readSupportedLanguages), correlationId);
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
    const [previous, catalog] = await Promise.all([
      dependencies.readSystemV2(), readCatalog(dependencies.readSupportedLanguages),
    ]);
    if (!systemLocalesAreAllowed(parsed.data, previous, catalog)) {
      return jsonResponse(422, { error: 'invalid_configuration' }, correlationId);
    }
    await dependencies.writeSystemV2(parsed.data);
    return jsonResponse(200, await withSupportedLanguages(dependencies.readSystemV2(), dependencies.readSupportedLanguages), correlationId);
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
    return jsonResponse(200, await withSupportedLanguages(dependencies.readTenantV2(context.actor.instanceId), dependencies.readSupportedLanguages), correlationId);
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
    const [previous, catalog] = await Promise.all([
      dependencies.readTenantV2(context.actor.instanceId), readCatalog(dependencies.readSupportedLanguages),
    ]);
    const requestedLocale = tenantStaffLocale(parsed.data);
    if (!tenantGuestChangesAreAllowed(parsed.data, previous, catalog)) {
      return jsonResponse(422, { error: 'invalid_configuration' }, correlationId);
    }
    if (requestedLocale) {
      const previousLocale = tenantStaffLocale(previous.overrides) ?? previous.runtimeTemplate?.staff.locale;
      if (!localeIsAllowed(requestedLocale, previousLocale, catalog)) {
        return jsonResponse(422, { error: 'invalid_configuration' }, correlationId);
      }
    }
    await dependencies.writeTenantV2(context.actor.instanceId, parsed.data);
    return jsonResponse(200, await withSupportedLanguages(dependencies.readTenantV2(context.actor.instanceId), dependencies.readSupportedLanguages), correlationId);
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
    readSupportedLanguages,
  };
};
