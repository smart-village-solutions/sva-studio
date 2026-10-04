import type { IamInstanceListItem } from '@sva/core';

export type InstancesQuery = {
  readonly search?: string;
  readonly status?: IamInstanceListItem['status'];
};

export type CreateInstancePayload = {
  readonly instanceId: string;
  readonly displayName: string;
  readonly parentDomain: string;
  readonly realmMode: 'new' | 'existing';
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecret?: string;
  readonly tenantAdminClient?: {
    readonly clientId: string;
    readonly secret?: string;
  };
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

export type UpdateInstancePayload = {
  readonly displayName: string;
  readonly parentDomain: string;
  readonly realmMode: 'new' | 'existing';
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecret?: string;
  readonly tenantAdminClient?: {
    readonly clientId: string;
    readonly secret?: string;
  };
  readonly tenantAdminBootstrap?: {
    readonly username: string;
    readonly email?: string;
    readonly firstName?: string;
    readonly lastName?: string;
  };
  readonly themeKey?: string;
  readonly mainserverConfigRef?: string;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
  readonly accountInvitationTemplate?: {
    readonly subject: string;
    readonly body: string;
    readonly passwordSetupLinkLabel: string;
    readonly tenantHomepageLinkLabel: string;
  } | null;
  readonly accountInvitationTemplateRevision?: number;
};

export type UpdateServerAccountInvitationTemplatePayload = {
  readonly expectedRevision: number;
  readonly template: UpdateInstancePayload['accountInvitationTemplate'];
};

export type UpdateTenantAccountInvitationTemplatePayload = {
  readonly expectedRevision: number;
  readonly template: UpdateInstancePayload['accountInvitationTemplate'];
};

export type ReconcileInstanceKeycloakPayload = {
  readonly planFingerprint: string;
  readonly tenantAdminTemporaryPassword?: string;
};

export type ReconcileTenantIamRolesPayload = {
  readonly planFingerprint: string;
};

export type ExecuteInstanceKeycloakProvisioningPayload = {
  readonly intent:
    'provision' | 'provision_admin_client' | 'reset_tenant_admin' | 'rotate_client_secret';
  readonly planFingerprint: string;
  readonly tenantAdminTemporaryPassword?: string;
};
