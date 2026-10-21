import { APP_TRANSLATION_LOCALES, AppTranslationError } from '@sva/core';
import { createLanguageRepository } from '@sva/data-repositories/server';
import { createSdkLogger } from '@sva/server-runtime';
import { z } from 'zod';
import { withAuthenticatedUser } from './middleware.js';
import { getSession } from './redis-session.js';
import { ensurePlatformAccess } from './iam-instance-registry/http.js';
import { validateCsrf } from './shared/request-security.js';
import { withIamAppDb } from './db.js';
import { readConfiguredPluginTenantAccess } from './plugin-tenant-lifecycle/access.js';
import { readBoundedCatalogBody } from './app-translations.js';

const logger = createSdkLogger({ component: 'languages' });
const instanceId = z.string().min(1).max(128);
const revision = z.string().regex(/^(0|[1-9][0-9]{0,17})$/);
const fields = { locale: z.enum(APP_TRANSLATION_LOCALES), expectedRevision: revision };
const inputSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('availability'), ...fields, available: z.boolean() }).strict(),
  z
    .object({ operation: z.literal('assignment'), ...fields, instanceId, enabled: z.boolean() })
    .strict(),
]);
const json = (status: number, data: unknown) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export const languagesHandler = (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      const session = await getSession(ctx.sessionId, { decryptTokens: false });
      if (
        !session ||
        session.userId !== ctx.user.id ||
        session.auth?.kind !== 'platform' ||
        ctx.user.instanceId ||
        ensurePlatformAccess(request, { ...ctx, authKind: 'session' })
      )
        return json(403, { error: 'catalog_forbidden' });
      if (!['GET', 'POST'].includes(request.method))
        return json(405, { error: 'invalid_catalog_method' });
      const query = z
        .object({ instanceId: instanceId.optional() })
        .strict()
        .safeParse(Object.fromEntries(new URL(request.url).searchParams));
      if (!query.success) return json(400, { error: 'invalid_catalog' });
      let selected = query.data.instanceId;
      let input: z.infer<typeof inputSchema> | undefined;
      if (request.method === 'POST') {
        if (validateCsrf(request)) return json(403, { error: 'catalog_forbidden' });
        const body = await readBoundedCatalogBody(request, 4096);
        if (!body.ok) return body.response;
        const parsed = inputSchema.safeParse(body.data);
        if (!parsed.success) return json(400, { error: 'invalid_catalog' });
        input = parsed.data;
        if (input.operation === 'assignment') selected = input.instanceId;
      }
      const allowed = selected
        ? (await readConfiguredPluginTenantAccess(selected, 'app-translations')).allowed
        : false;
      if (input?.operation === 'assignment' && input.enabled && !allowed)
        return json(403, { error: 'catalog_forbidden' });
      const data = await withIamAppDb(async (client) => {
        await client.query(
          "SELECT set_config('app.instance_id','',true),set_config('app.organization_id','',true),set_config('app.catalog_platform','true',true)"
        );
        const repo = createLanguageRepository(client);
        if (input?.operation === 'availability')
          await repo.setAvailable(input.locale, input.available, input.expectedRevision);
        if (input?.operation === 'assignment')
          await repo.setInstance(
            input.instanceId,
            input.locale,
            input.enabled,
            input.expectedRevision
          );
        return {
          languages: await repo.list(),
          instanceId: selected ?? null,
          moduleAllowed: allowed,
          assignments: selected ? await repo.assignments(selected) : [],
        };
      });
      return json(200, { data });
    } catch (error) {
      if (error instanceof AppTranslationError)
        return json(error.code === 'catalog_conflict' ? 409 : 403, { error: error.code });
      logger.error('Language configuration failed', {
        error: 'languages_unavailable',
        error_type: error instanceof Error ? error.constructor.name : typeof error,
      });
      return json(503, { error: 'languages_unavailable' });
    }
  });
