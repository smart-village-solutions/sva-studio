import type { SqlPrimitive } from '../iam/repositories/types.js';

import type { InstanceRegistryRepository } from './repository-contract.js';

type MutationRepository = Pick<
  InstanceRegistryRepository,
  'createInstance' | 'updateInstance'
>;
type CreateInstanceInput = Parameters<MutationRepository['createInstance']>[0];
type UpdateInstanceInput = Parameters<MutationRepository['updateInstance']>[0];

type CreateAuthClientValues = readonly [
  issuerUrl: string | null,
  secretCiphertext: string | null,
];
type UpdateAuthClientValues = readonly [
  issuerUrl: string | null,
  keepSecret: boolean,
  secretCiphertext: string | null,
];
type CreateTenantAdminClientValues = readonly [
  clientId: string | null,
  secretCiphertext: string | null,
];
type UpdateTenantAdminClientValues = readonly [
  clientId: string | null,
  keepSecret: boolean,
  secretCiphertext: string | null,
];
type TenantAdminBootstrapValues = readonly [
  username: string | null,
  email: string | null,
  firstName: string | null,
  lastName: string | null,
];
type InstanceConfigurationValues = readonly [
  themeKey: string | null,
  featureFlags: string,
  mainserverConfigRef: string | null,
  actorId: string,
];

const defaultActorId = (actorId: string | undefined): string => actorId ?? 'system';

const secretMutationValues = (
  keepExisting: boolean | undefined,
  ciphertext: string | null | undefined
): readonly [keepSecret: boolean, secretCiphertext: string | null] => [
  keepExisting !== false && typeof ciphertext === 'undefined',
  ciphertext ?? null,
];

const createAuthClientValues = (input: CreateInstanceInput): CreateAuthClientValues => [
  input.authIssuerUrl ?? null,
  input.authClientSecretCiphertext ?? null,
];

const updateAuthClientValues = (input: UpdateInstanceInput): UpdateAuthClientValues => {
  const secretValues = secretMutationValues(
    input.keepExistingAuthClientSecret,
    input.authClientSecretCiphertext
  );
  return [input.authIssuerUrl ?? null, ...secretValues];
};

const createTenantAdminClientValues = (
  input: CreateInstanceInput
): CreateTenantAdminClientValues => [
  input.tenantAdminClient?.clientId ?? null,
  input.tenantAdminClient?.secretCiphertext ?? null,
];

const updateTenantAdminClientValues = (
  input: UpdateInstanceInput
): UpdateTenantAdminClientValues => {
  const secretValues = secretMutationValues(
    input.keepExistingTenantAdminClientSecret,
    input.tenantAdminClient?.secretCiphertext
  );
  return [input.tenantAdminClient?.clientId ?? null, ...secretValues];
};

const tenantAdminBootstrapValues = (
  input: CreateInstanceInput | UpdateInstanceInput
): TenantAdminBootstrapValues => {
  const {
    username = null,
    email = null,
    firstName = null,
    lastName = null,
  } = input.tenantAdminBootstrap ?? {};
  return [username, email, firstName, lastName];
};

const instanceConfigurationValues = (
  input: CreateInstanceInput | UpdateInstanceInput
): InstanceConfigurationValues => [
  input.themeKey ?? null,
  JSON.stringify(input.featureFlags ?? {}),
  input.mainserverConfigRef ?? null,
  defaultActorId(input.actorId),
];

export const createInstanceValues = (input: CreateInstanceInput): readonly SqlPrimitive[] => [
  input.instanceId,
  input.displayName,
  input.status,
  input.parentDomain,
  input.primaryHostname,
  input.realmMode,
  input.authRealm,
  input.authClientId,
  ...createAuthClientValues(input),
  ...createTenantAdminClientValues(input),
  ...tenantAdminBootstrapValues(input),
  ...instanceConfigurationValues(input),
];

export const updateInstanceValues = (input: UpdateInstanceInput): readonly SqlPrimitive[] => [
  input.instanceId,
  input.displayName,
  input.parentDomain,
  input.primaryHostname,
  input.realmMode,
  input.authRealm,
  input.authClientId,
  ...updateAuthClientValues(input),
  ...updateTenantAdminClientValues(input),
  ...tenantAdminBootstrapValues(input),
  ...instanceConfigurationValues(input),
];
