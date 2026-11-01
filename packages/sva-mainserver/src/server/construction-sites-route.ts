import { z } from 'zod';
import { withAuthenticatedUser, type AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';
import {
  CONSTRUCTION_SITES_TYPE,
  constructionSiteDateSchema,
  type ConstructionSiteRecord,
} from './construction-sites-contract.js';
import { errorJson, isResponse, json, matchRequestRoute } from './content-route-core.js';
import { withMainserverContextBinding } from './content-route-context.js';
import { constructionSiteLocalAccess } from './construction-sites-route-access.js';
import { mutateConstructionSite } from './construction-sites-route-write.js';
import {
  resolveMainserverResourceActor,
  resolveMainserverResourceAccess,
} from './mutation-principal.js';
import {
  getSvaMainserverConstructionSite,
  listSvaMainserverConstructionSiteCandidates,
} from './service.js';
import { parseMainserverListQuery } from './list-pagination.js';

const base = '/api/v1/mainserver/construction-sites';
const logger = createSdkLogger({ component: 'sva-mainserver-construction-sites' });
const filters = z
  .object({
    search: z.string().max(500).optional(),
    category: z.string().max(1000).optional(),
    dateStart: constructionSiteDateSchema.optional(),
    dateEnd: constructionSiteDateSchema.optional(),
  })
  .refine((value) => !value.dateStart || !value.dateEnd || value.dateStart <= value.dateEnd);

function matchesConstructionSite(item: ConstructionSiteRecord, filter: z.infer<typeof filters>) {
  const date = item.input.dates[0];
  if (
    filter.search &&
    !item.title.toLocaleLowerCase('de').includes(filter.search.trim().toLocaleLowerCase('de'))
  )
    return false;
  if (
    filter.category &&
    !item.input.categories.some((category) => category.name === filter.category)
  )
    return false;
  if (filter.dateStart && (!date?.dateEnd || date.dateEnd < filter.dateStart)) return false;
  if (filter.dateEnd && (!date?.dateStart || date.dateStart > filter.dateEnd)) return false;
  return true;
}

async function read(request: Request, ctx: AuthenticatedRequestContext, id?: string) {
  const authorized = await constructionSiteLocalAccess(ctx, 'construction-sites.read', id);
  if (isResponse(authorized)) return authorized;
  const actor = await resolveMainserverResourceActor({ request, ctx, authorizedActor: authorized });
  if (!actor) return errorJson(403, 'forbidden', 'forbidden');
  const access = (
    item: { id: string; dataProvider?: { id?: string } },
    actions: readonly string[]
  ) =>
    resolveMainserverResourceAccess({
      actor,
      actions,
      contentType: CONSTRUCTION_SITES_TYPE,
      item,
      forceExactScopeActions: actions.filter((action) => action.startsWith('construction-sites.')),
    });
  if (id) {
    const result = await getSvaMainserverConstructionSite({ ...actor, siteId: id });
    const resourceAccess = await access(result.data, [
      'construction-sites.read',
      'construction-sites.update',
      'content.publish',
      'content.changeStatus',
    ]);
    if (!resourceAccess['construction-sites.read']) return errorJson(403, 'forbidden', 'forbidden');
    return json({ data: result.data, meta: { access: resourceAccess } });
  }
  const query = new URL(request.url).searchParams;
  const parsed = filters.safeParse(
    Object.fromEntries([...query.entries()].filter(([, value]) => value !== ''))
  );
  if (!parsed.success)
    return errorJson(400, 'construction_site_invalid_input', 'construction_site_invalid_input');
  const filter = parsed.data;
  const candidates = await listSvaMainserverConstructionSiteCandidates(actor);
  const readable = [];
  for (const item of candidates) {
    if (!matchesConstructionSite(item, filter)) continue;
    if ((await access(item, ['construction-sites.read']))['construction-sites.read'])
      readable.push(item);
  }
  readable.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  const { page, pageSize } = parseMainserverListQuery(request);
  const start = (page - 1) * pageSize;
  return json({
    data: readable.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      hasNextPage: start + pageSize < readable.length,
      total: readable.length,
    },
  });
}

export async function dispatchSvaMainserverConstructionSitesRequest(
  request: Request
): Promise<Response | null> {
  const route = matchRequestRoute(request, base, 'construction-sites');
  if (!route) return null;
  return withAuthenticatedUser(request, async (ctx) => {
    try {
      let response: Response;
      if (request.method === 'GET')
        response = await read(request, ctx, route.kind === 'item' ? route.itemId : undefined);
      else if (route.kind === 'collection' && request.method === 'POST')
        response = await mutateConstructionSite(request, ctx);
      else if (route.kind === 'item' && request.method === 'PATCH')
        response = await mutateConstructionSite(request, ctx, route.itemId);
      else response = errorJson(405, 'method_not_allowed', 'method_not_allowed');
      return withMainserverContextBinding(response, ctx);
    } catch (error) {
      const code =
        error instanceof Error && /^construction_site_[a-z_]+$/.test(error.message)
          ? error.message
          : 'construction_site_request_failed';
      logger.warn('Construction site request failed', {
        operation: 'construction_sites_request',
        error_code: code,
      });
      return errorJson(
        code === 'construction_site_not_found'
          ? 404
          : code === 'construction_site_request_failed'
            ? 502
            : 409,
        code,
        code
      );
    }
  });
}
