export type UpdateUserPersistencePayload = {
  readonly email?: string;
  readonly displayName?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly position?: string;
  readonly department?: string;
  readonly avatarUrl?: string;
  readonly preferredLanguage?: string;
  readonly timezone?: string;
  readonly status?: 'active' | 'inactive' | 'pending';
  readonly notes?: string;
  readonly roleIds?: readonly string[];
  readonly groupIds?: readonly string[];
  readonly isTechnicalAccount?: boolean;
};

export type UserMainserverCredentialState = {
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecretSet: boolean;
};

export type UserUpdateActivityLogInput = {
  readonly instanceId: string;
  readonly accountId?: string;
  readonly subjectId?: string;
  readonly eventType: 'user.updated';
  readonly result: 'success';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly requestId?: string;
  readonly traceId?: string;
};
