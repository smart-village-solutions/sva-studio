import type { HostClassification, IamInstanceDetail, IamInstanceKeycloakProvisioningRun, IamInstanceListItem } from '@sva/core';

export type ResolveRuntimeInstanceResult = {
  readonly hostClassification: HostClassification;
  readonly instance: IamInstanceListItem | null;
};

export type KeycloakTenantStatus = NonNullable<IamInstanceDetail['keycloakStatus']>;
export type KeycloakTenantPreflight = NonNullable<IamInstanceDetail['keycloakPreflight']>;
export type KeycloakTenantPlan = NonNullable<IamInstanceDetail['keycloakPlan']>;
export type KeycloakTenantProvisioningRun = IamInstanceKeycloakProvisioningRun;
