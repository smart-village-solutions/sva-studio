import type { KeycloakReadState } from './provisioning-auth-types.js';
import { equalSets, readPostLogoutUris } from './provisioning-auth-utils.js';

export const readClientAlignment = (state: KeycloakReadState | undefined) => {
  const expectedClient = state?.expectedClient;
  const clientRepresentation = state?.clientRepresentation;
  return {
    clientRepresentation,
    redirectUrisMatch: expectedClient
      ? equalSets(clientRepresentation?.redirectUris ?? [], expectedClient.redirectUris)
      : false,
    logoutUrisMatch: expectedClient
      ? equalSets(
          readPostLogoutUris(clientRepresentation?.attributes),
          expectedClient.postLogoutRedirectUris
        )
      : false,
    webOriginsMatch: expectedClient
      ? equalSets(clientRepresentation?.webOrigins ?? [], expectedClient.webOrigins)
      : false,
  };
};

export const readTenantAdminClientAlignment = (state: KeycloakReadState | undefined) => {
  const expectedClient = state?.expectedTenantAdminClient;
  const clientRepresentation = state?.tenantAdminClientRepresentation;
  return {
    clientRepresentation,
    directAccessGrantsEnabledMatch: expectedClient
      ? clientRepresentation?.directAccessGrantsEnabled === expectedClient.directAccessGrantsEnabled
      : false,
    rootUrlMatch: expectedClient ? clientRepresentation?.rootUrl === expectedClient.rootUrl : false,
    redirectUrisMatch: expectedClient
      ? equalSets(clientRepresentation?.redirectUris ?? [], expectedClient.redirectUris)
      : false,
    serviceAccountsEnabledMatch: expectedClient
      ? clientRepresentation?.serviceAccountsEnabled === expectedClient.serviceAccountsEnabled
      : false,
    standardFlowEnabledMatch: expectedClient
      ? clientRepresentation?.standardFlowEnabled === expectedClient.standardFlowEnabled
      : false,
    logoutUrisMatch: expectedClient
      ? equalSets(
          readPostLogoutUris(clientRepresentation?.attributes),
          expectedClient.postLogoutRedirectUris
        )
      : false,
    webOriginsMatch: expectedClient
      ? equalSets(clientRepresentation?.webOrigins ?? [], expectedClient.webOrigins)
      : false,
  };
};
