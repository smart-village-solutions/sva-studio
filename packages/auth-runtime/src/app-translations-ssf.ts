import {
  AppTranslationError,
  isSsfTranslationApiKey,
  isSsfTranslationLocaleList,
  isSsfTranslationTarget,
  parseSsfTranslationOrigin,
  readSsfTranslationSettings,
  type CatalogValue,
  type DeepLSetupStatus,
  type SsfTranslationTarget,
} from '@sva/core';
import {
  loadExternalInterfaceRecordById,
  saveTranslationInterfaceCheck,
} from '@sva/data-repositories/server';
import { fetchPublicHttps } from '@sva/server-runtime';
import { readKey, type SetupRecord } from './app-translations-deepl-provider.js';
import { z } from 'zod';
import {
  InvalidProviderResponse,
  readResponse,
  translateProtectedValues,
} from './app-translations-provider-values.js';

const targetSchema = z.custom<SsfTranslationTarget>(isSsfTranslationTarget);
const languageSchema = z.object({ languages: z.array(z.string()).min(1).max(500) });
const responseSchema = z.object({
  source_lang: z.literal('de'),
  target_lang: targetSchema,
  translations: z.array(z.object({ text: z.string().refine((text) => text.trim().length > 0) })),
});
type Target = SsfTranslationTarget;

const terminal = (code: string) =>
  Object.assign(new Error(code), { cause: { retry: { kind: 'terminal' } } });

export const readSsfTranslationConfig = (instanceId: string) => {
  if (process.env.SVA_SSF_TRANSLATION_INSTANCE_ID !== instanceId) return null;
  const key = process.env.SVA_SSF_TRANSLATION_API_KEY?.trim();
  const origin = parseSsfTranslationOrigin(process.env.SVA_SSF_TRANSLATION_ORIGIN ?? '');
  const rawLocales = process.env.SVA_SSF_TRANSLATION_LOCALES?.split(',').map((code) => code.trim());
  if (
    !key ||
    !/^[a-f0-9]{64}$/u.test(key) ||
    !origin ||
    !isSsfTranslationLocaleList(rawLocales) ||
    rawLocales.length === 0 ||
    rawLocales.some((locale) => !['en', 'pl', 'ja'].includes(locale))
  )
    throw terminal('ssf_translation_configuration_invalid');
  return { origin, key, locales: rawLocales };
};

export type SsfTranslationConfig = Readonly<{
  origin: string;
  key: string;
  locales: readonly Target[];
}>;

const ssfRequest = async (
  config: SsfTranslationConfig,
  path: '/api/v1/languages' | '/api/v1/translate',
  signal: AbortSignal,
  body?: string,
  fetchImpl: typeof fetchPublicHttps = fetchPublicHttps
): Promise<unknown> => {
  const response = await fetchImpl(`${config.origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'error',
    headers: {
      'X-API-Key': config.key,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    signal,
    body,
  }).catch((error: unknown) => {
    if (error instanceof AppTranslationError) throw error;
    throw new Error('ssf_translation_unavailable');
  });
  if (!response.ok) {
    await response.body?.cancel();
    if ([408, 429, 500, 502, 503, 504].includes(response.status))
      throw new Error('ssf_translation_unavailable');
    throw terminal(
      response.status === 413 ? 'ssf_translation_too_large' : 'ssf_translation_rejected'
    );
  }
  try {
    return await readResponse(response);
  } catch (error) {
    if (error instanceof InvalidProviderResponse)
      throw terminal('ssf_translation_invalid_response');
    throw error;
  }
};

export const verifySsfTranslationLocales = async (config: SsfTranslationConfig) => {
  const result = languageSchema.parse(
    await ssfRequest(config, '/api/v1/languages', AbortSignal.timeout(10_000))
  );
  if (
    !result.languages.includes('de') ||
    config.locales.some((code) => !result.languages.includes(code))
  )
    throw terminal('ssf_translation_languages_unavailable');
  return config.locales;
};

export const selectSsfTranslationTarget = (
  config: SsfTranslationConfig,
  target: string
): Target | null => config.locales.find((code) => code === target) ?? null;

const translationBody = (target: Target, text: string[]) =>
  JSON.stringify({ text, source_lang: 'de', target_lang: target });

export const translateSsfValues = (
  config: SsfTranslationConfig,
  target: Target,
  values: readonly CatalogValue[],
  signal: AbortSignal,
  fetchImpl: typeof fetchPublicHttps = fetchPublicHttps
): Promise<CatalogValue[]> =>
  translateProtectedValues(values, {
    maxItems: 10,
    skipWhitespace: true,
    fits: (texts) =>
      texts.reduce((count, text) => count + Array.from(text).length, 0) <= 5000 &&
      new TextEncoder().encode(translationBody(target, texts)).length <= 65_536,
    translate: async (texts) => {
      const result = responseSchema.safeParse(
        await ssfRequest(
          config,
          '/api/v1/translate',
          AbortSignal.any([signal, AbortSignal.timeout(32_000)]),
          translationBody(target, texts),
          fetchImpl
        )
      );
      if (!result.success || result.data.target_lang !== target)
        throw terminal('ssf_translation_invalid_response');
      return result.data.translations.map(({ text }) => text);
    },
  });

export const readSsfRecordConfig = (record: SetupRecord): SsfTranslationConfig | null => {
  const settings = readSsfTranslationSettings(record.publicConfig);
  const key = readKey(record);
  if (!settings || !key || !isSsfTranslationApiKey(key)) return null;
  return { origin: settings.origin, key, locales: settings.selectedLocales };
};

export const getSsfSetupStatus = (record: SetupRecord | null): DeepLSetupStatus => {
  const settings = record ? readSsfTranslationSettings(record.publicConfig) : undefined;
  const result = (reason: DeepLSetupStatus['reason']): DeepLSetupStatus => ({
    ready: reason === 'ready',
    reason,
    interfaceId: record?.id ?? null,
    selectedLocales: settings?.selectedLocales ?? [],
  });
  if (!record || record.typeKey !== 'ssf_translation' || record.ownerKind !== 'host' || !settings)
    return result('not_configured');
  if (!record.enabled) return result('disabled');
  if (!readSsfRecordConfig(record)) return result('secret_missing');
  if (
    record.lastCheckStatus !== 'succeeded' ||
    settings.verifiedCredentialRevision !== settings.credentialRevision
  )
    return result('check_required');
  if (!settings.selectedLocales.some((locale) => settings.availableLanguages.includes(locale)))
    return result('languages_required');
  return result('ready');
};

export const checkSsfLanguages = async (instanceId: string, interfaceId: string) => {
  const record = await loadExternalInterfaceRecordById(instanceId, interfaceId);
  if (!record || record.typeKey !== 'ssf_translation' || record.ownerKind !== 'host')
    throw new Error('interface_not_found');
  if (!record.enabled) throw new Error('ssf_translation_rejected');
  const settings = readSsfTranslationSettings(record.publicConfig);
  const config = readSsfRecordConfig(record);
  if (!settings || !config) throw new Error('ssf_translation_rejected');
  let languages: Target[] | undefined;
  let errorCode: string | undefined;
  try {
    const response = languageSchema.safeParse(
      await ssfRequest(config, '/api/v1/languages', AbortSignal.timeout(10_000))
    );
    if (!response.success || !response.data.languages.includes('de'))
      throw new Error('ssf_translation_invalid_response');
    const targets = [...new Set(response.data.languages.filter(isSsfTranslationTarget))];
    if (!targets.length) throw new Error('ssf_translation_languages_unavailable');
    languages = targets;
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    errorCode = [
      'ssf_translation_rejected',
      'ssf_translation_invalid_response',
      'ssf_translation_languages_unavailable',
    ].includes(code)
      ? code
      : 'ssf_translation_unavailable';
  }
  await saveTranslationInterfaceCheck({
    instanceId,
    interfaceId,
    typeKey: 'ssf_translation',
    expectedRevision: settings.revision,
    checkedAt: new Date().toISOString(),
    languages,
    errorCode,
  });
  return errorCode ? { ok: false, errorCode } : { ok: true };
};
