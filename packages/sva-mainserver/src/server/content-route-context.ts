import { createHash } from 'node:crypto';

import { errorJson } from './content-route-core.js';

export type MainserverActingPrincipalType = 'organization' | 'user';

export const MAINSERVER_ACTING_PRINCIPAL_HEADER = 'x-sva-acting-principal-type';
export const MAINSERVER_CONTRACT_VERSION_HEADER = 'x-sva-mainserver-contract-version';
export const MAINSERVER_CONTRACT_VERSION = '2';
export const MAINSERVER_CONTEXT_BINDING_HEADER = 'x-sva-context-binding';
export const MAINSERVER_OPERATION_ID_HEADER = 'x-sva-operation-id';

type MainserverSessionContext = Readonly<{
  activeOrganizationId?: string;
  user: Readonly<{ id: string; instanceId?: string }>;
}>;

export const createMainserverContextBinding = (context: MainserverSessionContext): string => {
  const digest = createHash('sha256')
    .update(
      JSON.stringify([
        context.user.instanceId ?? null,
        context.user.id,
        context.activeOrganizationId ?? null,
      ])
    )
    .digest('base64url');
  return `v1.${digest}`;
};

export const withMainserverContextBinding = (
  response: Response,
  context: MainserverSessionContext
): Response => {
  const headers = new Headers(response.headers);
  headers.set(MAINSERVER_CONTEXT_BINDING_HEADER, createMainserverContextBinding(context));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const readActingPrincipalType = (
  request: Request
): MainserverActingPrincipalType | Response | undefined => {
  const value = request.headers.get(MAINSERVER_ACTING_PRINCIPAL_HEADER)?.trim();
  const contractVersion = request.headers.get(MAINSERVER_CONTRACT_VERSION_HEADER)?.trim();
  if (contractVersion && contractVersion !== MAINSERVER_CONTRACT_VERSION) {
    return errorJson(
      400,
      'unsupported_mainserver_contract_version',
      'Die Version des Mainserver-Mutationsvertrags wird nicht unterstützt.'
    );
  }
  if (value === 'organization' || value === 'user') return value;
  if (!value) {
    const transitionMode =
      process.env.SVA_MAINSERVER_ACTING_PRINCIPAL_CONTRACT_MODE?.trim().toLowerCase();
    if (transitionMode !== 'required' && contractVersion !== MAINSERVER_CONTRACT_VERSION) {
      return undefined;
    }
  }
  return errorJson(
    400,
    value ? 'invalid_acting_principal_type' : 'acting_principal_type_required',
    value
      ? 'Der Mutationsprincipal muss organization oder user sein.'
      : 'Für Mainserver-Schreibaktionen ist ein expliziter Mutationsprincipal erforderlich.'
  );
};

export const readMainserverOperationId = (request: Request): string => {
  const supplied = request.headers.get(MAINSERVER_OPERATION_ID_HEADER)?.trim();
  return supplied && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(supplied)
    ? supplied
    : globalThis.crypto.randomUUID();
};
