import type { IamInstanceKeycloakProvisioningRun, InstanceRealmMode } from '@sva/core';

export type TenantAdminBootstrapPayload = {
  readonly username: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
};

export type TenantAdminClientPayload = {
  readonly clientId: string;
  readonly secret?: string;
};

export type InstanceMutationContext = {
  readonly actorId: string;
  readonly requestId?: string;
};

export type IdempotentInstanceMutationContext = InstanceMutationContext & {
  readonly idempotencyKey: string;
};

export type CreateInstancePayloadFields = {
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

export type ExecuteKeycloakProvisioningIntent = IamInstanceKeycloakProvisioningRun['intent'];
