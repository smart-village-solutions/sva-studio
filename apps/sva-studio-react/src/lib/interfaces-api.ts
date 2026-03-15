import { createServerFn } from '@tanstack/react-start';

import type { SvaMainserverConnectionStatus, SvaMainserverInstanceConfig } from '@sva/sva-mainserver';

const COMPONENT = 'interfaces-api';

const ADMIN_ROLES = new Set(['system_admin', 'app_manager', 'interface_manager', 'interface-manager']);

type InterfacesOverviewModel = {
  readonly instanceId: string;
  readonly config: SvaMainserverInstanceConfig | null;
  readonly status: SvaMainserverConnectionStatus;
};

const isInterfacesOverviewModel = (payload: unknown): payload is InterfacesOverviewModel => {
  const candidate = payload as InterfacesOverviewModel | null;
  return Boolean(candidate && typeof candidate.instanceId === 'string' && candidate.status);
};

type ErrorPayload = {
  readonly message?: string;
  readonly error?: string;
};

const isErrorPayload = (value: unknown): value is ErrorPayload => {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.message === 'string' || typeof value.error === 'string';
};

const isSvaMainserverInstanceConfig = (value: unknown): value is SvaMainserverInstanceConfig => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.instanceId === 'string' &&
    typeof value.providerKey === 'string' &&
    typeof value.graphqlBaseUrl === 'string' &&
    typeof value.oauthTokenUrl === 'string' &&
    typeof value.enabled === 'boolean'
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractMessageFromUnknown = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  const directKeys = ['message', 'error', 'detail', 'title', 'statusText'] as const;
  for (const key of directKeys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  const nestedKeys = ['data', 'cause', 'response', 'body'] as const;
  for (const key of nestedKeys) {
    const nested = extractMessageFromUnknown(value[key]);
    if (nested) {
      return nested;
    }
  }

  return null;
};

const extractErrorDiagnostics = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    const causeMessage = extractMessageFromUnknown((error as Error & { cause?: unknown }).cause);

    return {
      error_type: error.constructor.name,
      error_message: error.message,
      ...(causeMessage ? { error_cause_message: causeMessage } : {}),
    };
  }

  const extracted = extractMessageFromUnknown(error);

  return {
    error_type: typeof error,
    error_message: extracted ?? String(error),
  };
};

const getErrorMessage = (payload: ErrorPayload | null, fallback: string): string => {
  if (payload?.message?.trim()) {
    return payload.message;
  }

  if (payload?.error?.trim()) {
    if (payload.error === 'unauthorized') {
      return 'Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.';
    }
    return payload.error;
  }

  return fallback;
};

const readThrownErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const extracted = extractMessageFromUnknown(error);
  if (extracted) {
    return extracted;
  }

  return fallback;
};

const hasInterfacesAccess = (roles: readonly string[]): boolean =>
  roles.some((role) => ADMIN_ROLES.has(role.trim().toLowerCase()));

const createErrorStatus = (
  errorCode: SvaMainserverConnectionStatus['errorCode'],
  message: string
): SvaMainserverConnectionStatus => ({
  status: 'error',
  checkedAt: new Date().toISOString(),
  errorCode,
  errorMessage: message,
});

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const parseJson = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const loadInterfacesOverview = createServerFn().handler(async (): Promise<InterfacesOverviewModel> => {
  try {
    const { getRequest } = await import('@tanstack/react-start/server');
    const { withAuthenticatedUser } = await import('@sva/auth/server');
    const { getSvaMainserverConnectionStatus, loadSvaMainserverSettings } = await import('@sva/sva-mainserver/server');
    const { createSdkLogger } = await import('@sva/sdk/server');
    const logger = createSdkLogger({ component: COMPONENT });
    const request = getRequest();

    const response = await withAuthenticatedUser(request, async ({ user }) => {
      const instanceId = user.instanceId;

      if (!instanceId) {
        logger.warn('Load interfaces overview rejected: missing instance context', {
          operation: 'load_interfaces_overview',
          user_id: user.id,
        });
        return jsonResponse(400, { message: 'Kein Instanzkontext in der aktuellen Session vorhanden.' } satisfies ErrorPayload);
      }

      if (!hasInterfacesAccess(user.roles)) {
        logger.warn('Load interfaces overview rejected: insufficient permissions', {
          operation: 'load_interfaces_overview',
          workspace_id: instanceId,
          user_id: user.id,
          user_roles: user.roles,
        });
        return jsonResponse(403, {
          instanceId,
          config: null,
          status: createErrorStatus('forbidden', 'Keine Berechtigung zur Schnittstellenverwaltung.'),
        } satisfies InterfacesOverviewModel);
      }

      let config: Awaited<ReturnType<typeof loadSvaMainserverSettings>>;
      try {
        config = await loadSvaMainserverSettings(instanceId);
        logger.info('Interfaces settings loaded', {
          operation: 'load_interfaces_overview',
          workspace_id: instanceId,
          has_config: config !== null,
        });
      } catch (error) {
        logger.error('Failed to load interfaces settings from data layer', {
          operation: 'load_interfaces_overview',
          workspace_id: instanceId,
          error_message: error instanceof Error ? error.message : String(error),
        });
        return jsonResponse(200, {
          instanceId,
          config: null,
          status: createErrorStatus('invalid_config', 'Konfiguration konnte nicht geladen werden.'),
        } satisfies InterfacesOverviewModel);
      }

      let status: SvaMainserverConnectionStatus;
      try {
        status = await getSvaMainserverConnectionStatus({
          instanceId,
          keycloakSubject: user.id,
        });
        logger.info('Interfaces connection status evaluated', {
          operation: 'load_interfaces_overview',
          workspace_id: instanceId,
          connection_status: status.status,
          error_code: status.errorCode,
        });
      } catch (error) {
        logger.warn('Failed to evaluate interfaces connection status', {
          operation: 'load_interfaces_overview',
          workspace_id: instanceId,
          ...extractErrorDiagnostics(error),
        });
        status = createErrorStatus('network_error', 'Verbindungsstatus konnte nicht abgerufen werden.');
      }

      return jsonResponse(200, {
        instanceId,
        config,
        status,
      } satisfies InterfacesOverviewModel);
    });

    const payload = await parseJson<InterfacesOverviewModel | ErrorPayload>(response);
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
      status: createErrorStatus('network_error', getErrorMessage(payload, 'Schnittstellen konnten nicht geladen werden.')),
    };
  } catch (error) {
    const { createSdkLogger } = await import('@sva/sdk/server');
    const logger = createSdkLogger({ component: COMPONENT });
    logger.error('Unexpected error loading interfaces overview', {
      operation: 'load_interfaces_overview',
      ...extractErrorDiagnostics(error),
    });
    return {
      instanceId: '',
      config: null,
      status: createErrorStatus('network_error', 'Schnittstellen konnten nicht geladen werden.'),
    };
  }
});

export const saveSvaMainserverInterfaceSettings = createServerFn({ method: 'POST' })
  .inputValidator((data: { graphqlBaseUrl?: string; oauthTokenUrl?: string; enabled?: boolean }) => data)
  .handler(async ({ data }): Promise<SvaMainserverInstanceConfig> => {
    try {
      const { getRequest } = await import('@tanstack/react-start/server');
      const { withAuthenticatedUser } = await import('@sva/auth/server');
      const { saveSvaMainserverSettings } = await import('@sva/sva-mainserver/server');
      const { createSdkLogger } = await import('@sva/sdk/server');
      const logger = createSdkLogger({ component: COMPONENT });
      const request = getRequest();
      const payloadData = data ?? {};

      const response = await withAuthenticatedUser(request, async ({ user }) => {
        const instanceId = user.instanceId;

        if (!instanceId) {
          logger.warn('Save interfaces settings rejected: missing instance context', {
            operation: 'save_interfaces_settings',
            user_id: user.id,
          });
          return jsonResponse(400, { message: 'Kein Instanzkontext in der aktuellen Session vorhanden.' } satisfies ErrorPayload);
        }

        if (!hasInterfacesAccess(user.roles)) {
          logger.warn('Save interfaces settings rejected: insufficient permissions', {
            operation: 'save_interfaces_settings',
            workspace_id: instanceId,
            user_id: user.id,
            user_roles: user.roles,
          });
          return jsonResponse(403, { message: 'Keine Berechtigung zur Schnittstellenverwaltung.' } satisfies ErrorPayload);
        }

        logger.info('Saving interfaces settings', {
          operation: 'save_interfaces_settings',
          workspace_id: instanceId,
          enabled: Boolean(payloadData.enabled),
        });

        let config: SvaMainserverInstanceConfig;
        try {
          config = await saveSvaMainserverSettings({
            instanceId,
            graphqlBaseUrl: payloadData.graphqlBaseUrl?.trim() ?? '',
            oauthTokenUrl: payloadData.oauthTokenUrl?.trim() ?? '',
            enabled: Boolean(payloadData.enabled),
          });
        } catch (error) {
          logger.error('Failed to persist interfaces settings', {
            operation: 'save_interfaces_settings',
            workspace_id: instanceId,
            ...extractErrorDiagnostics(error),
          });
          return jsonResponse(400, { message: 'Einstellungen konnten nicht gespeichert werden.' } satisfies ErrorPayload);
        }

        logger.info('Interfaces settings saved successfully', {
          operation: 'save_interfaces_settings',
          workspace_id: instanceId,
          enabled: config.enabled,
        });

        return jsonResponse(200, config);
      });

      const payload = await parseJson<SvaMainserverInstanceConfig | ErrorPayload>(response);
      if (response.ok && isSvaMainserverInstanceConfig(payload)) {
        return payload;
      }

      throw new Error(
        getErrorMessage(
          isErrorPayload(payload) ? payload : null,
          `Schnittstellen-Einstellungen konnten nicht gespeichert werden (HTTP ${response.status}).`
        )
      );
    } catch (error) {
      const { createSdkLogger } = await import('@sva/sdk/server');
      const logger = createSdkLogger({ component: COMPONENT });
      const message = readThrownErrorMessage(error, 'Schnittstellen-Einstellungen konnten nicht gespeichert werden.');
      logger.error('Unexpected error saving interfaces settings', {
        operation: 'save_interfaces_settings',
        error_message: message,
        ...extractErrorDiagnostics(error),
      });
      throw new Error(message, {
        cause: error,
      });
    }
  });
