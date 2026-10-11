import type { EffectivePermission } from '@sva/iam-core';

type Decision = Readonly<{ allowed: boolean; reason: string }>;

type AuthorizedRequest = Readonly<{
  pluginId: string;
  handlerId: string;
  instanceId: string;
  keycloakSubject: string;
  permissions: readonly EffectivePermission[];
  decisions: ReadonlyMap<string, Decision>;
}>;

const authorizedRequests = new WeakMap<Request, AuthorizedRequest>();

export const setAuthorizedPluginRequest = (
  request: Request,
  authorization: AuthorizedRequest
): void => {
  authorizedRequests.set(request, authorization);
};

export const getAuthorizedPluginRequest = (input: {
  request?: Request;
  pluginId: string;
  handlerId?: string;
  instanceId: string;
  keycloakSubject: string;
}): AuthorizedRequest | null => {
  if (!input.request || !input.handlerId) return null;
  const authorization = authorizedRequests.get(input.request);
  return authorization?.pluginId === input.pluginId &&
    authorization.handlerId === input.handlerId &&
    authorization.instanceId === input.instanceId &&
    authorization.keycloakSubject === input.keycloakSubject
    ? authorization
    : null;
};

export const clearAuthorizedPluginRequest = (request: Request): void => {
  authorizedRequests.delete(request);
};
