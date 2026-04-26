import type { InstanceRealmMode, InstanceStatus, IamInstanceDetail, IamInstanceListItem } from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type {
  ChangeInstanceStatusInput,
  ChangeInstanceStatusResult,
  CreateInstanceProvisioningInput,
  CreateInstanceProvisioningResult,
  ExecuteInstanceKeycloakProvisioningInput,
  ReconcileInstanceKeycloakInput,
  UpdateInstanceInput,
} from './mutation-types.js';
import type {
  KeycloakTenantPlan,
  KeycloakTenantPreflight,
  KeycloakTenantProvisioningRun,
  KeycloakTenantStatus,
  ResolveRuntimeInstanceResult,
} from './keycloak-types.js';
import type { KeycloakProvisioningInput, KeycloakReadState, TenantAdminBootstrap } from './provisioning-auth-types.js';

type KeycloakProvisioningContext = {
  instanceId: string;
  primaryHostname: string;
  realmMode: InstanceRealmMode;
  authRealm: string;
  authClientId: string;
  authIssuerUrl?: string;
  authClientSecretConfigured: boolean;
  authClientSecret?: string;
  tenantAdminClient?: {
    clientId: string;
    secretConfigured?: boolean;
  };
  tenantAdminClientSecret?: string;
  tenantAdminBootstrap?: TenantAdminBootstrap;
};

export type InstanceRegistryService = {
  listInstances(input?: { search?: string; status?: InstanceStatus }): Promise<readonly IamInstanceListItem[]>;
  getInstanceDetail(instanceId: string): Promise<IamInstanceDetail | null>;
  createProvisioningRequest(input: CreateInstanceProvisioningInput): Promise<CreateInstanceProvisioningResult>;
  updateInstance(input: UpdateInstanceInput): Promise<IamInstanceDetail | null>;
  changeStatus(input: ChangeInstanceStatusInput): Promise<ChangeInstanceStatusResult>;
  getKeycloakStatus(instanceId: string): Promise<KeycloakTenantStatus | null>;
  getKeycloakPreflight(instanceId: string): Promise<KeycloakTenantPreflight | null>;
  planKeycloakProvisioning(instanceId: string): Promise<KeycloakTenantPlan | null>;
  executeKeycloakProvisioning(input: ExecuteInstanceKeycloakProvisioningInput): Promise<KeycloakTenantProvisioningRun | null>;
  getKeycloakProvisioningRun(instanceId: string, runId: string): Promise<KeycloakTenantProvisioningRun | null>;
  reconcileKeycloak(input: ReconcileInstanceKeycloakInput): Promise<KeycloakTenantStatus | null>;
  resolveRuntimeInstance(host: string): Promise<ResolveRuntimeInstanceResult>;
  isTrafficAllowed(status: InstanceStatus): boolean;
};

export type InstanceRegistryServiceDeps = {
  readonly repository: InstanceRegistryRepository;
  readonly invalidateHost: (hostname: string) => void;
  readonly protectSecret?: (value: string | undefined, aad: string) => string | null;
  readonly revealSecret?: (value: string | null | undefined, aad: string) => string | undefined;
  readonly readKeycloakStateViaProvisioner?: (input: KeycloakProvisioningInput) => Promise<KeycloakReadState>;
  readonly provisionInstanceAuth?: (input: {
    instanceId: string;
    primaryHostname: string;
    realmMode: InstanceRealmMode;
    authRealm: string;
    authClientId: string;
    authIssuerUrl?: string;
    authClientSecret?: string;
    tenantAdminClient?: {
      clientId: string;
      secretConfigured?: boolean;
      secret?: string;
    };
    tenantAdminBootstrap?: TenantAdminBootstrap;
    tenantAdminTemporaryPassword?: string;
    rotateClientSecret?: boolean;
  }) => Promise<void>;
  readonly getKeycloakPreflight?: (input: KeycloakProvisioningContext) => Promise<KeycloakTenantPreflight>;
  readonly planKeycloakProvisioning?: (input: KeycloakProvisioningContext) => Promise<KeycloakTenantPlan>;
  readonly getKeycloakStatus?: (input: KeycloakProvisioningContext) => Promise<KeycloakTenantStatus>;
};
