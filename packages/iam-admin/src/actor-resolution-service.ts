import type { QueryClient } from './query-client.js';

export type ActorResolutionProvisionResult = {
  readonly accountId: string;
};

export type ActorResolutionServiceDeps = {
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
  readonly resolveActorAccountId: (
    client: QueryClient,
    params: { readonly instanceId: string; readonly keycloakSubject: string }
  ) => Promise<string | undefined>;
  readonly jitProvisionAccountWithClient: (
    client: QueryClient,
    params: {
      readonly instanceId: string;
      readonly keycloakSubject: string;
      readonly requestId?: string;
      readonly traceId?: string;
    }
  ) => Promise<ActorResolutionProvisionResult>;
  readonly resolveMissingActorDiagnosticReason: (
    client: QueryClient,
    params: { readonly instanceId: string; readonly keycloakSubject: string }
  ) => Promise<'missing_actor_account' | 'missing_instance_membership'>;
};

export type ResolveActorAccountIdWithProvisionInput = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly mayProvisionMissingActorMembership: boolean;
};

export const createActorResolutionServices = (deps: ActorResolutionServiceDeps) => {
  const resolveActorAccountIdWithProvision = async (
    input: ResolveActorAccountIdWithProvisionInput
  ): Promise<string | undefined> => {
    const existingAccountId = await deps.withInstanceScopedDb(input.instanceId, (client) =>
      deps.resolveActorAccountId(client, {
        instanceId: input.instanceId,
        keycloakSubject: input.keycloakSubject,
      })
    );
    if (existingAccountId || !input.mayProvisionMissingActorMembership) {
      return existingAccountId;
    }

    return (
      await deps.withInstanceScopedDb(input.instanceId, (client) =>
        deps.jitProvisionAccountWithClient(client, {
          instanceId: input.instanceId,
          keycloakSubject: input.keycloakSubject,
          requestId: input.requestId,
          traceId: input.traceId,
        })
      )
    ).accountId;
  };

  const resolveMissingActorDiagnosticReason = async (
    instanceId: string,
    keycloakSubject: string
  ): Promise<'missing_actor_account' | 'missing_instance_membership'> => {
    try {
      return await deps.withInstanceScopedDb(instanceId, (client) =>
        deps.resolveMissingActorDiagnosticReason(client, {
          instanceId,
          keycloakSubject,
        })
      );
    } catch {
      // Keep the original authorization failure path if the auxiliary diagnostic query fails.
      return 'missing_actor_account';
    }
  };

  return {
    resolveActorAccountIdWithProvision,
    resolveMissingActorDiagnosticReason,
  };
};
