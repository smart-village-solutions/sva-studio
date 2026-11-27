import {
  AppTranslationError,
  deepLTargetCode,
  readDeepLSettings,
  type DeepLSetupStatus,
  type ExternalInterfaceRecord,
  type CatalogValue,
} from '@sva/core';
import { buildExternalInterfaceSecretConfigAad } from '@sva/server-runtime';
import { z } from 'zod';
import { revealField } from './iam-account-management/encryption.js';
import {
  readResponse as readProviderResponse,
  translateProtectedValues,
} from './app-translations-provider-values.js';

export const readResponse = async (response: Response, limit?: number): Promise<unknown> => {
  try {
    return await readProviderResponse(response, limit);
  } catch {
    throw new Error('deepl_invalid_response');
  }
};

export const deepLApiOrigin = (plan: 'free' | 'pro'): string =>
  plan === 'free' ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
export type SetupRecord = Pick<
  ExternalInterfaceRecord,
  | 'id'
  | 'typeKey'
  | 'ownerKind'
  | 'enabled'
  | 'publicConfig'
  | 'secretConfigCiphertext'
  | 'lastCheckStatus'
>;
export const readKey = (record: SetupRecord): string | undefined => {
  try {
    const clear = revealField(
      record.secretConfigCiphertext,
      buildExternalInterfaceSecretConfigAad(record.id)
    );
    const value: unknown = clear ? JSON.parse(clear) : null;
    if (
      !value ||
      typeof value !== 'object' ||
      !('apiKey' in value) ||
      typeof value.apiKey !== 'string' ||
      !value.apiKey.trim()
    )
      return undefined;
    return value.apiKey;
  } catch {
    return undefined;
  }
};
export const getDeepLSetupStatus = (record: SetupRecord | null): DeepLSetupStatus => {
  const settings = record ? readDeepLSettings(record.publicConfig) : undefined;
  const common = {
    interfaceId: record?.id ?? null,
    selectedLocales: settings?.selectedLocales ?? [],
  };
  const result = (reason: DeepLSetupStatus['reason']): DeepLSetupStatus => ({
    ...common,
    ready: reason === 'ready',
    reason,
  });
  if (!record || record.typeKey !== 'deepl' || record.ownerKind !== 'host' || !settings)
    return result('not_configured');
  if (!record.enabled) return result('disabled');
  if (!readKey(record)) return result('secret_missing');
  if (
    record.lastCheckStatus !== 'succeeded' ||
    settings.verifiedCredentialRevision !== settings.credentialRevision
  )
    return result('check_required');
  if (
    !settings.selectedLocales.length ||
    settings.selectedLocales.some(
      (locale) =>
        !settings.availableLanguages.some(
          (language) =>
            language.code ===
            deepLTargetCode(locale, settings.englishVariant, settings.availableLanguages)
        )
    )
  )
    return result('languages_required');
  return result('ready');
};
const translationBody = (targetCode: string, text: string[]) =>
  JSON.stringify({ text, source_lang: 'DE', target_lang: targetCode });
export const assertDeepLRequestSize = (
  targetCode: string,
  values: readonly CatalogValue[]
): void => {
  for (const value of values)
    for (const text of typeof value === 'string' ? [value] : value) {
      let occurrence = 0;
      const protectedText = text.replace(
        /\{\{[A-Za-z][A-Za-z0-9_]*\}\}|<[^>]*>/g,
        () => `SVA${'0'.repeat(32)}X${++occurrence}Z`
      );
      if (new TextEncoder().encode(translationBody(targetCode, [protectedText])).length > 102400)
        throw Object.assign(new Error('deepl_text_too_large'), {
          cause: { retry: { kind: 'terminal' } },
        });
    }
};
const fail = (code: string, retryable = false): never => {
  throw Object.assign(new Error(code), {
    cause: retryable ? undefined : { retry: { kind: 'terminal' } },
  });
};

const translateBatch = async (
  settings: NonNullable<ReturnType<typeof readDeepLSettings>>,
  key: string,
  targetCode: string,
  batch: string[],
  signal: AbortSignal,
  fetchImpl: typeof fetch
) => {
  let response: Response;
  try {
    response = await fetchImpl(`${deepLApiOrigin(settings.plan)}/v2/translate`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: translationBody(targetCode, batch),
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    });
  } catch (error) {
    if (error instanceof AppTranslationError) throw error;
    fail('deepl_unavailable', true);
  }
  if (!response!.ok) {
    await response!.body?.cancel();
    fail(
      response!.status === 429
        ? 'deepl_rate_limited'
        : response!.status === 456
          ? 'deepl_quota_exceeded'
          : response!.status === 401 || response!.status === 403
            ? 'deepl_auth_failed'
            : 'deepl_unavailable',
      response!.status === 429 || response!.status >= 500
    );
  }
  let raw: unknown;
  try {
    raw = await readResponse(response!, 4 * 1024 * 1024);
  } catch {
    fail('deepl_invalid_response');
  }
  const parsed = z.object({ translations: z.array(z.object({ text: z.string() })) }).safeParse(raw);
  if (!parsed.success || parsed.data.translations.length !== batch.length)
    fail('deepl_invalid_response');
  return parsed.data!.translations;
};
/** No retries here: the persisted Studio job owns the retry budget. */
export const translateDeepLValues = async (
  record: SetupRecord,
  targetCode: string,
  values: readonly CatalogValue[],
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch
): Promise<CatalogValue[]> => {
  const settings = readDeepLSettings(record.publicConfig);
  const key = readKey(record);
  if (
    !settings ||
    !key ||
    !getDeepLSetupStatus(record).ready ||
    !settings.availableLanguages.some((language) => language.code === targetCode)
  )
    throw Object.assign(new Error('catalog_setup_required'), {
      cause: { retry: { kind: 'terminal' } },
    });
  assertDeepLRequestSize(targetCode, values);
  return translateProtectedValues(values, {
    maxItems: 50,
    fits: (texts) => new TextEncoder().encode(translationBody(targetCode, texts)).length <= 102400,
    translate: async (texts) =>
      (await translateBatch(settings, key, targetCode, texts, signal, fetchImpl)).map(
        ({ text }) => text
      ),
  });
};
