import type { AccountInvitationTemplate } from '@sva/core';
import type { CreateInstanceProvisioningInput, UpdateInstanceInput } from './mutation-types.js';
import type {
  CreateInstancePayloadFields,
  IdempotentInstanceMutationContext,
  InstanceMutationContext,
} from './mutation-input-builders-internal.js';

export type CreateInstancePayload = CreateInstancePayloadFields & {
  readonly instanceId: string;
};

export type UpdateInstancePayload = CreateInstancePayloadFields & {
  readonly accountInvitationTemplate?: Omit<AccountInvitationTemplate, 'revision'> | null;
  readonly accountInvitationTemplateRevision?: number;
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
  moduleIds: payload.moduleIds,
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
  accountInvitationTemplate: payload.accountInvitationTemplate,
  accountInvitationTemplateRevision: payload.accountInvitationTemplateRevision,
});
