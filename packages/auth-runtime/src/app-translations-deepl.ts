/** Instance-bound DeepL setup. Provider keys never leave this server path. */
import {
  isAppTranslationLocale,
  readDeepLSettings,
  type DeepLLanguage,
  type DeepLSetupStatus,
} from '@sva/core';
import {
  loadDefaultExternalInterfaceRecord,
  loadExternalInterfaceRecordById,
  saveDeepLInterfaceCheck,
} from '@sva/data-repositories/server';
import { z } from 'zod';
import {
  deepLApiOrigin,
  getDeepLSetupStatus,
  readKey,
  readResponse,
} from './app-translations-deepl-provider.js';
export { deepLApiOrigin, getDeepLSetupStatus } from './app-translations-deepl-provider.js';
export { assertDeepLRequestSize, translateDeepLValues } from './app-translations-deepl-provider.js';

export const readDeepLSetupStatus = async (instanceId: string): Promise<DeepLSetupStatus> =>
  getDeepLSetupStatus(await loadDefaultExternalInterfaceRecord(instanceId, 'deepl'));

const languageSchema = z
  .array(
    z
      .object({
        lang: z.string().min(2).max(32),
        name: z.string().min(1).max(128),
        usable_as_source: z.boolean(),
        usable_as_target: z.boolean(),
        status: z.string(),
        features: z.record(z.string(), z.object({ status: z.string() }).passthrough()),
      })
      .passthrough()
  )
  .min(1)
  .max(500);
export const parseDeepLLanguages = (raw: unknown): DeepLLanguage[] => {
  const parsed = languageSchema.safeParse(raw);
  if (
    !parsed.success ||
    !parsed.data.some(
      (language) =>
        language.lang === 'de' && language.usable_as_source && language.status === 'stable'
    )
  )
    throw new Error('deepl_invalid_response');
  const languages = parsed.data
    .filter((language) => language.usable_as_target && language.status === 'stable')
    .map((language) => {
      let code: string;
      try {
        code = Intl.getCanonicalLocales(language.lang)[0] ?? '';
      } catch {
        throw new Error('deepl_invalid_response');
      }
      if (!isAppTranslationLocale(code)) throw new Error('deepl_invalid_response');
      return {
        code,
        name: language.name,
        tagHandling: language.features.tag_handling?.status === 'stable',
      };
    });
  if (
    !languages.length ||
    new Set(languages.map((language) => language.code)).size !== languages.length
  )
    throw new Error('deepl_invalid_response');
  return languages;
};
/** Caller must authorize integration.manage, the instance and the active module before calling. */
export const checkDeepLLanguages = async (
  instanceId: string,
  interfaceId: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; errorCode?: string }> => {
  const record = await loadExternalInterfaceRecordById(instanceId, interfaceId);
  if (!record || record.typeKey !== 'deepl' || record.ownerKind !== 'host')
    throw new Error('interface_not_found');
  if (!record.enabled) throw new Error('deepl_disabled');
  const settings = readDeepLSettings(record.publicConfig);
  const key = readKey(record);
  if (!settings || !key) throw new Error('deepl_secret_missing');
  let languages: DeepLLanguage[] | undefined;
  let errorCode: string | undefined;
  try {
    const response = await fetchImpl(
      `${deepLApiOrigin(settings.plan)}/v3/languages?resource=translate_text`,
      {
        method: 'GET',
        headers: { Authorization: `DeepL-Auth-Key ${key}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        response.status === 401 || response.status === 403
          ? 'deepl_auth_failed'
          : response.status === 429
            ? 'deepl_rate_limited'
            : 'deepl_unavailable'
      );
    }
    languages = parseDeepLLanguages(await readResponse(response));
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    errorCode = [
      'deepl_auth_failed',
      'deepl_rate_limited',
      'deepl_invalid_response',
      'deepl_unavailable',
    ].includes(code)
      ? code
      : 'deepl_unavailable';
  }
  await saveDeepLInterfaceCheck({
    instanceId,
    interfaceId,
    expectedRevision: settings.revision,
    checkedAt: new Date().toISOString(),
    languages,
    errorCode,
  });
  return errorCode ? { ok: false, errorCode } : { ok: true };
};
