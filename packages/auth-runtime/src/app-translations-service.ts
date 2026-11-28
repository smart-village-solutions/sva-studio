import { createHash } from 'node:crypto';
import {
  appTranslationLanguage,
  isAppTranslationLocale,
  isValidInstanceId,
  type CatalogValue,
} from '@sva/core';
import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';
import { loadDefaultExternalInterfaceRecord } from '@sva/data-repositories/server';
import { z } from 'zod';
import { withIamAppDb } from './db.js';
import { translationServiceBindingSchema as bindingSchema } from './app-translations-binding.js';
import { readBoundedCatalogBody } from './app-translations.js';
import {
  loadTranslationProviderRecords,
  resolveTranslationProviders,
  translateWithInstanceProvider,
  type TranslationProviderPin,
} from './app-translations-providers.js';
import { getRedisClient } from './redis.js';
import {
  readSsfTranslationConfig,
  selectSsfTranslationTarget,
  translateSsfValues,
} from './app-translations-ssf.js';
import { translationFailureIsTerminal } from './app-translations-provider-values.js';
import { translateStaticHtml } from './app-translations-static-html.js';
import { consumeRateLimit } from './shared/rate-limit.js';
import {
  readBearerToken,
  verifyServiceJwt,
  isServiceIdentityProviderUnavailable,
} from './service-token.js';
const entrySchema = z
  .object({
    key: z
      .string()
      .regex(
        /^(title|author|keywords|settings\.onlySummaryLinkText|contentBlocks\.(0|[1-9][0-9]{0,5})\.(title|intro|body|mediaContents\.(0|[1-9][0-9]{0,5})\.captionText))$/
      ),
    text: z.string().max(92160).regex(/\S/u),
    format: z.enum(['plain', 'html']),
  })
  .strict();
const requestEnvelope = z
  .object({
    schemaVersion: z.literal(1),
    instanceId: z.string().refine(isValidInstanceId),
    requestId: z.uuid(),
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    sourceLocale: z.literal('de'),
    targetLocale: z
      .string()
      .refine(
        (locale) => isAppTranslationLocale(locale) && appTranslationLanguage(locale) !== 'de'
      ),
  })
  .strict();
const newsRequestSchema = requestEnvelope
  .extend({ profileId: z.literal('news-v1'), entries: z.array(entrySchema).min(1).max(50) })
  .superRefine((value, ctx) => {
    if (
      new Set(value.entries.map((entry) => entry.key)).size !== value.entries.length ||
      value.entries.filter((entry) => entry.key === 'title').length !== 1 ||
      value.entries.some(
        (entry) =>
          !entry.key.endsWith('.intro') &&
          entry.format !== (entry.key.endsWith('.body') ? 'html' : 'plain')
      ) ||
      value.entries.reduce((size, entry) => size + new TextEncoder().encode(entry.text).length, 0) >
        90000
    )
      ctx.addIssue({ code: 'custom', message: 'invalid_news_profile' });
    for (const entry of value.entries) {
      if (
        (entry.format === 'plain' && /[<>]/.test(entry.text)) ||
        (entry.format === 'html' && sanitizeRichTextHtml(entry.text) !== entry.text)
      )
        ctx.addIssue({ code: 'custom', message: 'invalid_news_text' });
    }
  });
const settingsRequestSchema = requestEnvelope.extend({
  profileId: z.literal('global-settings-v1'),
  entries: z.tuple([
    z
      .object({
        key: z.literal('label'),
        format: z.literal('plain'),
        text: z
          .string()
          .regex(/\S/u)
          .refine(
            (text) => !/[<>]|\{\{|%\{/.test(text) && new TextEncoder().encode(text).length <= 2048
          ),
      })
      .strict(),
  ]),
});
const staticHtmlRequestSchema = requestEnvelope.extend({
  profileId: z.literal('static-html-v1'),
  entries: z.tuple([
    z
      .object({
        key: z.literal('content'),
        format: z.literal('html'),
        text: z
          .string()
          .max(90000)
          .regex(/\S/u)
          .refine(
            (text) =>
              new TextEncoder().encode(text).length <= 90000 &&
              /^(?:<p>[^<>]+<\/p>)+$/u.test(text) &&
              sanitizeRichTextHtml(text) === text
          ),
      })
      .strict(),
  ]),
});
const requestSchema = z.union([newsRequestSchema, settingsRequestSchema, staticHtmlRequestSchema]);

const reply = (status: number, data: unknown) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });

const readAccess = async (
  instanceId: string,
  targetLocale: z.infer<typeof requestEnvelope>['targetLocale'],
  pin?: TranslationProviderPin
) => {
  const connection = await loadDefaultExternalInterfaceRecord(instanceId, 'sva_mainserver');
  const binding = bindingSchema.safeParse(connection?.publicConfig.translationService);
  if (!connection?.enabled || !binding.success) return null;
  // This adapter uses only instance-owned configuration, never an inferred organization.
  const scope = await withIamAppDb(async (client) => {
    await client.query("SELECT set_config('app.instance_id', $1, true)", [instanceId]);
    const result = await client.query<{ generation: string }>(
      `SELECT l.desired_generation::text AS generation
       FROM iam.instances i
       JOIN iam.instance_modules m ON m.instance_id=i.id AND m.module_id='app-translations'
       JOIN iam.instance_plugin_lifecycle l ON l.instance_id=m.instance_id AND l.plugin_id=m.module_id
       WHERE i.id=$1 AND i.status='active' AND m.effective_active AND l.access_state='active'`,
      [instanceId]
    );
    return result.rows.length === 1 ? result.rows[0] : null;
  });
  if (!scope) return null;
  const common = { binding: binding.data, connection, scope };
  const { deepL, ssf } = await loadTranslationProviderRecords(instanceId);
  const pilot = ssf ? null : readSsfTranslationConfig(instanceId);
  const pilotTarget = pilot && selectSsfTranslationTarget(pilot, targetLocale);
  if (pilot && pilotTarget && (!pin || pin.interfaceId === 'pilot')) {
    const pilotPin = {
      interfaceId: 'pilot',
      credentialRevision: createHash('sha256')
        .update(JSON.stringify([pilot.origin, pilot.key, pilot.locales]))
        .digest('hex'),
    };
    if (pin && pin.credentialRevision !== pilotPin.credentialRevision) return null;
    return {
      ...common,
      providerVersion: [pilotPin.credentialRevision],
      pin: pilotPin,
      targetCode: pilotTarget,
      translate: (values: readonly CatalogValue[], signal: AbortSignal) =>
        translateSsfValues(pilot, pilotTarget, values, signal),
    };
  }
  const chosen = resolveTranslationProviders(deepL, ssf).select(targetLocale, pin);
  if (!chosen) return null;
  return {
    ...common,
    providerVersion: [chosen.record.id, chosen.record.updatedAt, chosen.pin.credentialRevision],
    pin: chosen.pin,
    targetCode: chosen.targetCode,
    translate: (values: readonly CatalogValue[], signal: AbortSignal) =>
      translateWithInstanceProvider(chosen.record, chosen.targetCode, values, signal),
  };
};

type TranslationServiceInput = z.infer<typeof requestSchema>;
type TranslationServiceAccess = NonNullable<Awaited<ReturnType<typeof readAccess>>>;

const validTranslatedEntry = (
  value: CatalogValue,
  entry: TranslationServiceInput['entries'][number] | undefined
): boolean => {
  if (!entry || typeof value !== 'string') return false;
  if (new TextEncoder().encode(value).length > 100000 || value.trim().length === 0) return false;
  if (entry.format === 'plain') return !/[<>]/.test(value);
  return (
    sanitizeRichTextHtml(value) === value &&
    JSON.stringify(value.match(/<[^>]*>/g) ?? []) ===
      JSON.stringify(entry.text.match(/<[^>]*>/g) ?? [])
  );
};
const assertTranslatedEntries = (
  input: TranslationServiceInput,
  translated: CatalogValue[]
): void => {
  if (
    translated.length !== input.entries.length ||
    translated.some((value, index) => !validTranslatedEntry(value, input.entries[index]))
  )
    throw new Error('deepl_invalid_response');
};

const accessUnchanged = (
  current: TranslationServiceAccess | null,
  access: TranslationServiceAccess
): boolean =>
  current !== null &&
  JSON.stringify(current.binding) === JSON.stringify(access.binding) &&
  current.scope.generation === access.scope.generation &&
  current.connection.id === access.connection.id &&
  JSON.stringify(current.connection.updatedAt) === JSON.stringify(access.connection.updatedAt) &&
  JSON.stringify(current.providerVersion) === JSON.stringify(access.providerVersion) &&
  current.targetCode === access.targetCode;
/** Bounded technical translation; Main-Server owns persistence and retry. */

// A retry of the same requestId must keep its provider. Store only dispatch metadata.
const dispatchPinSchema = z.object({
  interfaceId: z.string(),
  credentialRevision: z.string(),
  request: z.string(),
});
const dispatchPinTtlSeconds = 7 * 24 * 60 * 60;

const authenticateTranslation = async (
  input: TranslationServiceInput,
  token: string,
  correlation: Record<string, unknown>
) => {
  const connection = await loadDefaultExternalInterfaceRecord(input.instanceId, 'sva_mainserver');
  const binding = bindingSchema.safeParse(connection?.publicConfig.translationService);
  if (!connection?.enabled || !binding.success)
    return reply(403, { ...correlation, error: 'translation_forbidden', retryable: false });
  let identity;
  try {
    identity = await verifyServiceJwt(token, binding.data);
  } catch (error) {
    const unavailable = isServiceIdentityProviderUnavailable(error);
    return reply(unavailable ? 503 : 401, {
      ...correlation,
      error: unavailable ? 'service_unavailable' : 'service_authentication_invalid',
      retryable: unavailable,
    });
  }
  if (identity.azp !== binding.data.clientId || identity.sub !== binding.data.subject)
    return reply(403, { ...correlation, error: 'translation_forbidden', retryable: false });
  const redis = getRedisClient();
  const key = `app-translations:dispatch:${input.instanceId}:${input.requestId}`;
  const request = [
    input.sourceDigest,
    input.profileId,
    input.targetLocale,
    binding.data.subject,
  ].join(':');
  const stored = await redis.get(key);
  const pin = stored ? dispatchPinSchema.parse(JSON.parse(stored)) : undefined;
  if (pin && pin.request !== request)
    return reply(403, { ...correlation, error: 'translation_forbidden', retryable: false });
  const access = await readAccess(input.instanceId, input.targetLocale, pin);
  if (!access || JSON.stringify(access.binding) !== JSON.stringify(binding.data))
    return reply(403, { ...correlation, error: 'translation_forbidden', retryable: false });
  return {
    access,
    identity,
    dispatch: { redis, key, value: JSON.stringify({ ...access.pin, request }) },
  };
};

export const appTranslationServiceHandler = async (request: Request): Promise<Response> => {
  if (request.method !== 'POST')
    return reply(405, { error: 'method_not_allowed', retryable: false });
  const token = readBearerToken(request);
  if (!token) return reply(401, { error: 'service_authentication_invalid', retryable: false });
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json')
    return reply(415, { error: 'invalid_translation_request', retryable: false });
  const body = await readBoundedCatalogBody(request, 100000);
  if (!body.ok)
    return reply(body.response.status, { error: 'invalid_translation_request', retryable: false });
  const parsed = requestSchema.safeParse(body.data);
  if (!parsed.success)
    return reply(400, { error: 'invalid_translation_request', retryable: false });
  const input = parsed.data;
  const correlation = {
    schemaVersion: 1,
    requestId: input.requestId,
    sourceDigest: input.sourceDigest,
    profileId: input.profileId,
    sourceLocale: input.sourceLocale,
    targetLocale: input.targetLocale,
  };
  try {
    const authenticated = await authenticateTranslation(input, token, correlation);
    if (authenticated instanceof Response) return authenticated;
    const { access, identity, dispatch } = authenticated;
    const limited = consumeRateLimit({
      instanceId: input.instanceId,
      actorKeycloakSubject: `translation-service:${access.binding.subject}`,
      scope: 'bulk',
    });
    if (limited) return reply(429, { ...correlation, error: 'rate_limited', retryable: true });
    const { redis, key, value } = dispatch;
    const stored = await redis.set(key, value, 'EX', dispatchPinTtlSeconds, 'NX');
    if (!stored && (await redis.get(key)) !== value)
      return reply(503, { ...correlation, error: 'service_unavailable', retryable: true });
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(35000)]);
    const translated =
      input.profileId === 'static-html-v1'
        ? await translateStaticHtml(access.translate, input.entries[0].text, signal)
        : await access.translate(
            input.entries.map((entry) => entry.text),
            signal
          );
    if (signal.aborted) throw new Error('deepl_unavailable');
    if (typeof identity.exp === 'number' && identity.exp * 1000 <= Date.now())
      return reply(401, {
        ...correlation,
        error: 'service_authentication_invalid',
        retryable: false,
      });
    assertTranslatedEntries(input, translated);
    const current = await readAccess(input.instanceId, input.targetLocale, access.pin);
    if (!accessUnchanged(current, access))
      return reply(403, { ...correlation, error: 'translation_forbidden', retryable: false });
    const result = {
      ...correlation,
      entries: input.entries.map((entry, index) => ({ ...entry, text: translated[index] })),
    };
    if (new TextEncoder().encode(JSON.stringify(result)).length > 150000)
      throw new Error('deepl_invalid_response');
    return reply(200, result);
  } catch (error) {
    const terminal = translationFailureIsTerminal(error);
    return reply(terminal ? 502 : 503, {
      ...correlation,
      error: terminal ? 'translation_failed' : 'service_unavailable',
      retryable: !terminal,
    });
  }
};
