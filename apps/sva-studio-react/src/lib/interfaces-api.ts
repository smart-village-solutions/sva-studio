import { createServerFn } from '@tanstack/react-start';

import {
  type SaveSvaMainserverInterfaceSettingsInput,
  type SvaMainserverInterfacesOverview,
} from '@sva/sva-mainserver/server';
import type { SvaMainserverInstanceConfig } from '@sva/sva-mainserver';

import { extractErrorDiagnostics, isRecord, readErrorMessage } from './error-message-utils';
import {
  createClientError,
  createErrorStatus,
  isErrorPayload,
  isSvaMainserverErrorCode,
  isSvaMainserverInstanceConfig,
  parseJson,
  type ErrorPayload,
} from './interfaces-api-transport';
import {
  COMPONENT,
  loadInterfacesRequestDependencies,
  loadSaveInterfacesDependencies,
  resolveAuthorizedInterfacesInstanceId,
  runWithAuthenticatedInterfacesUser,
  validateInterfaceMutationCsrf,
} from './interfaces-api-context';
import {
  saveInterfacesSettingsForUser,
  type SaveInterfacesPayload,
} from './interfaces-api-settings';
import {
  listInstanceInterfaces,
  projectStoredEntry,
  resolveAvailableInterfaceTypes,
} from './interfaces-api-list';
import {
  deepLInterfaceDraftSchema,
  type InstanceInterface,
  type InstanceInterfaceDraft,
} from './instance-interfaces';
import type { MailTestResult } from './instance-interface-mail-test.server';

type InterfacesOverviewModel = SvaMainserverInterfacesOverview;

const requireModuleForInterface = async (
  draft: InstanceInterfaceDraft,
  instanceId: string
): Promise<void> => {
  if (draft.type !== 'supabase' && draft.type !== 'deepl') {
    return;
  }

  const availableTypes = await resolveAvailableInterfaceTypes(instanceId);
  if (!availableTypes.includes(draft.type)) {
    throw new Error(
      draft.type === 'deepl'
        ? 'deepl_requires_multilingual_module'
        : 'supabase_requires_waste_management_module'
    );
  }
};

export const loadSvaMainserverInterfacesOverviewServerFn = createServerFn().handler(
  async (): Promise<InterfacesOverviewModel> => {
    try {
      const { getRequest } = await import('@tanstack/react-start/server');
      const { loadSvaMainserverInterfacesOverview } = await import('@sva/sva-mainserver/server');

      return await loadSvaMainserverInterfacesOverview(getRequest());
    } catch (error) {
      const message = readErrorMessage(error, 'Schnittstellenstatus konnte nicht geladen werden.');
      return {
        instanceId: '',
        config: null,
        status: createErrorStatus('network_error', message),
      };
    }
  }
);

export const loadInterfacesOverview = loadSvaMainserverInterfacesOverviewServerFn;

export const listInstanceInterfacesServerFn = createServerFn().handler(() =>
  listInstanceInterfaces()
);

type UpsertInstanceInterfaceInput = Readonly<{
  instanceId?: string;
  draft: InstanceInterfaceDraft;
  existingId?: string;
}>;

export const upsertInstanceInterfaceForRequest = async (
  data: UpsertInstanceInterfaceInput,
  request?: Request
): Promise<InstanceInterface> => {
  if (data.draft.type === 'deepl' && !deepLInterfaceDraftSchema.safeParse(data.draft).success)
    throw new Error('invalid_config');
  if (data.draft.type === 'mainserver') {
    throw new Error('mainserver_interfaces_use_dedicated_endpoint');
  }
  const dependencies = await loadInterfacesRequestDependencies(request);
  const { getStoredInterface, upsertStoredInterface } =
    await import('./instance-interfaces-server.js');
  return runWithAuthenticatedInterfacesUser({
    request: dependencies.request,
    fallbackMessage: 'Schnittstelle konnte nicht gespeichert werden.',
    personalBearerRoute: { method: 'POST', path: '/api/v1/interfaces' },
    run: async (ctx) => {
      await validateInterfaceMutationCsrf(dependencies.request);
      const instanceId = await resolveAuthorizedInterfacesInstanceId(
        dependencies.logger,
        ctx,
        'upsert_interface',
        data.instanceId
      );
      dependencies.logger.info('Received interface upsert request', {
        operation: 'upsert_interface',
        workspace_id: instanceId,
        requested_workspace_id: data.instanceId,
        interface_type: data.draft.type,
        existing_interface_id: data.existingId,
        enabled: data.draft.enabled,
        user_id: ctx.user.id,
        has_secret_input:
          data.draft.type === 's3'
            ? data.draft.config.secretAccessKey.length > 0
            : data.draft.type === 'supabase'
              ? data.draft.config.databaseUrl.length > 0 ||
                data.draft.config.serviceRoleKey.length > 0
              : data.draft.type === 'postgresql'
                ? data.draft.config.databaseUrl.length > 0
                : data.draft.type === 'mailTransport'
                  ? data.draft.config.password.length > 0
                  : data.draft.type === 'mapGeocoding'
                    ? data.draft.config.apiKey.length > 0
                    : false,
        request_host: new URL(dependencies.request.url).host,
        has_iam_database_url: Boolean(process.env.IAM_DATABASE_URL),
      });
      await requireModuleForInterface(data.draft, instanceId);
      let stored;
      try {
        stored = await upsertStoredInterface(instanceId, data.draft, data.existingId);
      } catch (error) {
        dependencies.logger.error('Interface upsert failed before projection refresh', {
          operation: 'upsert_interface',
          workspace_id: instanceId,
          interface_type: data.draft.type,
          existing_interface_id: data.existingId,
          user_id: ctx.user.id,
          error_type: error instanceof Error ? error.constructor.name : typeof error,
        });
        throw error;
      }

      if (
        stored.type === 'supabase' ||
        stored.type === 'postgresql' ||
        stored.type === 's3' ||
        (stored.type === 'mapGeocoding' && stored.config.provider === 'geoapify')
      ) {
        try {
          const { runStoredInterfaceHealthcheck } =
            await import('./instance-interface-healthcheck.server.js');
          await runStoredInterfaceHealthcheck({
            instanceId,
            interfaceId: stored.id,
          });
        } catch (error) {
          dependencies.logger.warn('Interface healthcheck failed after save', {
            operation: 'upsert_interface',
            workspace_id: instanceId,
            interface_id: stored.id,
            interface_type: stored.type,
            error_type: error instanceof Error ? error.constructor.name : typeof error,
          });
        }
      }

      const refreshed = await getStoredInterface(instanceId, stored.id);
      dependencies.logger.info('Interface upsert finished', {
        operation: 'upsert_interface',
        workspace_id: instanceId,
        interface_id: stored.id,
        interface_type: stored.type,
        refreshed_after_save: Boolean(refreshed),
      });
      return projectStoredEntry(instanceId, refreshed ?? stored);
    },
  });
};

export const upsertInstanceInterfaceServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: UpsertInstanceInterfaceInput) => data)
  .handler(async ({ data }): Promise<InstanceInterface> => upsertInstanceInterfaceForRequest(data));

type TestMailInterfaceInput = Readonly<{ instanceId?: string; id: string; locale?: 'de' | 'en' }>;

export const testMailInterfaceForRequest = async (
  data: TestMailInterfaceInput,
  request?: Request
): Promise<MailTestResult> => {
  if (
    !data ||
    typeof data.id !== 'string' ||
    !data.id.trim() ||
    (data.instanceId !== undefined && typeof data.instanceId !== 'string') ||
    (data.locale !== undefined && data.locale !== 'de' && data.locale !== 'en')
  )
    throw new Error('invalid_config');
  const dependencies = await loadInterfacesRequestDependencies(request);
  return runWithAuthenticatedInterfacesUser({
    request: dependencies.request,
    fallbackMessage: 'Test-E-Mail konnte nicht versendet werden.',
    run: async (ctx) => {
      await validateInterfaceMutationCsrf(dependencies.request);
      const instanceId = await resolveAuthorizedInterfacesInstanceId(
        dependencies.logger,
        ctx,
        'test_mail_interface',
        data.instanceId
      );
      const { loadExternalInterfaceRecordById } = await import('@sva/data-repositories/server');
      const record = await loadExternalInterfaceRecordById(instanceId, data.id);
      if (!record || record.typeKey !== 'mail_transport' || record.ownerKind !== 'host') {
        throw new Error('interface_not_found');
      }
      const { sendMailTransportTest } = await import('./instance-interface-mail-test.server.js');
      const result = await sendMailTransportTest({
        record,
        recipient: ctx.user.email ?? '',
        locale: data.locale ?? 'de',
      });
      dependencies.logger.info('Mail interface test completed', {
        operation: 'test_mail_interface',
        workspace_id: instanceId,
        interface_id: record.id,
        user_id: ctx.user.id,
        result: result.status,
        ...(result.status === 'failed' ? { reason: result.reason } : {}),
      });
      return result;
    },
  });
};

export const testMailInterfaceServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: TestMailInterfaceInput) => data)
  .handler(async ({ data }): Promise<MailTestResult> => testMailInterfaceForRequest(data));

type DeleteInstanceInterfaceInput = Readonly<{
  instanceId?: string;
  id: string;
}>;

export const deleteInstanceInterfaceForRequest = async (
  data: DeleteInstanceInterfaceInput,
  request?: Request
): Promise<{ deleted: boolean }> => {
  const dependencies = await loadInterfacesRequestDependencies(request);
  return runWithAuthenticatedInterfacesUser({
    request: dependencies.request,
    fallbackMessage: 'Schnittstelle konnte nicht gelöscht werden.',
    personalBearerRoute: { method: 'DELETE', path: '/api/v1/interfaces/$interfaceId' },
    run: async (ctx) => {
      await validateInterfaceMutationCsrf(dependencies.request);
      const instanceId = await resolveAuthorizedInterfacesInstanceId(
        dependencies.logger,
        ctx,
        'delete_interface',
        data.instanceId
      );
      const isMainserverDelete =
        data.id === `mainserver:${instanceId}` || data.id === `sva-mainserver:${instanceId}`;
      const deleted = isMainserverDelete
        ? await (await import('@sva/sva-mainserver/server')).deleteSvaMainserverSettings(instanceId)
        : await (
            await import('./instance-interfaces-server.js')
          ).deleteStoredInterface(instanceId, data.id);
      if (!deleted) {
        throw new Error('interface_not_found');
      }
      return { deleted: true };
    },
  });
};

export const deleteInstanceInterfaceServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: DeleteInstanceInterfaceInput) => data)
  .handler(async ({ data }): Promise<{ deleted: boolean }> =>
    deleteInstanceInterfaceForRequest(data)
  );

export const saveSvaMainserverInterfaceSettings = createServerFn({ method: 'POST' })
  .inputValidator((data: SaveSvaMainserverInterfaceSettingsInput['data']) => data)
  .handler(async ({ data }): Promise<SvaMainserverInstanceConfig> => {
    try {
      const { withAuthenticatedUser } = await import('@sva/auth-runtime/server');
      const dependencies = await loadSaveInterfacesDependencies();
      const payloadData = (data ?? {}) as SaveInterfacesPayload;

      const response = await withAuthenticatedUser(dependencies.request, async (ctx) => {
        try {
          await validateInterfaceMutationCsrf(dependencies.request);
        } catch (error) {
          if (error instanceof Error && error.message === 'csrf_validation_failed') {
            return Response.json({ error: 'csrf_validation_failed' }, { status: 403 });
          }
          throw error;
        }
        return saveInterfacesSettingsForUser({
          ...dependencies,
          ctx: {
            sessionId: ctx.sessionId,
            user: ctx.user,
          },
          payloadData,
        });
      });

      const payload = await parseJson<SvaMainserverInstanceConfig | ErrorPayload>(response);
      if (response.ok && isSvaMainserverInstanceConfig(payload)) {
        return payload;
      }
      if (
        response.status === 403 &&
        isErrorPayload(payload) &&
        payload.error === 'csrf_validation_failed'
      ) {
        throw Object.assign(new Error('csrf_validation_failed'), { statusCode: 403 });
      }

      throw createClientError(
        isErrorPayload(payload) ? payload : null,
        `Schnittstellen-Einstellungen konnten nicht gespeichert werden (HTTP ${response.status}).`
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'csrf_validation_failed') {
        throw error;
      }
      const { createSdkLogger } = await import('@sva/server-runtime');
      const logger = createSdkLogger({ component: COMPONENT });
      const payload =
        error instanceof Error && isRecord(error.cause) && isErrorPayload(error.cause)
          ? error.cause
          : null;
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
      throw new Error(message, {
        cause: error,
      });
    }
  });

export { checkDeepLInterfaceForRequest, checkDeepLInterfaceServerFn } from './interfaces-api-deepl';
