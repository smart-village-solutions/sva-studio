import type {
  ApiListResponse,
  CreateIamContentInput,
  IamContentListItem,
  UpdateIamContentInput,
} from '@sva/core';

export type CreateContentPayload = CreateIamContentInput;

export type UpdateContentPayload = UpdateIamContentInput;

export type IamContentProjectionSyncState = Readonly<{
  contentType:
    | 'news.article'
    | 'events.event-record'
    | 'poi.point-of-interest'
    | 'generic-items.generic-item'
    | 'surveys.survey';
  lastStartedAt?: string;
  lastSucceededAt?: string;
  lastFailedAt?: string;
  lastErrorCode?: string;
  isStale: boolean;
  isSyncRunning: boolean;
  hasSnapshot: boolean;
  snapshotState?:
    | 'empty'
    | 'partial_running'
    | 'partial_failed'
    | 'complete_fresh'
    | 'complete_refreshing'
    | 'complete_failed';
  refreshPhase?: 'hot' | 'reconciliation';
  completedPage?: number;
  availableCount?: number;
  isTotalFinal?: boolean;
  skippedInvalidCount?: number;
}>;

export type IamContentListMetadata = Readonly<{
  mainserverSyncStates: readonly IamContentProjectionSyncState[];
  hasStaleMainserverContent: boolean;
  hasBlockingSyncGap: boolean;
  hasRunningMainserverSync: boolean;
  availableCount?: number;
  totalCount?: number;
  isTotalFinal?: boolean;
}>;

export type IamContentListResponse = ApiListResponse<IamContentListItem> &
  Readonly<{
    metadata?: IamContentListMetadata;
  }>;

export type RefreshProjectedContentsPayload = Readonly<{
  visibleTypes?: readonly string[];
  force?: boolean;
}>;

export type RefreshProjectedContentsResult = Readonly<{
  status: 'accepted' | 'already_running' | 'completed' | 'failed';
  syncStates: readonly IamContentProjectionSyncState[];
}>;

export type MainserverAuthoringDiagnostics = Readonly<{
  bindings: Readonly<{
    byStatus: Readonly<Record<string, number>>;
    byPrincipalType: Readonly<Record<string, number>>;
    rotationPrincipalCount: number;
    recent: readonly Readonly<{
      principalType: 'organization' | 'user';
      principalId: string;
      credentialFingerprintPrefix: string;
      dataProviderId: string;
      status: 'pending' | 'verified' | 'conflict' | 'historical' | 'revoked';
      evidenceKind: 'create_response' | 'create_reread' | 'identity_endpoint';
      lastObservedAt: string;
    }>[];
  }>;
  mutations: Readonly<{
    byAuthorizationMode: Readonly<Record<string, number>>;
    byResolverMode: Readonly<Record<string, number>>;
    byReconciliationStatus: Readonly<Record<string, number>>;
    automaticModeSwitchCount: number;
    shadowDifferenceCount: number;
    recent: readonly Readonly<{
      operationExternalId: string;
      actionId: string;
      contentType: string;
      contentId?: string;
      actingPrincipalType: 'organization' | 'user';
      credentialFingerprintPrefix: string;
      authorizationMode: 'credential_visible_compatibility' | 'exact';
      resolverMode: 'automatic' | 'compatibility' | 'shadow';
      candidateAuthorizationMode?: 'credential_visible_compatibility' | 'exact';
      candidateAllowed?: boolean;
      shadowDifference: boolean;
      providerOutcome: 'pending' | 'succeeded' | 'failed' | 'unknown';
      reconciliationStatus: 'complete' | 'failed' | 'pending' | 'reconciliation_required';
      attemptCount: number;
      lastErrorCode?: string;
      updatedAt: string;
    }>[];
  }>;
}>;
