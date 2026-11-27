import type { CatalogValue } from '@sva/core';
import { z } from 'zod';
import { readResponse, translateProtectedValues } from './app-translations-provider-values.js';

const targetSchema = z.enum(['en', 'pl', 'ja']);
const languageSchema = z.object({ languages: z.array(z.string()).min(1).max(500) });
const responseSchema = z.object({
  source_lang: z.literal('de'),
  target_lang: targetSchema,
  translations: z.array(z.object({ text: z.string().refine((text) => text.trim().length > 0) })),
});
type Target = z.infer<typeof targetSchema>;

const terminal = (code: string) =>
  Object.assign(new Error(code), { cause: { retry: { kind: 'terminal' } } });

export const readSsfTranslationConfig = (instanceId: string) => {
  if (process.env.SVA_SSF_TRANSLATION_INSTANCE_ID !== instanceId) return null;
  const key = process.env.SVA_SSF_TRANSLATION_API_KEY?.trim();
  const origin = URL.parse(process.env.SVA_SSF_TRANSLATION_ORIGIN ?? '');
  const rawLocales = process.env.SVA_SSF_TRANSLATION_LOCALES?.split(',').map((code) => code.trim());
  const locales = z.array(targetSchema).min(1).max(3).safeParse(rawLocales);
  if (
    !key ||
    !origin ||
    origin.protocol !== 'https:' ||
    origin.href !== `${origin.origin}/` ||
    !locales.success ||
    new Set(locales.data).size !== locales.data.length
  )
    throw terminal('ssf_translation_configuration_invalid');
  return { origin: origin.origin, key, locales: locales.data };
};

export type SsfTranslationConfig = NonNullable<ReturnType<typeof readSsfTranslationConfig>>;

const ssfRequest = async (
  config: SsfTranslationConfig,
  path: '/api/v1/languages' | '/api/v1/translate',
  signal: AbortSignal,
  body?: string
): Promise<unknown> => {
  const response = await fetch(`${config.origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'error',
    headers: {
      'X-API-Key': config.key,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    signal,
    body,
  });
  if (!response.ok) {
    await response.body?.cancel();
    if ([408, 429, 500, 503, 504].includes(response.status))
      throw new Error('ssf_translation_unavailable');
    throw terminal(
      response.status === 413 ? 'ssf_translation_too_large' : 'ssf_translation_rejected'
    );
  }
  return readResponse(response, 262144);
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
  signal: AbortSignal
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
          translationBody(target, texts)
        )
      );
      if (!result.success || result.data.target_lang !== target)
        throw terminal('ssf_translation_invalid_response');
      return result.data.translations.map(({ text }) => text);
    },
  });
