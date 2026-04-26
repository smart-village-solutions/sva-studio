import type { IamInstanceKeycloakProvisioningRun, InstanceRealmMode, InstanceStatus } from '@sva/core';

import type {
  ChangeInstanceStatusInput,
  CreateInstanceProvisioningInput,
  ExecuteInstanceKeycloakProvisioningInput,
  ReconcileInstanceKeycloakInput,
  UpdateInstanceInput,
} from './mutation-types.js';

type TenantAdminBootstrapPayload = {
  readonly username: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
};

type TenantAdminClientPayload = {
  readonly clientId: string;
  readonly secret?: string;
};

type InstanceMutationContext = {
  readonly actorId: string;
  readonly requestId?: string;
};

type IdempotentInstanceMutationContext = InstanceMutationContext & {
  readonly idempotencyKey: string;
};

export type CreateInstancePayload = {
  readonly instanceId: string;
  readonly displayName: string;
  readonly parentDomain: string;
  readonly realmMode: InstanceRealmMode;
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecret?: string;
  readonly tenantAdminClient?: TenantAdminClientPayload;
  readonly tenantAdminBootstrap?: TenantAdminBootstrapPayload;
  readonly themeKey?: string;
  readonly mainserverConfigRef?: string;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
};

export type UpdateInstancePayload = Omit<CreateInstancePayload, 'instanceId'>;

export type ReconcileKeycloakPayload = {
  readonly tenantAdminTemporaryPassword?: string;
  readonly rotateClientSecret?: boolean;
};

export type ExecuteKeycloakProvisioningPayload = {
  readonly intent: IamInstanceKeycloakProvisioningRun['intent'];
  readonly tenantAdminTemporaryPassword?: string;
};

export const buildCreateInstanceProvisioningInput = (
  payload: CreateInstancePayload,
  context: IdempotentInstanceMutationContext
): CreateInstanceProvisioningInput => ({
  idempotencyKey: context.idempotencyKey,
  instanceId: payload.instanceId,
  displayName: payload.displayName,
  parentDomain: payload.parentDomain,
  realmMode: payload.realmMode,
  authRealm: payload.authRealm,
  authClientId: payload.authClientId,
  authIssuerUrl: payload.authIssuerUrl,
  authClientSecret: payload.authClientSecret,
  tenantAdminClient: payload.tenantAdminClient,
  tenantAdminBootstrap: payload.tenantAdminBootstrap,
  actorId: context.actorId,
  requestId: context.requestId,
  themeKey: payload.themeKey,
  featureFlags: payload.featureFlags,
  mainserverConfigRef: payload.mainserverConfigRef,
});

export const buildUpdateInstanceInput = (
  instanceId: string,
  payload: UpdateInstancePayload,
  context: InstanceMutationContext
): UpdateInstanceInput => ({
  instanceId,
  displayName: payload.displayName,
  parentDomain: payload.parentDomain,
  realmMode: payload.realmMode,
  authRealm: payload.authRealm,
  authClientId: payload.authClientId,
  authIssuerUrl: payload.authIssuerUrl,
  authClientSecret: payload.authClientSecret,
  tenantAdminClient: payload.tenantAdminClient,
  tenantAdminBootstrap: payload.tenantAdminBootstrap,
  actorId: context.actorId,
  requestId: context.requestId,
  themeKey: payload.themeKey,
  featureFlags: payload.featureFlags,
  mainserverConfigRef: payload.mainserverConfigRef,
});

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
