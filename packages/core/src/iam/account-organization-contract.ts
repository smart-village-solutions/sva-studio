import type { IamUuid } from '@sva/iam-core';

export type IamOrganizationType =
  | 'county'
  | 'municipality'
  | 'district'
  | 'company'
  | 'agency'
  | 'association'
  | 'institution'
  | 'other';

export type IamContentAuthorPolicy = 'org_only' | 'org_or_personal';

export type IamOrganizationMembershipVisibility = 'internal' | 'external';

export type IamOrganizationListItem = {
  readonly id: IamUuid;
  readonly organizationKey: string;
  readonly displayName: string;
  readonly parentOrganizationId?: IamUuid;
  readonly parentDisplayName?: string;
  readonly organizationType: IamOrganizationType;
  readonly contentAuthorPolicy: IamContentAuthorPolicy;
  readonly isActive: boolean;
  readonly depth: number;
  readonly hierarchyPath: readonly IamUuid[];
  readonly childCount: number;
  readonly membershipCount: number;
};

export type IamOrganizationMembership = {
  readonly accountId: IamUuid;
  readonly keycloakSubject: string;
  readonly displayName: string;
  readonly email?: string;
  readonly visibility: IamOrganizationMembershipVisibility;
  readonly isDefaultContext: boolean;
  readonly createdAt: string;
};

export type IamUserOrganizationMembership = {
  readonly organizationId: IamUuid;
  readonly organizationKey: string;
  readonly displayName: string;
  readonly organizationType: IamOrganizationType;
  readonly isActive: boolean;
  readonly visibility: IamOrganizationMembershipVisibility;
  readonly isDefaultContext: boolean;
  readonly createdAt: string;
};

export type IamOrganizationChildItem = {
  readonly id: IamUuid;
  readonly organizationKey: string;
  readonly displayName: string;
  readonly isActive: boolean;
};

export type IamOrganizationDetail = IamOrganizationListItem & {
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly memberships: readonly IamOrganizationMembership[];
  readonly children: readonly IamOrganizationChildItem[];
  readonly mainserverApplicationId?: string;
  readonly mainserverApplicationSecretSet: boolean;
  readonly mainserverProvisioning: IamOrganizationMainserverProvisioningState;
};

export type IamOrganizationMainserverProvisioningStatus =
  | 'not_provisioned'
  | 'account_ready'
  | 'provisioning'
  | 'verification_required'
  | 'ready'
  | 'failed'
  | 'reconciliation_required';

export type IamOrganizationMainserverProvisioningState = {
  readonly status: IamOrganizationMainserverProvisioningStatus;
  readonly technicalAccountId?: IamUuid;
  readonly phase?: string;
  readonly attemptCount: number;
  readonly lastErrorCode?: string;
  readonly lastAttemptAt?: string;
  readonly completedAt?: string;
  readonly lastVerifiedAt?: string;
  readonly operationInProgress: boolean;
};

export type IamOrganizationContextOption = {
  readonly organizationId: IamUuid;
  readonly organizationKey: string;
  readonly displayName: string;
  readonly organizationType: IamOrganizationType;
  readonly contentAuthorPolicy: IamContentAuthorPolicy;
  readonly isActive: boolean;
  readonly isDefaultContext: boolean;
};

export type IamOrganizationContext = {
  readonly activeOrganizationId?: IamUuid;
  readonly organizations: readonly IamOrganizationContextOption[];
};
