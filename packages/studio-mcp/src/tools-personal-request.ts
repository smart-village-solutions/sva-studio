import { z } from 'zod';
import { resolveInterfaceSecret, type PersonalMcpContext, type StudioMcpConfig } from './config.js';
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

const groupMembershipDeleteBody = z.object({ keycloakSubject: z.string().min(1) });

const secretReference = z.object({
  secretRef: z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9:_./-]*$/u),
}).strict();

const interfaceSecretFields: Readonly<Record<string, readonly string[]>> = {
  s3: ['secretAccessKey'],
  supabase: ['databaseUrl', 'serviceRoleKey'],
  postgresql: ['databaseUrl'],
  mailTransport: ['password'],
  mapGeocoding: ['apiKey'],
};

const resolveInterfaceSecretField = async (
  value: unknown,
  input: Readonly<{ contextId: string; interfaceType: string; interfaceId?: string; field: string }>,
  config: StudioMcpConfig
): Promise<Readonly<{ value: string }> | Readonly<{ error: string }>> => {
  if (typeof value === 'string' && value.length === 0) return { value };
  const reference = secretReference.safeParse(value);
  if (!reference.success) return { error: 'interface_secret_reference_required' };
  try {
    return {
      value: await resolveInterfaceSecret(config, { ...input, secretRef: reference.data.secretRef }),
    };
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith('interface_secret_')
      ? error.message
      : 'interface_secret_resolution_failed';
    return { error: code };
  }
};

const resolveInterfaceDraftSecrets = async (
  body: Record<string, unknown>,
  context: PersonalMcpContext,
  config: StudioMcpConfig
): Promise<Readonly<{ body: Record<string, unknown> }> | Readonly<{ error: string }>> => {
  const draft = body.draft;
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return { body };
  const draftRecord = draft as Record<string, unknown>;
  const fields = interfaceSecretFields[String(draftRecord.type)];
  const draftConfig = draftRecord.config;
  if (!fields || !draftConfig || typeof draftConfig !== 'object' || Array.isArray(draftConfig)) {
    return { body };
  }
  const configRecord = draftConfig as Record<string, unknown>;
  for (const field of fields) {
    const result = await resolveInterfaceSecretField(configRecord[field], {
      contextId: context.id,
      interfaceType: String(draftRecord.type),
      ...(typeof body.existingId === 'string' ? { interfaceId: body.existingId } : {}),
      field,
    }, config);
    if ('error' in result) return result;
    configRecord[field] = result.value;
  }
  return { body };
};

export const resolvePersonalInterfaceRequestBody = async (
  input: PersonalRequest,
  context: PersonalMcpContext,
  config: StudioMcpConfig
): Promise<Readonly<{ body?: Record<string, unknown>; error?: string }>> => {
  if (input.method !== 'POST' || input.path !== 'api/v1/interfaces') {
    return { ...(input.body ? { body: input.body } : {}) };
  }
  if (!input.body) return { error: 'mutation_body_required' };
  const body = JSON.parse(JSON.stringify(input.body)) as Record<string, unknown>;
  return resolveInterfaceDraftSecrets(body, context, config);
};

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
  request.method === 'PATCH' ||
  (request.method === 'POST' && request.path === 'api/v1/interfaces') ||
  isNestedCreate(request) || isGroupMembershipDelete(request);
const forbidsMutationQuery = (request: PersonalRequest): boolean =>
  ['POST', 'PATCH'].includes(request.method);

const validatePersonalPayload = (request: PersonalRequest): string | undefined => {
  const { method, body, query } = request;
  if (method === 'GET' && body !== undefined) return 'get_body_not_allowed';
  if (method === 'DELETE' && body !== undefined && !isGroupMembershipDelete(request)) return 'delete_body_not_allowed';
  if (request.path.startsWith('api/v1/interfaces') && query !== undefined) return 'interface_query_not_supported';
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
  if (isGroupMembershipDelete(request) && request.body !== undefined && !groupMembershipDeleteBody.safeParse(request.body).success) {
    return 'group_membership_subject_required';
  }
  return validatePersonalPayload(request) ?? validateQuery(request.query);
};
