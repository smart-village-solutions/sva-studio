/** Instance-bound DeepL setup. Provider keys never leave this server path. */
import {
  deepLTargetCode,
  isAppTranslationLocale,
  readDeepLSettings,
  type DeepLLanguage,
  type DeepLSetupStatus,
  type ExternalInterfaceRecord,
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
const readResponse = async (response: Response): Promise<unknown> => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('deepl_invalid_response');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 262144) {
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
