import type { QueryClient } from './query-client.js';

export type UpdateAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type UpdateActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type UpdateIdentityAttributes = Readonly<Record<string, string | readonly string[]>>;

export type UpdateIdentityProvider = {
  readonly provider: {
    readonly updateUser: (
      keycloakSubject: string,
      input: {
        readonly email?: string;
        readonly firstName?: string;
        readonly lastName?: string;
        readonly enabled?: boolean;
        readonly attributes?: UpdateIdentityAttributes;
      }
    ) => Promise<void>;
    readonly assignRealmRoles?: (
      keycloakSubject: string,
      roleNames: readonly string[]
    ) => Promise<void>;
    readonly removeRealmRoles?: (
      keycloakSubject: string,
      roleNames: readonly string[]
    ) => Promise<void>;
    readonly syncRoles: (keycloakSubject: string, roleNames: string[]) => Promise<void>;
  };
};

export type UpdateUserPayloadShape = {
  readonly displayName?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecret?: string;
  readonly status?: 'active' | 'inactive' | 'pending';
  readonly isTechnicalAccount?: boolean;
};

export type UserUpdatePlanShape = {
  readonly existing: {
    readonly keycloakSubject: string;
    readonly mainserverUserApplicationId?: string;
    readonly mainserverUserApplicationSecretSet?: boolean;
    readonly isTechnicalAccount: boolean;
    readonly roles?: readonly { readonly roleId: string }[];
    readonly groups?: readonly { readonly groupId: string }[];
  };
  readonly previousRoleNames: readonly string[];
  readonly nextRoleNames?: readonly string[];
};

export type UpdatedIdentityStateShape = {
  readonly existingIdentityAttributes?: UpdateIdentityAttributes;
  readonly nextIdentityAttributes?: UpdateIdentityAttributes;
  readonly nextMainserverCredentialState?: unknown;
};

export type UserMainserverCredentialStateShape = {
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecretSet: boolean;
};

export type UpdateRequestContext<
  TPayload extends UpdateUserPayloadShape,
  TIdentityProvider extends UpdateIdentityProvider = UpdateIdentityProvider,
> =
  | Response
  | {
      readonly actor: UpdateActor;
      readonly identityProvider?: TIdentityProvider;
      readonly payload: TPayload;
      readonly resolveIdentityProvider?: () => Promise<TIdentityProvider | Response>;
      readonly userId: string;
    };

export type UpdateUserHandlerDeps<
  TPayload extends UpdateUserPayloadShape = UpdateUserPayloadShape,
  TPlan extends UserUpdatePlanShape = UserUpdatePlanShape,
  TIdentityState extends UpdatedIdentityStateShape = UpdatedIdentityStateShape,
  TIdentityProvider extends UpdateIdentityProvider = UpdateIdentityProvider,
> = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly createUnexpectedMutationErrorResponse: (input: {
    readonly requestId?: string;
    readonly message: string;
  }) => Response;
  readonly createUserMutationErrorResponse: (input: {
    readonly error: unknown;
    readonly requestId?: string;
    readonly forbiddenFallbackMessage: string;
  }) => Response | null;
  readonly ensureManagedRealmRolesExist: (input: {
    readonly instanceId: string;
    readonly identityProvider: TIdentityProvider;
    readonly roleKeys: readonly string[];
    readonly actorAccountId?: string;
    readonly requestId?: string;
    readonly traceId?: string;
  }) => Promise<void>;
  readonly handleKeycloakUpdateError: (input: {
    readonly error: unknown;
    readonly requestId?: string;
  }) => Response | null;
  readonly iamUserOperationsCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly notFoundResponse: (requestId?: string) => Response;
  readonly persistUpdatedUserDetail: (input: {
    readonly instanceId: string;
    readonly requestId?: string;
    readonly traceId?: string;
    readonly actorAccountId: string;
    readonly userId: string;
    readonly keycloakSubject: string;
    readonly existingRoleIds?: readonly string[];
    readonly existingGroupIds?: readonly string[];
    readonly existingIsTechnicalAccount?: boolean;
    readonly payload: TPayload;
    readonly existingMainserverCredentialState?: UserMainserverCredentialStateShape;
    readonly nextMainserverCredentialState: TIdentityState['nextMainserverCredentialState'];
  }) => Promise<unknown | undefined>;
  readonly compensateUserIdentityUpdate: (input: {
    readonly instanceId: string;
    readonly requestId?: string;
    readonly traceId?: string;
    readonly userId: string;
    readonly plan: TPlan;
    readonly restoreIdentity: boolean;
    readonly restoreRoles: boolean;
    readonly restoreIdentityAttributes?: TIdentityState['existingIdentityAttributes'];
    readonly identityProvider?: TIdentityProvider;
  }) => Promise<void>;
  readonly resolveUpdateRequestContext: (
    request: Request,
    ctx: UpdateAuthenticatedRequestContext
  ) => Promise<UpdateRequestContext<TPayload, TIdentityProvider>>;
  readonly resolveUpdatedIdentityState: (input: {
    readonly plan: TPlan;
    readonly payload: TPayload;
    readonly identityProvider?: TIdentityProvider;
  }) => Promise<TIdentityState>;
  readonly resolveUserUpdatePlan: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly actorSubject: string;
      readonly actorRoles: readonly string[];
      readonly userId: string;
      readonly payload: TPayload;
    }
  ) => Promise<TPlan | undefined>;
  readonly trackKeycloakCall: <T>(
    operation: 'assign_realm_roles' | 'remove_realm_roles' | 'update_user',
    work: () => Promise<T>
  ) => Promise<T>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};
