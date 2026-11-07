import { z } from 'zod';
import { withAuthenticatedUser, type AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';
import { JOBS_TYPE, jobTemporalState, type JobRecord } from './jobs-contract.js';
import { errorJson, isResponse, json, matchRequestRoute } from './content-route-core.js';
import { withMainserverContextBinding } from './content-route-context.js';
import { jobLocalAccess } from './jobs-route-access.js';
import { removeJob } from './jobs-route-delete.js';
import { mutateJob } from './jobs-route-write.js';
import {
  resolveMainserverResourceActor,
  resolveMainserverResourceAccess,
} from './mutation-principal.js';
import { getSvaMainserverJob, listSvaMainserverJobCandidates } from './service.js';
import { parseMainserverListQuery } from './list-pagination.js';

const base = '/api/v1/mainserver/jobs';
const logger = createSdkLogger({ component: 'sva-mainserver-jobs' });
const filters = z.object({
  search: z.string().max(500).optional(),
  employmentType: z.string().max(1000).optional(),
  visible: z.enum(['true', 'false']).optional(),
  temporal: z.enum(['planned', 'ongoing', 'ended', 'incomplete']).optional(),
});
function matchesJob(item: JobRecord, filter: z.infer<typeof filters>) {
  if (
    filter.search &&
    !item.title.toLocaleLowerCase('de').includes(filter.search.trim().toLocaleLowerCase('de'))
  )
    return false;
  if (filter.employmentType && item.input.employmentType !== filter.employmentType) return false;
  if (filter.visible && item.visible !== (filter.visible === 'true')) return false;
  return (
    !filter.temporal ||
    jobTemporalState(
      item.input,
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date())
    ) === filter.temporal
  );
}

async function read(request: Request, ctx: AuthenticatedRequestContext, id?: string) {
  const deleteContext = Boolean(
    id && new URL(request.url).searchParams.get('context') === 'delete'
  );
  const authorized = await jobLocalAccess(ctx, deleteContext ? 'jobs.delete' : 'jobs.read', id);
  if (isResponse(authorized)) return authorized;
  const actor = await resolveMainserverResourceActor({ request, ctx, authorizedActor: authorized });
  if (!actor) return errorJson(403, 'forbidden', 'forbidden');
  if (deleteContext) return json({ data: { id } });
  const access = (
    item: { id: string; dataProvider?: { id?: string } },
    actions: readonly string[]
  ) =>
    resolveMainserverResourceAccess({
      actor,
      actions,
      contentType: JOBS_TYPE,
      item,
      forceExactScopeActions: actions.filter((action) => action.startsWith('jobs.')),
    });
  if (id) {
    const result = await getSvaMainserverJob({ ...actor, jobId: id });
    const resourceAccess = await access(result.data, [
      'jobs.read',
      'jobs.update',
      'jobs.delete',
      'content.publish',
      'content.changeStatus',
    ]);
    if (!resourceAccess['jobs.read']) return errorJson(403, 'forbidden', 'forbidden');
    return json({ data: result.data, meta: { access: resourceAccess } });
  }
  const query = new URL(request.url).searchParams;
  const parsed = filters.safeParse(
    Object.fromEntries([...query.entries()].filter(([, value]) => value !== ''))
  );
  if (!parsed.success) return errorJson(400, 'job_invalid_input', 'job_invalid_input');
  const filter = parsed.data;
  const candidates = await listSvaMainserverJobCandidates(actor);
  const readable = [];
  for (const item of candidates) {
    if (!matchesJob(item, filter)) continue;
    if ((await access(item, ['jobs.read']))['jobs.read']) readable.push(item);
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

export async function dispatchSvaMainserverJobsRequest(request: Request): Promise<Response | null> {
  const route = matchRequestRoute(request, base, 'jobs');
  if (!route) return null;
  return withAuthenticatedUser(request, async (ctx) => {
    try {
      let response: Response;
      if (request.method === 'GET')
        response = await read(request, ctx, route.kind === 'item' ? route.itemId : undefined);
      else if (route.kind === 'collection' && request.method === 'POST')
        response = await mutateJob(request, ctx);
      else if (route.kind === 'item' && request.method === 'PATCH')
        response = await mutateJob(request, ctx, route.itemId);
      else if (route.kind === 'item' && request.method === 'DELETE')
        response = await removeJob(request, ctx, route.itemId);
      else response = errorJson(405, 'method_not_allowed', 'method_not_allowed');
      return withMainserverContextBinding(response, ctx);
    } catch (error) {
      const code =
        error instanceof Error && /^job_[a-z_]+$/.test(error.message)
          ? error.message
          : 'job_request_failed';
      logger.warn('Construction job request failed', {
        operation: 'jobs_request',
        error_code: code,
      });
      return errorJson(
        code === 'job_not_found' ? 404 : code === 'job_request_failed' ? 502 : 409,
        code,
        code
      );
    }
  });
}
