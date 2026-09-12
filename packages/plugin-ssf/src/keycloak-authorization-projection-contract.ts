export type KeycloakAttributes = Readonly<Record<string, readonly string[]>>;

export type KeycloakProjectionUser = Readonly<{
  externalId: string;
  attributes?: KeycloakAttributes;
}>;

export interface SsfKeycloakProjectionClient {
  listClientProtocolMappers(clientId: string): Promise<
    readonly Readonly<{
      name: string;
      protocol?: string;
      protocolMapper?: string;
      config?: Readonly<Record<string, string>>;
    }>[]
  >;
  listEffectiveClientProtocolMappers(clientId: string): Promise<
    readonly Readonly<{
      name: string;
      protocol?: string;
      protocolMapper?: string;
      config?: Readonly<Record<string, string>>;
    }>[]
  >;
  listUsers(query?: {
    readonly first?: number;
    readonly max?: number;
    readonly briefRepresentation?: boolean;
  }): Promise<readonly KeycloakProjectionUser[]>;
  updateUser(
    externalId: string,
    input: { readonly attributes: Readonly<Record<string, readonly string[]>> }
  ): Promise<void>;
  ensureUserAttributeProtocolMapper(input: {
    readonly clientId: string;
    readonly name: string;
    readonly userAttribute: string;
    readonly claimName: string;
    readonly multivalued?: boolean;
    readonly exclusiveClaim?: boolean;
  }): Promise<void>;
  setOidcClientEnabled(clientId: string, enabled: boolean): Promise<void>;
}

export type SsfKeycloakProjectionTenant = Readonly<{
  instanceId: string;
  clientId: string;
  client: SsfKeycloakProjectionClient;
}>;

export type SsfKeycloakProjectionTargetDependencies = Readonly<{
  prepareLoginClients?: (instanceId: string) => Promise<void>;
  prepareRuntimeBaseline?: (instanceId: string) => Promise<void>;
  readLoginReadiness?: (instanceId: string) => Promise<boolean>;
  resolveTenant: (instanceId: string) => Promise<SsfKeycloakProjectionTenant | null>;
  revokeSsfTenantSessions: (
    instanceId: string,
    authorizationRevision: string,
    signal: AbortSignal
  ) => Promise<void>;
  sessionRevocationTimeoutMs?: number;
}>;

export type ProjectedSubject = Readonly<{
  subject: string;
  roles: readonly string[];
  permissions: readonly string[];
  authorizationRevision: string;
}>;
