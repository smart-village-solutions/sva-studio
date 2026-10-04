export type SvaMainserverProviderKey = 'sva_mainserver';
export type SvaMainserverVerificationStatus = 'ok' | 'error' | 'disabled';

export type SvaMainserverErrorCode =
  | 'config_not_found'
  | 'integration_disabled'
  | 'invalid_config'
  | 'database_unavailable'
  | 'identity_provider_unavailable'
  | 'missing_credentials'
  | 'organization_mainserver_credentials_missing'
  | 'acting_principal_not_allowed'
  | 'credential_context_changed'
  | 'token_request_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'network_error'
  | 'graphql_error'
  | 'invalid_response'
  | 'category_management_invalid_response'
  | 'category_management_access_denied'
  | 'not_found';

export type SvaMainserverInstanceConfig = {
  readonly instanceId: string;
  readonly providerKey: SvaMainserverProviderKey;
  readonly graphqlBaseUrl: string;
  readonly oauthTokenUrl: string;
  readonly enabled: boolean;
  readonly lastVerifiedAt?: string;
  readonly lastVerifiedStatus?: SvaMainserverVerificationStatus;
};

export type SvaMainserverConnectionStatus = {
  readonly status: 'connected' | 'error';
  readonly checkedAt: string;
  readonly config?: SvaMainserverInstanceConfig;
  readonly queryRootTypename?: string;
  readonly mutationRootTypename?: string;
  readonly errorCode?: SvaMainserverErrorCode;
  readonly errorMessage?: string;
};

export type SvaMainserverConnectionInput = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
  readonly actingPrincipalType?: 'organization' | 'user';
  readonly credentialFingerprint?: string;
};

export type SvaMainserverOwnershipTransferContent =
  | Readonly<{ type: 'news'; id: string }>
  | Readonly<{ type: 'event'; id: string }>
  | Readonly<{ type: 'poi'; id: string }>
  | Readonly<{ type: 'generic-item'; id: string }>;

export type SvaMainserverOwnershipTransferInput = SvaMainserverConnectionInput &
  Readonly<{
    content: SvaMainserverOwnershipTransferContent;
    expectedSourceDataProviderId: string;
    targetDataProviderId: string;
  }>;

export type SvaMainserverOwnershipTransferResult = Readonly<{
  contentType: SvaMainserverOwnershipTransferContent['type'];
  contentId: string;
  sourceDataProviderId: string;
  targetDataProviderId: string;
}>;

export type MainserverDataDeviation = Readonly<{
  fieldPath: string;
  fieldGroup: string;
  code:
    'unexpected_type' | 'unsupported_value' | 'optional_dependency_failed' | 'preservation_limited';
  phase: 'read' | 'enrichment' | 'write';
  handling: 'defaulted' | 'omitted' | 'preserved_readonly' | 'temporarily_unavailable' | 'blocked';
  retryable: boolean;
}>;

export type MainserverDetailResult<TItem> = Readonly<{
  data: TItem;
  deviations: readonly MainserverDataDeviation[];
}>;

export type SvaMainserverStaticContentInput = {
  readonly name: string;
  readonly content: string;
};

export type SvaMainserverListQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly includeInvisible?: boolean;
  readonly genericItemScanOffset?: number;
};

export type SvaMainserverNewsListInput = SvaMainserverListQuery & {
  readonly visibilityFilter?: 'all' | 'visible' | 'hidden';
  readonly editorialStatusFilter?: 'all' | 'draft' | 'scheduled' | 'published';
  readonly orderBy?: 'publishedAt_DESC' | 'updatedAt_DESC';
};

export type SvaMainserverListPagination = {
  readonly page: number;
  readonly pageSize: number;
  readonly hasNextPage: boolean;
  readonly total?: number;
  readonly nextGenericItemScanOffset?: number;
};

export type SvaMainserverListResult<TItem> = {
  readonly data: readonly TItem[];
  readonly pagination: SvaMainserverListPagination;
  readonly credentialSource?: 'organization' | 'user';
};
