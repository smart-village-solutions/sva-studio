import React from 'react';
import { logBrowserOperationStart } from '../lib/browser-operation-logging';
import { createLoginHref } from '../lib/auth-navigation';
import {
  authLogger,
  isTestRuntime,
  SILENT_SSO_MESSAGE_TYPE,
  SILENT_SSO_TIMEOUT_MS,
} from './auth-provider-helpers';
import type { AuthSessionBase } from './auth-session-base';

export const useSilentAuthRecovery = (base: AuthSessionBase) => {
  const { logAuthDebug, recordTrail } = base;
  const attemptSilentSessionRecovery = React.useCallback(
    async (input: { authFlowId: string; attempt: number }): Promise<boolean> => {
      const currentWindow = globalThis.window;
      const currentDocument = globalThis.document;

      if (!currentWindow || !currentDocument) {
        return false;
      }

      return new Promise<boolean>((resolve) => {
        logBrowserOperationStart(authLogger, 'auth_silent_recovery_started', {
          auth_flow_id: input.authFlowId,
          attempt: input.attempt,
          operation: 'silent_session_recovery',
          pathname: currentWindow.location.pathname,
        });
        recordTrail('auth_silent_recovery_started', {
          ...input,
          recoveryStep: 'iframe_started',
          result: 'started',
        });
        const iframe = currentDocument.createElement('iframe');
        iframe.hidden = true;
        iframe.setAttribute('title', 'silent-auth-recovery');

        let settled = false;
        const cleanup = (
          result: boolean,
          reasonCode:
            'silent_recovery_failed' | 'silent_recovery_succeeded' | 'silent_recovery_timeout'
        ) => {
          if (settled) {
            return;
          }
          settled = true;
          currentWindow.removeEventListener('message', handleMessage);
          currentWindow.clearTimeout(timeoutId);
          iframe.remove();
          authLogger.info(
            result ? 'auth_silent_recovery_succeeded' : 'auth_silent_recovery_failed',
            {
              auth_flow_id: input.authFlowId,
              attempt: input.attempt,
              operation: 'silent_session_recovery',
              result: result ? 'succeeded' : 'failed',
            }
          );
          recordTrail(result ? 'auth_silent_recovery_succeeded' : 'auth_silent_recovery_failed', {
            ...input,
            classification: result
              ? 'frontend_state_or_permission_staleness'
              : 'oidc_discovery_or_exchange',
            diagnosticStatus: result ? 'degradiert' : 'recovery_laeuft',
            reasonCode,
            recoveryStep: result ? 'iframe_success' : 'iframe_failed',
            result: result ? 'succeeded' : 'failed',
            safeDetails: {
              auth_flow_id: input.authFlowId,
              reason_code: reasonCode,
              recovery_step: result ? 'iframe_success' : 'iframe_failed',
            },
          });
          resolve(result);
        };

        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== currentWindow.location.origin) {
            logAuthDebug('auth_silent_recovery_ignored_origin', { origin: event.origin });
            return;
          }

          if (!event.data || typeof event.data !== 'object') {
            logAuthDebug('auth_silent_recovery_invalid_payload', { reason: 'non_object_payload' });
            return;
          }

          const payload = event.data as { type?: unknown; status?: unknown };
          if (payload.type !== SILENT_SSO_MESSAGE_TYPE) {
            logAuthDebug('auth_silent_recovery_invalid_payload', { reason: 'unexpected_type' });
            return;
          }

          recordTrail('auth_silent_recovery_message_received', {
            ...input,
            recoveryStep: 'iframe_message',
            result: String(payload.status),
          });
          cleanup(
            payload.status === 'success',
            payload.status === 'success' ? 'silent_recovery_succeeded' : 'silent_recovery_failed'
          );
        };

        const timeoutId = currentWindow.setTimeout(() => {
          authLogger.warn('auth_silent_recovery_timed_out', {
            auth_flow_id: input.authFlowId,
            attempt: input.attempt,
            operation: 'silent_session_recovery',
            timeout_ms: SILENT_SSO_TIMEOUT_MS,
          });
          cleanup(false, 'silent_recovery_timeout');
        }, SILENT_SSO_TIMEOUT_MS);
        currentWindow.addEventListener('message', handleMessage);
        if (!isTestRuntime()) {
          iframe.src = `${createLoginHref()}&silent=1`;
        }
        currentDocument.body.appendChild(iframe);
      });
    },
    [logAuthDebug, recordTrail]
  );

  return attemptSilentSessionRecovery;
};
