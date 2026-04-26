export type SvaMainserverProviderKey = 'sva_mainserver';

export type SvaMainserverErrorCode =
  | 'config_not_found'
  | 'integration_disabled'
  | 'invalid_config'
  | 'database_unavailable'
  | 'identity_provider_unavailable'
  | 'missing_credentials'
  | 'token_request_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'network_error'
  | 'graphql_error'
  | 'invalid_response'
  | 'not_found';

export type SvaMainserverInstanceConfig = {
  readonly instanceId: string;
  readonly providerKey: SvaMainserverProviderKey;
  readonly graphqlBaseUrl: string;
  readonly oauthTokenUrl: string;
  readonly enabled: boolean;
  readonly lastVerifiedAt?: string;
  readonly lastVerifiedStatus?: string;
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
};

export type SvaMainserverNewsPayload = {
  readonly teaser: string;
  readonly body: string;
  readonly imageUrl?: string;
  readonly externalUrl?: string;
  readonly category?: string;
};

export type SvaMainserverNewsItem = {
  readonly id: string;
  readonly title: string;
  readonly contentType: 'news.article';
  readonly payload: SvaMainserverNewsPayload;
  readonly status: 'published';
  readonly author: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string;
};

export type SvaMainserverNewsInput = {
  readonly title: string;
  readonly publishedAt: string;
  readonly payload: SvaMainserverNewsPayload;
};
