import type { IamInstanceId, IamUuid } from './authorization-contract';

export type IamGovernanceCaseType =
  | 'permission_change'
  | 'delegation'
  | 'impersonation'
  | 'legal_acceptance';

export type IamGovernanceCaseListItem = {
  readonly id: IamUuid;
  readonly type: IamGovernanceCaseType;
  readonly status: string;
  readonly title: string;
  readonly summary: string;
  readonly actorAccountId?: IamUuid;
  readonly actorDisplayName?: string;
  readonly targetAccountId?: IamUuid;
  readonly targetDisplayName?: string;
  readonly roleId?: IamUuid;
  readonly roleName?: string;
  readonly ticketId?: string;
  readonly ticketSystem?: string;
  readonly reasonCode?: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly expiresAt?: string;
  readonly approvedAt?: string;
  readonly resolvedAt?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
};

export type IamDsrCaseType =
  | 'request'
  | 'export_job'
  | 'legal_hold'
  | 'profile_correction'
  | 'recipient_notification';

export type IamDsrCanonicalStatus = 'queued' | 'in_progress' | 'completed' | 'blocked' | 'failed';

export type IamDsrCaseListItem = {
  readonly id: IamUuid;
  readonly type: IamDsrCaseType;
  readonly canonicalStatus: IamDsrCanonicalStatus;
  readonly rawStatus: string;
  readonly title: string;
  readonly summary: string;
  readonly requestType?: string;
  readonly targetAccountId?: IamUuid;
  readonly targetDisplayName?: string;
  readonly requesterAccountId?: IamUuid;
  readonly requesterDisplayName?: string;
  readonly actorAccountId?: IamUuid;
  readonly actorDisplayName?: string;
  readonly format?: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly completedAt?: string;
  readonly blockedReason?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
};

export type IamSelfServiceActivityType = IamDsrCaseType | 'legal_acceptance';

export type IamSelfServiceActivityItem = {
  readonly id: IamUuid;
  readonly source: 'dsr' | 'governance';
  readonly type: IamSelfServiceActivityType;
  readonly canonicalStatus: IamDsrCanonicalStatus;
  readonly rawStatus: string;
  readonly title: string;
  readonly summary: string;
  readonly format?: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly completedAt?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
};

export type IamDsrSelfServiceOverview = {
  readonly instanceId: IamInstanceId;
  readonly accountId: IamUuid;
  readonly processingRestrictedAt?: string;
  readonly processingRestrictionReason?: string;
  readonly nonEssentialProcessingOptOutAt?: string;
  readonly nonEssentialProcessingAllowed: boolean;
  readonly legalHolds: readonly IamDsrCaseListItem[];
  readonly requests: readonly IamDsrCaseListItem[];
  readonly exportJobs: readonly IamDsrCaseListItem[];
  readonly activityItems: readonly IamSelfServiceActivityItem[];
};

export type IamDeletionContentStrategy =
  | 'retain'
  | 'with_owner_lifecycle';

export type IamDeletionLifecycleState = 'active' | 'deactivated' | 'pseudonymized' | 'deleted';

export type IamTenantDeletionRulesOverview = {
  readonly instanceId: IamInstanceId;
  readonly deactivateAfterDays: number;
  readonly pseudonymizeAfterDays: number;
  readonly deleteAfterDays: number;
  readonly defaultContentStrategy: IamDeletionContentStrategy;
  readonly allowContentPreferenceOverride: boolean;
  readonly canEdit: boolean;
};

export type IamMyDeletionRulesOverview = {
  readonly instanceId: IamInstanceId;
  readonly lastLoginAt?: string;
  readonly lifecycleState: IamDeletionLifecycleState;
  readonly rules: IamTenantDeletionRulesOverview;
  readonly contentPreference: {
    readonly isOverridden: boolean;
    readonly effectiveStrategy: IamDeletionContentStrategy;
    readonly overrideStrategy?: IamDeletionContentStrategy;
  };
};

export type IamUserTimelineEventCategory = 'iam' | 'governance' | 'dsr';

export type IamUserTimelinePerspective = 'actor' | 'target' | 'actor_and_target';

export type IamUserTimelineEvent = {
  readonly id: string;
  readonly category: IamUserTimelineEventCategory;
  readonly eventType: string;
  readonly title: string;
  readonly description: string;
  readonly occurredAt: string;
  readonly perspective: IamUserTimelinePerspective;
  readonly relatedEntityId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
};
