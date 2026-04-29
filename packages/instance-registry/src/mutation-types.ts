import type { InstanceRealmMode, InstanceStatus, IamInstanceKeycloakProvisioningRun, IamInstanceListItem } from '@sva/core';

export type InstanceRegistryMutationActor = {
  readonly actorId?: string;
  readonly requestId?: string;
};

type TenantAdminBootstrap = {
  readonly username: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
};

type TenantAdminClient = {
  readonly clientId: string;
  readonly secret?: string;
};

export type CreateInstanceProvisioningInput = InstanceRegistryMutationActor & {
  readonly idempotencyKey: string;
  readonly instanceId: string;
  readonly displayName: string;
  readonly parentDomain: string;
  readonly realmMode: InstanceRealmMode;
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecret?: string;
  readonly tenantAdminClient?: TenantAdminClient;
  readonly tenantAdminBootstrap?: TenantAdminBootstrap;
  readonly themeKey?: string;
  readonly mainserverConfigRef?: string;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
};

export type ChangeInstanceStatusInput = InstanceRegistryMutationActor & {
  readonly idempotencyKey: string;
  readonly instanceId: string;
  readonly nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>;
};

export type UpdateInstanceInput = InstanceRegistryMutationActor & {
  readonly instanceId: string;
  readonly displayName: string;
  readonly parentDomain: string;
  readonly realmMode: InstanceRealmMode;
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecret?: string;
  readonly tenantAdminClient?: TenantAdminClient;
  readonly tenantAdminBootstrap?: TenantAdminBootstrap;
  readonly themeKey?: string;
  readonly mainserverConfigRef?: string;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
};

export type ReconcileInstanceKeycloakInput = InstanceRegistryMutationActor & {
  readonly idempotencyKey: string;
  readonly instanceId: string;
  readonly tenantAdminTemporaryPassword?: string;
  readonly rotateClientSecret?: boolean;
};

export type ExecuteInstanceKeycloakProvisioningInput = InstanceRegistryMutationActor & {
  readonly idempotencyKey: string;
  readonly instanceId: string;
  readonly intent: IamInstanceKeycloakProvisioningRun['intent'];
  readonly tenantAdminTemporaryPassword?: string;
};

export type ProbeTenantIamAccessInput = InstanceRegistryMutationActor & {
  readonly idempotencyKey: string;
  readonly instanceId: string;
};

export type CreateInstanceProvisioningResult =
  | { readonly ok: true; readonly instance: IamInstanceListItem }
  | { readonly ok: false; readonly reason: 'already_exists' };

export type ChangeInstanceStatusResult =
  | { readonly ok: true; readonly instance: IamInstanceListItem }
  | { readonly ok: false; readonly reason: 'not_found' | 'invalid_transition'; readonly currentStatus?: InstanceStatus };
