import { withRequestContext } from '@sva/server-runtime';
import { resolveAuthConfigForRequest } from './config.js';
import { readCookieFromRequest } from './cookies.js';
import { getScopeFromAuthConfig } from './scope.js';
import { isMockAuthEnabled } from './mock-auth.js';
import { createRedirectResponse, createAuthDependencyErrorResponse } from './auth-route-responses.js';
import { resolveCallbackInput, resolveCookieLoginState, type CallbackDependencies } from './auth-route-state.js';
import { handleCallbackErrorResponse, handleCancelledAccountActionResponse, handleExpiredCallbackState } from './auth-route-callback-errors.js';
import { completeCallbackExchange } from './auth-route-callback-final.js';

export const callbackHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (isMockAuthEnabled()) {
      return createRedirectResponse('/?auth=mock-callback');
    }

    try {
      const callbackInput = resolveCallbackInput(request);
      const { code, state } = callbackInput;
      const authConfig = await resolveAuthConfigForRequest(request);
      const authScope = getScopeFromAuthConfig(authConfig);
      const { sessionCookieName } = authConfig;
      const cookieLoginState = state ? await resolveCookieLoginState(request, state) : null;
      const hadSessionCookieOnCallback = Boolean(readCookieFromRequest(request, sessionCookieName));
      const dependencies: CallbackDependencies = {
        authConfig,
        authScope,
        cookieLoginState,
        hadSessionCookieOnCallback,
        callbackInput,
      };

      const cancelledAccountActionResponse = await handleCancelledAccountActionResponse(
        request,
        dependencies
      );
      if (cancelledAccountActionResponse) {
        return cancelledAccountActionResponse;
      }

      const callbackErrorResponse = await handleCallbackErrorResponse(dependencies);
      if (callbackErrorResponse) {
        return callbackErrorResponse;
      }

      if (!code || !state) {
        return createRedirectResponse('/auth/login');
      }

      const expiredCallbackResponse = await handleExpiredCallbackState(dependencies);
      if (expiredCallbackResponse) {
        return expiredCallbackResponse;
      }

      return completeCallbackExchange({ request, dependencies, code, state });
    } catch (error) {
      return createAuthDependencyErrorResponse(request, 'auth_callback', error);
    }
  });
};
