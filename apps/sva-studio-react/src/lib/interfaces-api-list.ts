import type { SvaMainserverInterfacesOverview } from '@sva/sva-mainserver/server';

import { readErrorMessage } from './error-message-utils';
import type {
  InstanceInterface,
  InstanceInterfaceMapGeocoding,
  InstanceInterfaceMailTransport,
  InstanceInterfacePostgresql,
  InstanceInterfaceS3,
  InstanceInterfaceSupabase,
  InstanceInterfaceType,
} from './instance-interfaces';
import {
  loadInterfacesRequestDependencies,
  resolveAuthorizedInterfacesInstanceId,
  runWithAuthenticatedInterfacesUser,
} from './interfaces-api-context';
import { createErrorStatus, isListInstanceInterfacesResponse } from './interfaces-api-transport';

const WASTE_MANAGEMENT_MODULE_ID = 'waste-management';
const DEFAULT_AVAILABLE_INTERFACE_TYPES: readonly InstanceInterfaceType[] = [
  'mainserver',
  's3',
  'postgresql',
  'mailTransport',
  'mapGeocoding',
];

export const resolveAvailableInterfaceTypes = async (
  instanceId: string
): Promise<readonly InstanceInterfaceType[]> => {
  const { loadInstanceById } = await import('@sva/data-repositories/server');
  const instance = await loadInstanceById(instanceId);
  const assignedModules = Array.isArray(instance?.assignedModules) ? instance.assignedModules : [];
  if (!assignedModules.includes(WASTE_MANAGEMENT_MODULE_ID)) {
    return DEFAULT_AVAILABLE_INTERFACE_TYPES;
  }

  return [...DEFAULT_AVAILABLE_INTERFACE_TYPES, 'supabase'];
};

type ListInstanceInterfacesResponse = Readonly<{
  instanceId: string;
  availableTypes: readonly InstanceInterfaceType[];
  entries: readonly InstanceInterface[];
}>;

export const projectStoredEntry = async (
  instanceId: string,
  entry:
    | Omit<InstanceInterfaceS3, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>
    | Omit<InstanceInterfaceSupabase, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>
    | Omit<InstanceInterfacePostgresql, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>
    | Omit<
        InstanceInterfaceMailTransport,
        'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'
      >
    | Omit<
        InstanceInterfaceMapGeocoding,
        'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'
      >
): Promise<InstanceInterface> => {
  const { checkStoredInterfaceHealth } = await import('./instance-interfaces-server.js');
  const health = checkStoredInterfaceHealth(entry);
  return {
    ...entry,
    instanceId,
    status: health.status,
    statusMessage: health.statusMessage,
    lastCheckedAt: health.checkedAt,
  } as InstanceInterface;
};

export const listInstanceInterfaces = async (
  request?: Request,
  options: Readonly<{ includeMainserver?: boolean }> = {}
): Promise<ListInstanceInterfacesResponse> => {
  const dependencies = await loadInterfacesRequestDependencies(request);

  const result = await runWithAuthenticatedInterfacesUser({
    request: dependencies.request,
    fallbackMessage: 'Schnittstellen konnten nicht geladen werden.',
    personalBearerRoute: { method: 'GET', path: '/api/v1/interfaces' },
    run: async (ctx) => {
      const authorizedInstanceId = await resolveAuthorizedInterfacesInstanceId(
        dependencies.logger,
        ctx,
        'list_interfaces'
      );
      const overview =
        options.includeMainserver === false
          ? null
          : await (async () => {
              try {
                const { loadSvaMainserverInterfacesOverview } =
                  await import('@sva/sva-mainserver/server');
                return await loadSvaMainserverInterfacesOverview(dependencies.request);
              } catch (error) {
                const message = readErrorMessage(
                  error,
                  'Schnittstellenstatus konnte nicht geladen werden.'
                );
                return {
                  instanceId: authorizedInstanceId,
                  config: null,
                  status: createErrorStatus('network_error', message),
                } satisfies SvaMainserverInterfacesOverview;
              }
            })();

      const blockedOverview = Boolean(
        overview &&
        (overview.status.errorCode === 'forbidden' ||
          (overview.instanceId.length > 0 && overview.instanceId !== authorizedInstanceId))
      );

      const { listStoredInterfaces } = await import('./instance-interfaces-server.js');
      const stored = blockedOverview ? [] : await listStoredInterfaces(authorizedInstanceId);
      const projected = await Promise.all(
        stored.map((entry) => projectStoredEntry(authorizedInstanceId, entry))
      );
      const resolvedTypes = await resolveAvailableInterfaceTypes(authorizedInstanceId);
      const availableTypes =
        options.includeMainserver === false
          ? resolvedTypes.filter((type) => type !== 'mainserver')
          : resolvedTypes;

      const mainserverEntry: InstanceInterface | null =
        !blockedOverview && overview?.config
          ? ({
              id: `mainserver:${authorizedInstanceId}`,
              instanceId: authorizedInstanceId,
              type: 'mainserver',
              name: 'SVA Mainserver',
              enabled: overview.config.enabled,
              status:
                overview.status.status === 'connected'
                  ? 'connected'
                  : overview.config.enabled
                    ? 'error'
                    : 'disabled',
              statusMessage: overview.status.errorMessage,
              errorCode: overview.status.errorCode,
              lastCheckedAt: overview.status.checkedAt,
              createdAt: overview.status.checkedAt ?? new Date().toISOString(),
              updatedAt: overview.status.checkedAt ?? new Date().toISOString(),
              config: {
                graphqlBaseUrl: overview.config.graphqlBaseUrl,
                oauthTokenUrl: overview.config.oauthTokenUrl,
              },
            } satisfies InstanceInterface)
          : null;

      return {
        instanceId: authorizedInstanceId,
        availableTypes,
        entries: [...(mainserverEntry ? [mainserverEntry] : []), ...projected],
      };
    },
  });

  if (!isListInstanceInterfacesResponse(result)) {
    dependencies.logger.error('List interfaces produced an invalid payload', {
      operation: 'list_interfaces',
      invalid_payload_type: typeof result,
    });
    throw new Error('invalid_interfaces_payload');
  }

  return result;
};
