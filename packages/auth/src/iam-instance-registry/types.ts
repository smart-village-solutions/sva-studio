import type { HostClassification, InstanceStatus, IamInstanceListItem, IamInstanceDetail } from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data';

export type InstanceRegistryMutationActor = {
  readonly actorId?: string;
  readonly requestId?: string;
};

export type CreateInstanceProvisioningInput = InstanceRegistryMutationActor & {
  readonly idempotencyKey: string;
  readonly instanceId: string;
  readonly displayName: string;
  readonly parentDomain: string;
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecret?: string;
  readonly tenantAdminBootstrap?: {
    readonly username: string;
    readonly email?: string;
    readonly firstName?: string;
    readonly lastName?: string;
  };
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
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecret?: string;
  readonly tenantAdminBootstrap?: {
    readonly username: string;
    readonly email?: string;
    readonly firstName?: string;
    readonly lastName?: string;
  };
  readonly themeKey?: string;
  readonly mainserverConfigRef?: string;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
};

export type ReconcileInstanceKeycloakInput = InstanceRegistryMutationActor & {
  readonly instanceId: string;
  readonly tenantAdminTemporaryPassword?: string;
  readonly rotateClientSecret?: boolean;
};

export type CreateInstanceProvisioningResult =
  | { readonly ok: true; readonly instance: IamInstanceListItem }
  | { readonly ok: false; readonly reason: 'already_exists' };

export type ChangeInstanceStatusResult =
  | { readonly ok: true; readonly instance: IamInstanceListItem }
  | { readonly ok: false; readonly reason: 'not_found' | 'invalid_transition'; readonly currentStatus?: InstanceStatus };

export type ResolveRuntimeInstanceResult = {
  readonly hostClassification: HostClassification;
  readonly instance: IamInstanceListItem | null;
};

export type KeycloakTenantStatus = NonNullable<IamInstanceDetail['keycloakStatus']>;

export type InstanceRegistryService = {
  listInstances(input?: {
    search?: string;
    status?: InstanceStatus;
  }): Promise<readonly IamInstanceListItem[]>;
  getInstanceDetail(instanceId: string): Promise<IamInstanceDetail | null>;
  createProvisioningRequest(input: CreateInstanceProvisioningInput): Promise<CreateInstanceProvisioningResult>;
  updateInstance(input: UpdateInstanceInput): Promise<IamInstanceDetail | null>;
  changeStatus(input: ChangeInstanceStatusInput): Promise<ChangeInstanceStatusResult>;
  getKeycloakStatus(instanceId: string): Promise<KeycloakTenantStatus | null>;
  reconcileKeycloak(input: ReconcileInstanceKeycloakInput): Promise<KeycloakTenantStatus | null>;
  resolveRuntimeInstance(host: string): Promise<ResolveRuntimeInstanceResult>;
  isTrafficAllowed(status: InstanceStatus): boolean;
};

export type InstanceRegistryServiceDeps = {
  readonly repository: InstanceRegistryRepository;
  readonly invalidateHost: (hostname: string) => void;
  readonly provisionInstanceAuth?: (input: {
    instanceId: string;
    primaryHostname: string;
    authRealm: string;
    authClientId: string;
    authIssuerUrl?: string;
    authClientSecret?: string;
    tenantAdminBootstrap?: {
      username: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    };
    tenantAdminTemporaryPassword?: string;
    rotateClientSecret?: boolean;
  }) => Promise<void>;
  readonly getKeycloakStatus?: (input: {
    instanceId: string;
    primaryHostname: string;
    authRealm: string;
    authClientId: string;
    authIssuerUrl?: string;
    authClientSecretConfigured: boolean;
    authClientSecret?: string;
    tenantAdminBootstrap?: {
      username: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    };
  }) => Promise<KeycloakTenantStatus>;
};
