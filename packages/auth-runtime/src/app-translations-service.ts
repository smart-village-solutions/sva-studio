/** Bounded technical translation; Main-Server owns persistence and retry. */
import { deepLTargetCode, isValidInstanceId, readDeepLSettings } from '@sva/core';
import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';
import { loadDefaultExternalInterfaceRecord } from '@sva/data-repositories/server';
import { z } from 'zod';
import { withIamAppDb } from './db.js';
import { readBoundedCatalogBody } from './app-translations.js';
import {
  getDeepLSetupStatus,
  translateDeepLValues,
  assertDeepLRequestSize,
} from './app-translations-deepl.js';
import { consumeRateLimit } from './shared/rate-limit.js';
import {
  readBearerToken,
  verifyServiceJwt,
  isServiceIdentityProviderUnavailable,
} from './service-token.js';

const bindingSchema = z
  .object({
    issuer: z.url().refine((value) => new URL(value).protocol === 'https:'),
    audience: z.string().min(1).max(256),
    clientId: z.string().min(1).max(256),
    subject: z.string().min(1).max(256),
  })
  .strict();
const entrySchema = z
  .object({
    key: z
      .string()
      .regex(/^(title|author|keywords|contentBlocks\.(0|[1-9][0-9]{0,5})\.(title|intro|body))$/),
    text: z.string().max(92160),
    format: z.enum(['plain', 'html']),
  })
  .strict();
const requestSchema = z
  .object({
    schemaVersion: z.literal(1),
    instanceId: z.string().refine(isValidInstanceId),
    requestId: z.uuid(),
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    profileId: z.literal('news-v1'),
    sourceLocale: z.literal('de'),
    targetLocale: z.literal('en'),
    entries: z.array(entrySchema).min(1).max(50),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      new Set(value.entries.map((entry) => entry.key)).size !== value.entries.length ||
      value.entries.filter((entry) => entry.key === 'title').length !== 1 ||
      value.entries.some(
        (entry) => entry.format !== (entry.key.endsWith('.body') ? 'html' : 'plain')
      ) ||
      value.entries.find((entry) => entry.key === 'title')?.text.trim().length === 0 ||
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
const reply = (status: number, data: unknown) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });

const readAccess = async (instanceId: string) => {
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
  const provider = await loadDefaultExternalInterfaceRecord(instanceId, 'deepl');
  const settings = provider ? readDeepLSettings(provider.publicConfig) : undefined;
  if (
    !provider ||
    !settings ||
    !getDeepLSetupStatus(provider).ready ||
    !settings.selectedLocales.includes('en')
  )
    return null;
  const targetCode = deepLTargetCode('en', settings.englishVariant, settings.availableLanguages);
  return { binding: binding.data, connection, scope, provider, settings, targetCode };
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
    const access = await readAccess(input.instanceId);
    if (!access || JSON.stringify(access.binding) !== JSON.stringify(binding.data))
      return reply(403, { ...correlation, error: 'translation_forbidden', retryable: false });
    const limited = consumeRateLimit({
      instanceId: input.instanceId,
      actorKeycloakSubject: `translation-service:${binding.data.subject}`,
      scope: 'bulk',
    });
    if (limited) return reply(429, { ...correlation, error: 'rate_limited', retryable: true });
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(35000)]);
    const values = input.entries.map((entry) => entry.text);
    assertDeepLRequestSize(access.targetCode, values);
    const translated = await translateDeepLValues(
      access.provider,
      access.targetCode,
      values,
      signal
    );
    if (signal.aborted) throw new Error('deepl_unavailable');
    if (typeof identity.exp === 'number' && identity.exp * 1000 <= Date.now())
      return reply(401, {
        ...correlation,
        error: 'service_authentication_invalid',
        retryable: false,
      });
    if (
      translated.length !== input.entries.length ||
      translated.some((value, index) => {
        const entry = input.entries[index];
        return (
          !entry ||
          typeof value !== 'string' ||
          new TextEncoder().encode(value).length > 100000 ||
          value.trim().length === 0 ||
          (entry.format === 'html' &&
            (sanitizeRichTextHtml(value) !== value ||
              JSON.stringify(value.match(/<[^>]*>/g) ?? []) !==
                JSON.stringify(entry.text.match(/<[^>]*>/g) ?? []))) ||
          (entry.format === 'plain' && /[<>]/.test(value))
        );
      })
    )
      throw new Error('deepl_invalid_response');
    const current = await readAccess(input.instanceId);
    if (
      !current ||
      JSON.stringify(current.binding) !== JSON.stringify(access.binding) ||
      current.scope.generation !== access.scope.generation ||
      current.connection.id !== access.connection.id ||
      current.connection.updatedAt !== access.connection.updatedAt ||
      current.provider.id !== access.provider.id ||
      current.provider.updatedAt !== access.provider.updatedAt ||
      current.settings.credentialRevision !== access.settings.credentialRevision ||
      current.targetCode !== access.targetCode
    )
      return reply(403, { ...correlation, error: 'translation_forbidden', retryable: false });
    const result = {
      ...correlation,
      entries: input.entries.map((entry, index) => ({ ...entry, text: translated[index] })),
    };
    if (new TextEncoder().encode(JSON.stringify(result)).length > 150000)
      throw new Error('deepl_invalid_response');
    return reply(200, result);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const terminal =
      (error instanceof Error &&
        'cause' in error &&
        z.object({ retry: z.object({ kind: z.literal('terminal') }) }).safeParse(error.cause)
          .success) ||
      [
        'deepl_invalid_response',
        'deepl_text_too_large',
        'deepl_auth_failed',
        'deepl_quota_exceeded',
        'catalog_setup_required',
      ].includes(code);
    return reply(terminal ? 502 : 503, {
      ...correlation,
      error: terminal ? 'translation_failed' : 'service_unavailable',
      retryable: !terminal,
    });
  }
};
