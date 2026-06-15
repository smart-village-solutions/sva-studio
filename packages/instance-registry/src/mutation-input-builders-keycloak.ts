import type {
  ExecuteInstanceKeycloakProvisioningInput,
  ProbeTenantIamAccessInput,
  ReconcileInstanceKeycloakInput,
} from './mutation-types.js';
import type {
  ExecuteKeycloakProvisioningIntent,
  IdempotentInstanceMutationContext,
} from './mutation-input-builders-internal.js';

export type ReconcileKeycloakPayload = {
  readonly tenantAdminTemporaryPassword?: string;
  readonly rotateClientSecret?: boolean;
};

export type ExecuteKeycloakProvisioningPayload = {
  readonly intent: ExecuteKeycloakProvisioningIntent;
  readonly tenantAdminTemporaryPassword?: string;
};

export type ProbeTenantIamAccessPayload = Record<string, never>;

export const buildReconcileInstanceKeycloakInput = (
  instanceId: string,
  payload: ReconcileKeycloakPayload,
  context: IdempotentInstanceMutationContext
): ReconcileInstanceKeycloakInput => ({
  idempotencyKey: context.idempotencyKey,
  instanceId,
  actorId: context.actorId,
  requestId: context.requestId,
  tenantAdminTemporaryPassword: payload.tenantAdminTemporaryPassword,
  rotateClientSecret: payload.rotateClientSecret,
});

export const buildExecuteInstanceKeycloakProvisioningInput = (
  instanceId: string,
  payload: ExecuteKeycloakProvisioningPayload,
  context: IdempotentInstanceMutationContext
): ExecuteInstanceKeycloakProvisioningInput => ({
  idempotencyKey: context.idempotencyKey,
  instanceId,
  actorId: context.actorId,
  requestId: context.requestId,
  intent: payload.intent,
  tenantAdminTemporaryPassword: payload.tenantAdminTemporaryPassword,
});

export const buildProbeTenantIamAccessInput = (
  instanceId: string,
  context: IdempotentInstanceMutationContext
): ProbeTenantIamAccessInput => ({
  idempotencyKey: context.idempotencyKey,
  instanceId,
  actorId: context.actorId,
  requestId: context.requestId,
});
