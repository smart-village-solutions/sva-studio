import type { IncomingMessage, ServerResponse } from 'node:http';
import * as oidc from 'openid-client';
import type { PersonalMcpContext } from './config.js';
import { PersonalMcpAuthError } from './personal-auth-errors.js';
import {
  CALLBACK_HOST,
  CALLBACK_PATH,
  callbackUri,
  isLoopback,
  writeCallbackPage,
} from './personal-auth-oidc.js';

export type PersonalSession = {
  readonly contextId: string;
  readonly account: string;
  readonly subject: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken?: string;
};

export type PendingPersonalLogin = {
  readonly context: PersonalMcpContext;
  readonly configuration: oidc.Configuration;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly expiresAt: number;
  readonly timeout: NodeJS.Timeout;
};

const parseCallbackUrl = (request: IncomingMessage, port: number): URL | undefined => {
  const expectedHost = `${CALLBACK_HOST}:${port}`;
  if (
    request.method !== 'GET' ||
    !isLoopback(request.socket.remoteAddress) ||
    request.headers.host !== expectedHost
  )
    return undefined;
  if (!request.url?.startsWith('/') || request.url.startsWith('//')) return undefined;
  try {
    const callbackUrl = new URL(request.url, callbackUri(port));
    return callbackUrl.pathname === CALLBACK_PATH ? callbackUrl : undefined;
  } catch {
    return undefined;
  }
};

const finishLogin = async (
  callbackUrl: URL,
  state: string,
  pending: PendingPersonalLogin,
  pendingStateByContext: Map<string, string>,
  installSession: (
    context: PersonalMcpContext,
    session: PersonalSession,
    state: string
  ) => Promise<void>
): Promise<void> => {
  const tokenResponse = await oidc.authorizationCodeGrant(pending.configuration, callbackUrl, {
    pkceCodeVerifier: pending.codeVerifier,
    expectedState: pending.state,
    expectedNonce: pending.nonce,
  });
  const accessToken = tokenResponse.access_token;
  const subject = tokenResponse.claims()?.sub;
  if (typeof accessToken !== 'string' || typeof subject !== 'string' || !subject)
    throw new PersonalMcpAuthError('oidc_login_failed');
  const userInfo = await oidc.fetchUserInfo(pending.configuration, accessToken, subject);
  const account =
    typeof userInfo.preferred_username === 'string' ? userInfo.preferred_username : '';
  if (
    userInfo.sub !== subject ||
    !account ||
    pendingStateByContext.get(pending.context.id) !== state
  )
    throw new PersonalMcpAuthError('oidc_login_failed');
  const expiresIn = tokenResponse.expiresIn() ?? 60;
  await installSession(
    pending.context,
    {
      contextId: pending.context.id,
      account,
      subject,
      accessToken,
      accessTokenExpiresAt: Date.now() + expiresIn * 1000,
      ...(tokenResponse.refresh_token ? { refreshToken: tokenResponse.refresh_token } : {}),
    },
    state
  );
};

export const handlePersonalCallback = async (
  request: IncomingMessage,
  response: ServerResponse,
  port: number,
  pendingByState: Map<string, PendingPersonalLogin>,
  pendingStateByContext: Map<string, string>,
  installSession: (
    context: PersonalMcpContext,
    session: PersonalSession,
    state: string
  ) => Promise<void>,
  removePending: (state: string, preserveContext?: boolean) => void
): Promise<void> => {
  const callbackUrl = parseCallbackUrl(request, port);
  if (!callbackUrl) {
    writeCallbackPage(response, 404, 'Anmeldung nicht abgeschlossen.');
    return;
  }
  const state = callbackUrl.searchParams.get('state');
  const pending = state ? pendingByState.get(state) : undefined;
  if (!state || !pending || pending.expiresAt <= Date.now()) {
    if (state) removePending(state);
    writeCallbackPage(response, 400, 'Anmeldung abgelaufen. Bitte im MCP erneut starten.');
    return;
  }
  removePending(state, true);
  if (callbackUrl.searchParams.has('error') || !callbackUrl.searchParams.get('code')) {
    if (pendingStateByContext.get(pending.context.id) === state)
      pendingStateByContext.delete(pending.context.id);
    writeCallbackPage(response, 400, 'Anmeldung fehlgeschlagen. Bitte im MCP erneut starten.');
    return;
  }
  try {
    await finishLogin(callbackUrl, state, pending, pendingStateByContext, installSession);
    if (pendingStateByContext.get(pending.context.id) === state)
      pendingStateByContext.delete(pending.context.id);
    writeCallbackPage(
      response,
      200,
      'Anmeldung abgeschlossen. Dieses Browserfenster kann geschlossen werden.'
    );
  } catch {
    if (pendingStateByContext.get(pending.context.id) === state)
      pendingStateByContext.delete(pending.context.id);
    writeCallbackPage(response, 400, 'Anmeldung fehlgeschlagen. Bitte im MCP erneut starten.');
  }
};
