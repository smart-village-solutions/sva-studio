import type {
  ContentJsonValue,
  IamContentListSortDirection,
  IamContentListSortField,
  IamContentStatus,
  IamContentValidationState,
} from './content-management-foundation.js';
import type { IamContentAccessSummary } from './content-management-access.js';

import type { IamContentHistoryEntry } from './content-management-ownership.js';
export * from './content-management-ownership.js';

export const iamContentAuthorDisplayModes = ['organization', 'user'] as const;
export type IamContentAuthorDisplayMode = (typeof iamContentAuthorDisplayModes)[number];
export type IamContentCredentialSource = 'organization' | 'user';
export const iamContentAuthorizationModes = ['credential_visible_compatibility', 'exact'] as const;
export type IamContentAuthorizationMode = (typeof iamContentAuthorizationModes)[number];

export type IamContentListItem = {
  readonly id: string;
  readonly contentType: string;
  readonly instanceId: string;
  readonly organizationId?: string;
  readonly ownerUserId?: string;
  readonly ownerOrganizationId?: string;
  readonly ownerDisplayName?: string;
  readonly title: string;
  readonly publishedAt?: string;
  readonly publishFrom?: string;
  readonly publishUntil?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
  readonly authorDisplayMode: IamContentAuthorDisplayMode;
  readonly author: string;
  readonly sourceDataProviderId?: string;
  readonly sourceDataProviderName?: string;
  readonly credentialSource?: IamContentCredentialSource;
  readonly credentialFingerprint?: string;
  readonly authorizationMode?: IamContentAuthorizationMode;
  readonly payload: ContentJsonValue;
  readonly status: IamContentStatus;
  readonly validationState: IamContentValidationState;
  readonly historyRef: string;
  readonly currentRevisionRef?: string;
  readonly lastAuditEventRef?: string;
  readonly access?: IamContentAccessSummary;
};

export type IamContentDetail = IamContentListItem & {
  readonly history: readonly IamContentHistoryEntry[];
};

export type IamContentListQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly q?: string;
  readonly type?: string;
  readonly languageCode?: string;
  readonly visibleTypes?: readonly string[];
  readonly status?: IamContentStatus;
  readonly sortBy: IamContentListSortField;
  readonly sortDirection: IamContentListSortDirection;
};

export type CreateIamContentInput = {
  readonly contentType: string;
  readonly title: string;
  readonly authorDisplayMode?: IamContentAuthorDisplayMode;
  readonly publishedAt?: string;
  readonly publishFrom?: string;
  readonly publishUntil?: string;
  readonly payload: ContentJsonValue;
  readonly status: IamContentStatus;
  readonly validationState?: IamContentValidationState;
};

export type UpdateIamContentInput = Partial<
  CreateIamContentInput & {
    readonly organizationId: string;
    readonly authorDisplayMode: IamContentAuthorDisplayMode;
    readonly authorDisplayName: string;
  }
>;
