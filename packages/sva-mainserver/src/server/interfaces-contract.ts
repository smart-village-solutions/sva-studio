import { withAuthenticatedUser, type AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';
import type { SvaMainserverConnectionStatus, SvaMainserverInstanceConfig } from '../types.js';
import { extractErrorDiagnostics, isRecord } from './interfaces-contract-errors.js';
import {
  createClientError,
  createErrorStatus,
  getErrorCause,
  getOverviewFallbackStatus,
  isErrorPayload,
  isInterfacesOverviewModel,
  isSvaMainserverErrorCode,
  isSvaMainserverInstanceConfig,
  jsonResponse,
  parseJson,
  type ErrorPayload,
} from './interfaces-contract-helpers.js';
import {
  authorizeInterfacesOverviewRequest,
  evaluateOverviewStatus,
  loadOverviewConfig,
} from './interfaces-contract-overview.js';
import { handleSaveInterfacesSettingsRequest } from './interfaces-contract-save.js';

const COMPONENT = 'interfaces-api';
export type SvaMainserverInterfacesOverview = {
  readonly instanceId: string;
  readonly config: SvaMainserverInstanceConfig | null;
  readonly status: SvaMainserverConnectionStatus;
};

export type SaveSvaMainserverInterfaceSettingsInput = {
  readonly data: {
    readonly graphqlBaseUrl?: string;
    readonly oauthTokenUrl?: string;
    readonly enabled?: boolean;
  };
};

export const loadSvaMainserverInterfacesOverview = async (
  request: Request
): Promise<SvaMainserverInterfacesOverview> => {
  try {
    const logger = createSdkLogger({ component: COMPONENT });

    const response = await withAuthenticatedUser(
      request,
      async (ctx: AuthenticatedRequestContext) => {
        const authorized = await authorizeInterfacesOverviewRequest({ ctx, logger });
        if (!authorized.ok) {
          return authorized.response;
        }

        const configResult = await loadOverviewConfig({
          instanceId: authorized.instanceId,
          logger,
        });
        if (!configResult.ok) {
          return configResult.response;
        }

        const status = await evaluateOverviewStatus({
          instanceId: authorized.instanceId,
          userId: ctx.user.id,
          activeOrganizationId: ctx.activeOrganizationId,
          logger,
        });

        return jsonResponse(200, {
          instanceId: authorized.instanceId,
          config: configResult.config,
          status,
        } satisfies SvaMainserverInterfacesOverview);
      }
    );

    const payload = await parseJson<SvaMainserverInterfacesOverview | ErrorPayload>(response);
    if (payload && isInterfacesOverviewModel(payload)) {
      return payload;
    }

    logger.warn('Load interfaces overview returned unexpected payload', {
      operation: 'load_interfaces_overview',
      http_status: response.status,
      payload_type: payload === null ? 'null' : typeof payload,
      payload_message: payload?.message,
      payload_error: payload?.error,
    });

    return {
      instanceId: '',
      config: null,
      status: getOverviewFallbackStatus(response, isErrorPayload(payload) ? payload : null),
    };
  } catch (error) {
    const logger = createSdkLogger({ component: COMPONENT });
    logger.error('Unexpected error loading interfaces overview', {
      operation: 'load_interfaces_overview',
      ...extractErrorDiagnostics(error),
    });
    return {
      instanceId: '',
      config: null,
      status: createErrorStatus('network_error'),
    };
  }
};

export const saveSvaMainserverInterfaceSettings = async (
  request: Request,
  { data }: SaveSvaMainserverInterfaceSettingsInput
): Promise<SvaMainserverInstanceConfig> => {
  try {
    const logger = createSdkLogger({ component: COMPONENT });
    const payloadData = (data ?? {}) as SaveSvaMainserverInterfaceSettingsInput['data'];

    const response = await withAuthenticatedUser(request, (ctx: AuthenticatedRequestContext) =>
      handleSaveInterfacesSettingsRequest({ ctx, logger, payloadData })
    );

    const payload = await parseJson<SvaMainserverInstanceConfig | ErrorPayload>(response);
    if (response.ok && isSvaMainserverInstanceConfig(payload)) {
      return payload;
    }

    throw createClientError(
      isErrorPayload(payload) ? payload : null,
      `Schnittstellen-Einstellungen konnten nicht gespeichert werden (HTTP ${response.status}).`
    );
  } catch (error) {
    const logger = createSdkLogger({ component: COMPONENT });
    const errorCause = getErrorCause(error);
    const payload = isRecord(errorCause) && isErrorPayload(errorCause) ? errorCause : null;
    const message =
      payload?.error && isSvaMainserverErrorCode(payload.error)
        ? payload.error
        : error instanceof Error && isSvaMainserverErrorCode(error.message)
          ? error.message
          : 'network_error';
    logger.error('Unexpected error saving interfaces settings', {
      operation: 'save_interfaces_settings',
      error_message: message,
      ...extractErrorDiagnostics(error),
    });
    if (error instanceof Error && isSvaMainserverErrorCode(message)) {
      throw error;
    }
    const wrappedError = new Error(message) as Error & { cause?: unknown };
    wrappedError.cause = error;
    throw wrappedError;
  }
};
