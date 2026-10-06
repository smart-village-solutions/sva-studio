import { z } from 'zod';
import { isPersonalRouteAllowed } from './tools-personal-routes.js';

export const contextInput = z.object({ contextId: z.string().trim().min(1).max(64) });
export const requestInput = z.object({
  contextId: z.string().trim().min(1).max(64),
  method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']),
  path: z.string().trim().min(1).max(128),
  query: z.record(z.string().trim().min(1).max(64), z.union([
    z.string().max(500),
    z.array(z.string().max(500)).max(20),
  ])).optional(),
  body: z.record(z.string(), z.json()).optional(),
  requestId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
}).strict();

export type PersonalRequest = z.infer<typeof requestInput>;

const isCollectionCreate = (request: PersonalRequest): boolean =>
  request.method === 'POST' && request.path.split('/').length === 4;
const isNestedCreate = (request: PersonalRequest): boolean => {
  const parts = request.path.split('/');
  return request.method === 'POST' && ['groups', 'organizations'].includes(parts[3] ?? '') && parts.length === 6;
};
const isGroupMembershipDelete = (request: PersonalRequest): boolean => {
  const parts = request.path.split('/');
  return request.method === 'DELETE' && parts[3] === 'groups' && parts.length === 6 && parts[5] === 'memberships';
};
const requiresBody = (request: PersonalRequest): boolean =>
  request.method === 'PATCH' || isNestedCreate(request) || isGroupMembershipDelete(request);
const forbidsMutationQuery = (request: PersonalRequest): boolean =>
  ['POST', 'PATCH'].includes(request.method);

const validatePersonalPayload = (request: PersonalRequest): string | undefined => {
  const { method, body, query } = request;
  if (method === 'GET' && body !== undefined) return 'get_body_not_allowed';
  if (isCollectionCreate(request) && (!body || query !== undefined)) return 'post_contract_invalid';
  if (forbidsMutationQuery(request) && query !== undefined) return 'mutation_query_not_allowed';
  if (requiresBody(request) && body === undefined) return 'mutation_body_required';
  return undefined;
};

const validateQuery = (queryInput: PersonalRequest['query']): string | undefined => {
  const query = queryInput ?? {};
  if (Object.keys(query).length > 20) return 'query_limit_exceeded';
  const pageSize = query.pageSize;
  if (pageSize === undefined) return undefined;
  const values = Array.isArray(pageSize) ? pageSize : [pageSize];
  return values.length !== 1 || !/^\d+$/u.test(values[0] ?? '') || Number(values[0]) > 100
    ? 'page_size_out_of_range'
    : undefined;
};

export const validatePersonalRequest = (request: PersonalRequest): string | undefined => {
  if (!isPersonalRouteAllowed(request)) return 'personal_route_not_allowed';
  return validatePersonalPayload(request) ?? validateQuery(request.query);
};
