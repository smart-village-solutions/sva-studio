/** Creates the bounded editorial role through existing personal IAM requests. */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Role, Assignment, Outcome } from './editor-role-profile.js';
import type { PersonalMcpContext } from './config.js';
import type { PersonalRequest } from './tools-personal-request.js';
import type { ToolResult } from './tools-support.js';

import {
  permissionSchema,
  roleSchema,
  marker,
  coreActions,
  moduleActions,
  scopeFor,
} from './editor-role-profile.js';

export const editorBaselineInput = z
  .object({
    contextIds: z
      .array(z.string().trim().min(1).max(64))
      .min(1)
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length, 'duplicate_context_id'),
  })
  .strict();

export type PersonalCaller = (request: PersonalRequest) => Promise<ToolResult>;

const read = async (call: PersonalCaller, input: PersonalRequest): Promise<unknown> => {
  const response = await call(input);
  if (response.structuredContent.ok !== true) throw new Error('iam_request_failed');
  return response.structuredContent.data;
};
const readRoles = async (call: PersonalCaller, contextId: string): Promise<Role[]> =>
  z
    .object({ data: z.array(roleSchema) })
    .parse(await read(call, { contextId, method: 'GET', path: 'api/v1/iam/roles' })).data;

const differences = (role: Role, expected: readonly Assignment[]): string[] => {
  const actual = new Map(role.permissions.map((p) => [p.permissionKey, p.accessScope ?? 'all']));
  const wanted = new Map(expected.map((p) => [p.permissionKey, p.accessScope]));
  return [
    ...expected
      .filter((p) => actual.get(p.permissionKey) !== p.accessScope)
      .map((p) => p.permissionKey),
    ...role.permissions.filter((p) => !wanted.has(p.permissionKey)).map((p) => p.permissionKey),
  ];
};

type ProfilePlan = {
  assignments: Assignment[];
  details: Pick<Outcome, 'unavailableModules' | 'unsupportedContentActions'>;
};

const planAssignments = (
  permissions: readonly z.infer<typeof permissionSchema>[],
  contextId: string
): ProfilePlan | Outcome => {
  const catalog = new Map(permissions.map((p) => [p.permissionKey, p]));
  const unavailableModules = Object.keys(moduleActions).filter(
    (module) => !permissions.some((p) => p.permissionKey.startsWith(`${module}.`))
  );
  const keys = [
    ...coreActions.map((action) => `content.${action}`),
    ...Object.entries(moduleActions)
      .filter(([module]) => !unavailableModules.includes(module))
      .flatMap(([module, actions]) => actions.map((action) => `${module}.${action}`)),
  ];
  const missing = keys.filter((key) => !catalog.has(key));
  const unsupportedContentActions = permissions
    .filter(
      (p) =>
        /\.(?:create|update|delete)$/u.test(p.permissionKey) &&
        !['content', 'iam', ...Object.keys(moduleActions)].includes(
          p.permissionKey.split('.')[0] ?? ''
        )
    )
    .map((p) => p.permissionKey);
  const details = { unavailableModules, unsupportedContentActions };
  if (missing.length)
    return {
      contextId,
      status: 'blocked',
      code: 'permissions_missing',
      differences: missing,
      ...details,
    };
  const assignments: Assignment[] = keys.map((permissionKey) => ({
    permissionId: catalog.get(permissionKey)!.id,
    permissionKey,
    accessScope: scopeFor(permissionKey),
  }));
  const unsupportedScopes = assignments
    .filter(
      (p) =>
        p.accessScope === 'organization' &&
        !(
          catalog.get(p.permissionKey)?.isScopeAssignable &&
          catalog.get(p.permissionKey)?.supportedAccessScopes?.includes('organization')
        )
    )
    .map((p) => p.permissionKey);
  if (unsupportedScopes.length)
    return {
      contextId,
      status: 'blocked',
      code: 'organization_scope_unavailable',
      differences: unsupportedScopes,
      ...details,
    };

  return { assignments, details };
};

const createAndVerifyRole = async (
  contextId: string,
  assignments: readonly Assignment[],
  details: ProfilePlan['details'],
  call: PersonalCaller
): Promise<Outcome> => {
  let createdId: string | undefined;
  let writeFailed = false;
  try {
    const created = await read(call, {
      contextId,
      method: 'POST',
      path: 'api/v1/iam/roles',
      idempotencyKey: randomUUID(),
      body: {
        roleName: 'editor',
        displayName: 'Redaktion',
        description: marker,
        roleLevel: 20,
        permissionAssignments: assignments.map(({ permissionId, accessScope: scope }) => ({
          permissionId,
          accessScope: scope,
        })),
      },
    });
    createdId = z.object({ data: z.object({ id: z.string().min(1) }) }).parse(created).data.id;
  } catch {
    writeFailed = true;
  }
  // Always read independently after an attempted write, including uncertain outcomes.
  const observed = (await readRoles(call, contextId)).filter((role) => role.roleKey === 'editor');
  const role = observed[0];
  if (writeFailed)
    return {
      contextId,
      status: 'error',
      code: 'creation_outcome_unknown',
      ...(role ? { roleId: role.id } : {}),
      ...details,
    };
  if (
    observed.length !== 1 ||
    !role ||
    role.id !== createdId ||
    role.description !== marker ||
    role.managedBy !== 'studio'
  ) {
    return { contextId, status: 'error', code: 'role_readback_mismatch', ...details };
  }
  const diff = differences(role, assignments);
  if (diff.length || role.syncState !== 'synced')
    return {
      contextId,
      status: 'error',
      code: 'role_readback_mismatch',
      roleId: role.id,
      differences: diff,
      ...details,
    };
  return { contextId, status: 'created', roleId: role.id, matchesStandard: true, ...details };
};

const ensureForContext = async (
  context: Extract<PersonalMcpContext, { kind: 'tenant' }>,
  call: PersonalCaller
): Promise<Outcome> => {
  const contextId = context.id;
  const roles = await readRoles(call, contextId);
  if (
    !roles.some(
      (role) =>
        role.roleKey === 'system_admin' &&
        role.managedBy === 'studio' &&
        role.syncState === 'synced'
    )
  ) {
    return { contextId, status: 'blocked', code: 'admin_baseline_missing' };
  }
  const permissions = z.object({ data: z.array(permissionSchema) }).parse(
    await read(call, {
      contextId,
      method: 'GET',
      path: 'api/v1/iam/permissions',
    })
  ).data;
  if (permissions.some((permission) => permission.instanceId !== context.tenantId)) {
    return { contextId, status: 'blocked', code: 'permission_tenant_mismatch' };
  }
  const plan = planAssignments(permissions, contextId);
  if ('status' in plan) return plan;
  const { assignments, details } = plan;

  const existing = roles.filter((role) => role.roleKey === 'editor');
  if (existing.length) {
    const role = existing[0]!;
    if (existing.length !== 1 || role.managedBy !== 'studio' || role.description !== marker) {
      return {
        contextId,
        status: 'blocked',
        code: 'existing_role_requires_review',
        roleId: role.id,
        ...details,
      };
    }
    const diff = differences(role, assignments);
    return {
      contextId,
      status: 'existing',
      roleId: role.id,
      matchesStandard: diff.length === 0 && role.syncState === 'synced',
      differences: diff,
      ...details,
    };
  }

  return createAndVerifyRole(contextId, assignments, details, call);
};

/** Validate the complete explicit selection before issuing any tenant request. */
export const ensureEditorRoles = async (
  input: z.infer<typeof editorBaselineInput>,
  contexts: readonly PersonalMcpContext[],
  call: PersonalCaller
): Promise<Outcome[]> => {
  const { contextIds } = editorBaselineInput.parse(input);
  const selected = contextIds.map((id) => contexts.find((context) => context.id === id));
  if (selected.some((context) => !context || context.kind !== 'tenant'))
    throw new Error('explicit_tenant_context_required');
  const outcomes: Outcome[] = [];
  for (const context of selected) {
    if (!context || context.kind !== 'tenant') throw new Error('explicit_tenant_context_required');
    try {
      outcomes.push(await ensureForContext(context, call));
    } catch {
      outcomes.push({
        contextId: context.id,
        status: 'error',
        code: 'iam_request_or_schema_failed',
      });
    }
  }
  return outcomes;
};
