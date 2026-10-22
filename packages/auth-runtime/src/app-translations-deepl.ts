/** Instance-bound DeepL setup. Provider keys never leave this server path. */
import {
  deepLTargetCode,
  isAppTranslationLocale,
  readDeepLSettings,
  type DeepLLanguage,
  type DeepLSetupStatus,
  type ExternalInterfaceRecord,
  type CatalogValue,
} from '@sva/core';
import {
  loadDefaultExternalInterfaceRecord,
  loadExternalInterfaceRecordById,
  saveDeepLInterfaceCheck,
} from '@sva/data-repositories/server';
import { buildExternalInterfaceSecretConfigAad } from '@sva/server-runtime';
import { z } from 'zod';
import { revealField } from './iam-account-management/encryption.js';

export const deepLApiOrigin = (plan: 'free' | 'pro'): string =>
  plan === 'free' ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
type SetupRecord = Pick<
  ExternalInterfaceRecord,
  | 'id'
  | 'typeKey'
  | 'ownerKind'
  | 'enabled'
  | 'publicConfig'
  | 'secretConfigCiphertext'
  | 'lastCheckStatus'
>;
const readKey = (record: SetupRecord): string | undefined => {
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
const readResponse = async (response: Response, limit = 262144): Promise<unknown> => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('deepl_invalid_response');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error('deepl_invalid_response');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error('deepl_invalid_response');
  }
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
  const fail = (code: string, retryable = false): never => {
    throw Object.assign(new Error(code), {
      cause: retryable ? undefined : { retry: { kind: 'terminal' } },
    });
  };
  const prefix = `SVA${globalThis.crypto.randomUUID().replaceAll('-', '')}X`;
  const units = values.flatMap((value) => (typeof value === 'string' ? [value] : [...value]));
  if (!units.length || units.some((text) => text.includes(prefix))) fail('invalid_catalog');
  assertDeepLRequestSize(targetCode, values);
  // Protect every occurrence, including repeated placeholders and literal markup.
  const protectedUnits = units
    .map((text) => {
      const tokens: string[] = [];
      const protectedText = text.replace(/\{\{[A-Za-z][A-Za-z0-9_]*\}\}|<[^>]*>/g, (token) => {
        tokens.push(token);
        return `${prefix}${tokens.length}Z`;
      });
      return { text: protectedText, tokens };
    })
    .map((unit, index) => ({ ...unit, index }))
    .filter((unit) => unit.text.length > 0);
  const bodyFor = (text: string[]) => translationBody(targetCode, text);
  const translated: string[] = Array(units.length).fill('');
  let cursor = 0;
  while (cursor < protectedUnits.length) {
    const batch: string[] = [];
    while (cursor + batch.length < protectedUnits.length && batch.length < 50) {
      const next = protectedUnits[cursor + batch.length]!.text;
      if (new TextEncoder().encode(bodyFor([...batch, next])).length > 102400) break;
      batch.push(next);
    }
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
        body: bodyFor(batch),
        signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
      });
    } catch {
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
    const parsed = z
      .object({ translations: z.array(z.object({ text: z.string() })) })
      .safeParse(raw);
    if (!parsed.success || parsed.data.translations.length !== batch.length)
      fail('deepl_invalid_response');
    for (const [index, entry] of parsed!.data!.translations.entries()) {
      const tokens = protectedUnits[cursor + index]!.tokens;
      let text = entry.text;
      if (/\{\{|\}\}|<[^>]*>/.test(text)) fail('deepl_invalid_response');
      for (const [tokenIndex, token] of tokens.entries()) {
        const sentinel = `${prefix}${tokenIndex + 1}Z`;
        if (text.split(sentinel).length !== 2) fail('deepl_invalid_response');
        text = text.replace(sentinel, token);
      }
      if (
        text.includes(prefix) ||
        /\{\{|\}\}/.test(text.replace(/\{\{[A-Za-z][A-Za-z0-9_]*\}\}/g, ''))
      )
        fail('deepl_invalid_response');
      translated[protectedUnits[cursor + index]!.index] = text;
    }
    cursor += batch.length;
  }
  let offset = 0;
  return values.map((value) =>
    typeof value === 'string'
      ? translated[offset++]!
      : translated.slice(offset, (offset += value.length))
  );
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
