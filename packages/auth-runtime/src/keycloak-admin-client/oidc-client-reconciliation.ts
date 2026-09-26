import { KeycloakAdminRequestError } from './errors.js';

export type KeycloakOidcClientRepresentation = {
  readonly id: string;
  readonly clientId: string;
  readonly name?: string;
  readonly enabled?: boolean;
  readonly protocol?: string;
  readonly publicClient?: boolean;
  readonly standardFlowEnabled?: boolean;
  readonly implicitFlowEnabled?: boolean;
  readonly directAccessGrantsEnabled?: boolean;
  readonly serviceAccountsEnabled?: boolean;
  readonly redirectUris?: readonly string[];
  readonly webOrigins?: readonly string[];
  readonly rootUrl?: string;
  readonly baseUrl?: string;
  readonly adminUrl?: string;
  readonly attributes?: Readonly<Record<string, string>>;
};

export type EnsureOidcClientInput = {
  readonly clientId: string;
  readonly redirectUris: readonly string[];
  readonly postLogoutRedirectUris: readonly string[];
  readonly webOrigins: readonly string[];
  readonly rootUrl: string;
  readonly clientSecret?: string;
  readonly rotateClientSecret?: boolean;
  readonly standardFlowEnabled?: boolean;
  readonly implicitFlowEnabled?: boolean;
  readonly directAccessGrantsEnabled?: boolean;
  readonly serviceAccountsEnabled?: boolean;
  readonly enabled?: boolean;
  readonly uriPolicy?: 'merge' | 'replace';
  readonly publicClient?: boolean;
  readonly pkceCodeChallengeMethod?: 'S256';
  readonly accessTokenLifespan?: 900;
  readonly ownership?: Readonly<{ instanceId: string; artifactKey: string }>;
};

type OidcClientPayload = {
  readonly clientId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly protocol: string;
  readonly publicClient: boolean;
  readonly standardFlowEnabled: boolean;
  readonly implicitFlowEnabled: boolean;
  readonly directAccessGrantsEnabled: boolean;
  readonly serviceAccountsEnabled: boolean;
  readonly redirectUris: readonly string[];
  readonly webOrigins: readonly string[];
  readonly attributes: Record<string, string> & { 'post.logout.redirect.uris': string };
  readonly rootUrl: string;
  readonly baseUrl: string;
  readonly adminUrl: string;
};

export type KeycloakOidcClientOperations = {
  readonly assertWriteAvailability: () => Promise<void>;
  readonly findClient: (clientId: string) => Promise<KeycloakOidcClientRepresentation | null>;
  readonly createClient: (payload: OidcClientPayload, clientId: string) => Promise<string | null>;
  readonly updateClient: (existing: KeycloakOidcClientRepresentation, payload: object, clientId: string) => Promise<void>;
  readonly deleteClientForCompensation: (clientId: string, displayClientId: string) => Promise<void>;
  readonly logCompensationFailure: (clientId: string, error: unknown) => void;
  readonly getClientSecretValue: (clientId: string) => Promise<string | null>;
  readonly rotateClientSecret: (client: KeycloakOidcClientRepresentation, input: Pick<EnsureOidcClientInput, 'clientId' | 'clientSecret' | 'rotateClientSecret'>) => Promise<void>;
};

const toSortedUniqueStrings = (values: readonly string[] | undefined): string[] =>
  [
    ...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)),
  ].sort((left, right) => left.localeCompare(right));

const mergeSortedUniqueStrings = (left: readonly string[] | undefined, right: readonly string[] | undefined): string[] =>
  toSortedUniqueStrings([...(left ?? []), ...(right ?? [])]);

const areStringSetsEqual = (left: readonly string[] | undefined, right: readonly string[] | undefined): boolean => {
  const normalizedLeft = toSortedUniqueStrings(left);
  const normalizedRight = toSortedUniqueStrings(right);
  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

const readPostLogoutRedirectUris = (attributes: Readonly<Record<string, string>> | undefined): readonly string[] => {
  const raw = attributes?.['post.logout.redirect.uris'];
  return raw
    ? raw
        .split('##')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];
};

const assertValidOidcClientInput = (input: EnsureOidcClientInput): void => {
  if (input.publicClient && (input.clientSecret || input.rotateClientSecret || input.serviceAccountsEnabled)) {
    throw new Error('public_oidc_client_secret_or_service_account_forbidden');
  }
};

const buildPayload = (
  existing: KeycloakOidcClientRepresentation | null,
  input: EnsureOidcClientInput
): OidcClientPayload => ({
  clientId: input.clientId,
  name: input.clientId,
  enabled: input.enabled ?? true,
  protocol: 'openid-connect',
  publicClient: input.publicClient ?? false,
  standardFlowEnabled: input.standardFlowEnabled ?? true,
  implicitFlowEnabled: input.implicitFlowEnabled ?? existing?.implicitFlowEnabled ?? false,
  directAccessGrantsEnabled: input.directAccessGrantsEnabled ?? false,
  serviceAccountsEnabled: input.serviceAccountsEnabled ?? false,
  redirectUris:
    input.uriPolicy === 'replace'
      ? [...input.redirectUris]
      : mergeSortedUniqueStrings(existing?.redirectUris, input.redirectUris),
  webOrigins:
    input.uriPolicy === 'replace'
      ? [...input.webOrigins]
      : mergeSortedUniqueStrings(existing?.webOrigins, input.webOrigins),
  attributes: {
    ...existing?.attributes,
    ...(input.ownership
      ? {
          managed_by: 'studio',
          instance_id: input.ownership.instanceId,
          artifact_key: input.ownership.artifactKey,
        }
      : {}),
    ...(input.pkceCodeChallengeMethod
      ? { 'pkce.code.challenge.method': input.pkceCodeChallengeMethod }
      : {}),
    ...(input.accessTokenLifespan
      ? { 'access.token.lifespan': String(input.accessTokenLifespan) }
      : {}),
    'post.logout.redirect.uris': (input.uriPolicy === 'replace'
      ? [...input.postLogoutRedirectUris]
      : mergeSortedUniqueStrings(
          readPostLogoutRedirectUris(existing?.attributes),
          input.postLogoutRedirectUris
        )
    ).join('##'),
  },
  rootUrl: input.rootUrl,
  baseUrl: '/',
  adminUrl: input.rootUrl,
});

const requiresUpdate = (
  existing: KeycloakOidcClientRepresentation,
  payload: OidcClientPayload
): boolean =>
  existing.enabled !== payload.enabled ||
  existing.protocol !== payload.protocol ||
  existing.publicClient !== payload.publicClient ||
  existing.rootUrl !== payload.rootUrl ||
  existing.standardFlowEnabled !== payload.standardFlowEnabled ||
  existing.implicitFlowEnabled !== payload.implicitFlowEnabled ||
  existing.directAccessGrantsEnabled !== payload.directAccessGrantsEnabled ||
  existing.serviceAccountsEnabled !== payload.serviceAccountsEnabled ||
  existing.attributes?.['pkce.code.challenge.method'] !==
    payload.attributes['pkce.code.challenge.method'] ||
  existing.attributes?.['access.token.lifespan'] !== payload.attributes['access.token.lifespan'] ||
  !areStringSetsEqual(existing.redirectUris, payload.redirectUris) ||
  !areStringSetsEqual(existing.webOrigins, payload.webOrigins) ||
  !areStringSetsEqual(
    readPostLogoutRedirectUris(existing.attributes),
    readPostLogoutRedirectUris(payload.attributes)
  );

const assertOwnership = (
  existing: KeycloakOidcClientRepresentation | null,
  input: EnsureOidcClientInput
): void => {
  if (!existing || !input.ownership) return;
  const owned =
    existing.attributes?.managed_by === 'studio' &&
    existing.attributes.instance_id === input.ownership.instanceId &&
    existing.attributes.artifact_key === input.ownership.artifactKey;
  if (!owned) {
    throw new KeycloakAdminRequestError({
      message: `Keycloak client ${input.clientId} has conflicting or incomplete Studio ownership metadata.`,
      statusCode: 409,
      code: 'client_ownership_conflict',
      retryable: false,
    });
  }
};

const upsertClient = async (
  operations: KeycloakOidcClientOperations,
  existing: KeycloakOidcClientRepresentation | null,
  payload: OidcClientPayload,
  clientId: string
): Promise<string | null> => {
  if (!existing) return operations.createClient(payload, clientId);
  if (requiresUpdate(existing, payload)) await operations.updateClient(existing, payload, clientId);
  return null;
};

const reconcileCreatedClientDefaults = async (
  operations: KeycloakOidcClientOperations,
  existing: KeycloakOidcClientRepresentation | null,
  createdClientId: string | null,
  payload: OidcClientPayload,
  input: EnsureOidcClientInput
): Promise<void> => {
  const hasEmptyAllowlist = payload.redirectUris.length === 0 || payload.webOrigins.length === 0;
  if (existing || (input.uriPolicy !== 'replace' && !hasEmptyAllowlist)) return;

  let created: KeycloakOidcClientRepresentation | null;
  try {
    created = await operations.findClient(input.clientId);
  } catch (error) {
    return compensateCreatedClient(operations, createdClientId, input.clientId, error);
  }
  if (!created) return compensateCreatedClient(
      operations,
      createdClientId,
      input.clientId,
      new KeycloakAdminRequestError({
        message: `Keycloak client ${input.clientId} is missing after creation.`,
        statusCode: 502,
        code: 'client_readback_failed',
        retryable: false,
      })
  );
  try {
    await upsertClient(
      operations,
      created,
      { ...payload, attributes: { ...created.attributes, ...payload.attributes } },
      input.clientId
    );
  } catch (error) {
    await compensateCreatedClient(operations, created.id, input.clientId, error);
  }
};

const compensateCreatedClient = async (
  operations: KeycloakOidcClientOperations,
  createdClientId: string | null,
  clientId: string,
  originalError: unknown
): Promise<never> => {
  if (!createdClientId) {
    const cleanupError = new Error('created_client_id_unavailable_for_cleanup');
    operations.logCompensationFailure(clientId, cleanupError);
    const manualActionError = new Error('strict_oidc_client_reconciliation_failed_cleanup_failed_requires_manual_action') as Error & { cause?: unknown };
    manualActionError.cause = cleanupError;
    throw manualActionError;
  }
  try {
    await operations.deleteClientForCompensation(createdClientId, clientId);
  } catch (cleanupError) {
    const manualActionError = new Error(
      'strict_oidc_client_reconciliation_failed_cleanup_failed_requires_manual_action'
    ) as Error & { cause?: unknown };
    manualActionError.cause = cleanupError;
    throw manualActionError;
  }
  throw originalError;
};

const reconcileSecret = async (
  operations: KeycloakOidcClientOperations,
  existing: KeycloakOidcClientRepresentation | null,
  input: EnsureOidcClientInput
): Promise<void> => {
  if (input.publicClient || !input.rotateClientSecret) return;
  const client = existing ?? (await operations.findClient(input.clientId));
  if (!client) {
    throw new KeycloakAdminRequestError({
      message: 'Keycloak client secret could not be updated because the client is missing.',
      statusCode: 404,
      code: 'client_not_found',
      retryable: false,
    });
  }
  const currentSecret = await operations.getClientSecretValue(input.clientId);
  if (input.rotateClientSecret || currentSecret !== input.clientSecret) {
    await operations.rotateClientSecret(client, input);
  }
};

export const reconcileOidcClient = async (
  operations: KeycloakOidcClientOperations,
  input: EnsureOidcClientInput
): Promise<void> => {
  assertValidOidcClientInput(input);
  await operations.assertWriteAvailability();
  const existing = await operations.findClient(input.clientId);
  assertOwnership(existing, input);
  const payload = buildPayload(existing, input);
  const createdClientId = await upsertClient(operations, existing, payload, input.clientId);
  await reconcileCreatedClientDefaults(operations, existing, createdClientId, payload, input);
  await reconcileSecret(operations, existing, input);
};

export const setOidcClientEnabled = async (
  operations: KeycloakOidcClientOperations,
  clientId: string,
  enabled: boolean
): Promise<void> => {
  await operations.assertWriteAvailability();
  const existing = await operations.findClient(clientId);
  if (!existing) {
    throw new KeycloakAdminRequestError({
      message: `Keycloak client ${clientId} is missing.`,
      statusCode: 404,
      code: 'client_not_found',
      retryable: false,
    });
  }
  if (existing.enabled === enabled) return;
  await operations.updateClient(existing, { ...existing, enabled }, clientId);
};
