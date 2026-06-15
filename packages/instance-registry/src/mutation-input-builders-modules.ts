import type { InstanceStatus } from '@sva/core';

import type {
  AssignInstanceModuleInput,
  BootstrapAdminStructureInput,
  ChangeInstanceStatusInput,
  RevokeInstanceModuleInput,
  SeedInstanceIamBaselineInput,
} from './mutation-types.js';
import type { IdempotentInstanceMutationContext } from './mutation-input-builders-internal.js';

export type AssignInstanceModulePayload = {
  readonly moduleId: string;
};

export type RevokeInstanceModulePayload = {
  readonly moduleId: string;
  readonly confirmation: 'REVOKE';
};

export type BootstrapAdminStructurePayload = {
  readonly moduleIds?: readonly string[];
};

export const buildChangeInstanceStatusInput = (
  instanceId: string,
  nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>,
  context: IdempotentInstanceMutationContext
): ChangeInstanceStatusInput => ({
  idempotencyKey: context.idempotencyKey,
  instanceId,
  nextStatus,
  actorId: context.actorId,
  requestId: context.requestId,
});

export const buildAssignInstanceModuleInput = (
  instanceId: string,
  payload: AssignInstanceModulePayload,
  context: IdempotentInstanceMutationContext
): AssignInstanceModuleInput => ({
  idempotencyKey: context.idempotencyKey,
  instanceId,
  moduleId: payload.moduleId,
  actorId: context.actorId,
  requestId: context.requestId,
});

export const buildRevokeInstanceModuleInput = (
  instanceId: string,
  payload: RevokeInstanceModulePayload,
  context: IdempotentInstanceMutationContext
): RevokeInstanceModuleInput => ({
  idempotencyKey: context.idempotencyKey,
  instanceId,
  moduleId: payload.moduleId,
  confirmation: payload.confirmation,
  actorId: context.actorId,
  requestId: context.requestId,
});

export const buildSeedInstanceIamBaselineInput = (
  instanceId: string,
  context: IdempotentInstanceMutationContext
): SeedInstanceIamBaselineInput => ({
  idempotencyKey: context.idempotencyKey,
  instanceId,
  actorId: context.actorId,
  requestId: context.requestId,
});

export const buildBootstrapAdminStructureInput = (
  instanceId: string,
  payload: BootstrapAdminStructurePayload,
  context: IdempotentInstanceMutationContext
): BootstrapAdminStructureInput => ({
  idempotencyKey: context.idempotencyKey,
  instanceId,
  moduleIds: payload.moduleIds ?? [],
  actorId: context.actorId,
  requestId: context.requestId,
});
