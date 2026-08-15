import {
  bindExternalContentReference,
  completeIdempotency,
  reserveIdempotency,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import type { SvaMainserverGenericItem } from '../types.js';
import { errorJson, json } from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { mapAndValidateProject, projectCreateResponseBody } from './projects-create-mapping.js';
import { listAllActiveProjectItems } from './projects-listing.js';
import type {
  ProjectCreateContext,
  ProjectCreateReference,
  ProjectCreateState,
} from './projects-create-types.js';
import { projectMutationJson } from './projects-route-transport.js';
import { getSvaMainserverGenericItem, listSvaMainserverGenericItems } from './service.js';

const CREATE_ENDPOINT = 'POST:/api/v1/mainserver/projects';
const logger = createSdkLogger({ component: 'sva-mainserver-projects-route', level: 'info' });

const reserveProjectCreate = (context: ProjectCreateContext) =>
  reserveIdempotency({
    instanceId: context.actor.instanceId,
    actorAccountId: context.actorInfo.actorAccountId,
    endpoint: CREATE_ENDPOINT,
    idempotencyKey: context.idempotencyKey,
    payloadHash: context.payloadHash,
  });

const completeProjectCreate = (input: {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly idempotencyKey: string;
  readonly responseBody: unknown;
  readonly responseStatus: number;
  readonly status: 'COMPLETED' | 'FAILED';
}) => completeIdempotency({ ...input, endpoint: CREATE_ENDPOINT });

export const completeSuccessfulProjectCreate = async (
  context: ProjectCreateContext,
  responseBody: unknown,
  providerEntityId: string
): Promise<Response> => {
  await Promise.resolve(
    completeProjectCreate({
      instanceId: context.actor.instanceId,
      actorAccountId: context.actorInfo.actorAccountId,
      idempotencyKey: context.idempotencyKey,
      responseBody,
      responseStatus: 201,
      status: 'COMPLETED',
    })
  ).catch(() => undefined);
  return projectMutationJson(responseBody, providerEntityId, 201);
};

const findProjectByExternalId = async (
  context: ProjectCreateContext
): Promise<SvaMainserverGenericItem | undefined> => {
  const result = await listAllActiveProjectItems(
    { ...context.actor, page: 1, pageSize: 100, includeInvisible: true },
    listSvaMainserverGenericItems
  );
  return result.data.find((item) => item.externalId === context.idempotencyKey);
};

export const findExistingProjectCreate = async (
  context: ProjectCreateContext,
  reference?: ProjectCreateReference
): Promise<SvaMainserverGenericItem | undefined> => {
  if (reference?.sourceEntityId) {
    try {
      return await getSvaMainserverGenericItem({
        ...context.actor,
        genericItemId: reference.sourceEntityId,
      });
    } catch (error) {
      if (!(error instanceof SvaMainserverError) || error.code !== 'not_found') throw error;
      return undefined;
    }
  }
  return reference ? await findProjectByExternalId(context) : undefined;
};

export const completeExistingProjectCreate = async (
  context: ProjectCreateContext,
  state: ProjectCreateState,
  existing: SvaMainserverGenericItem
): Promise<Response> => {
  if (state.reference && !state.reference.sourceEntityId) {
    try {
      state.reference = await bindExternalContentReference({
        instanceId: context.actor.instanceId,
        referenceId: state.reference.id,
        sourceEntityId: existing.id,
      });
    } catch (error) {
      logger.warn('Project local follow-up failed while repairing provider binding', {
        operation: 'mainserver_projects_local_follow_up',
        instance_id: context.actor.instanceId,
        error_code: error instanceof Error ? error.name : 'local_finalize_failed',
      });
    }
  }
  const responseBody = projectCreateResponseBody({
    project: mapAndValidateProject(existing),
    ...(state.reference?.sourceEntityId ? { localContentId: state.reference.contentId } : {}),
  });
  return await completeSuccessfulProjectCreate(context, responseBody, existing.id);
};

export const deletedProjectReplayResponse = async (
  context: ProjectCreateContext
): Promise<Response> => {
  try {
    const reserved = await reserveProjectCreate(context);
    if (reserved.status === 'replay') return json(reserved.responseBody, reserved.responseStatus);
    const message =
      reserved.status === 'conflict'
        ? reserved.message
        : 'Idempotency-Key verweist auf ein gelöschtes Projekt.';
    const responseBody = { error: 'idempotency_key_reuse', message };
    if (reserved.status === 'reserved') {
      await completeProjectCreate({
        instanceId: context.actor.instanceId,
        actorAccountId: context.actorInfo.actorAccountId,
        idempotencyKey: context.idempotencyKey,
        responseBody,
        responseStatus: 409,
        status: 'FAILED',
      });
    }
    return json(responseBody, 409);
  } catch (error) {
    logger.warn('Project create replay could not verify its deleted provider binding', {
      operation: 'mainserver_projects_local_follow_up',
      instance_id: context.actor.instanceId,
      error_code: error instanceof Error ? error.name : 'idempotency_unavailable',
    });
    return errorJson(
      503,
      'idempotency_unavailable',
      'Projektwiederholung konnte nicht geprüft werden.'
    );
  }
};

export const reserveOrRecoverProjectCreate = async (
  context: ProjectCreateContext
): Promise<SvaMainserverGenericItem | Response | undefined> => {
  try {
    const reserved = await reserveProjectCreate(context);
    if (reserved.status === 'replay') return json(reserved.responseBody, reserved.responseStatus);
    if (reserved.status === 'conflict')
      return errorJson(409, 'idempotency_key_reuse', reserved.message);
    return undefined;
  } catch (error) {
    logger.warn(
      'Project local idempotency reservation unavailable; provider externalId remains authoritative',
      {
        operation: 'mainserver_projects_local_follow_up',
        instance_id: context.actor.instanceId,
        error_code: error instanceof Error ? error.name : 'local_finalize_failed',
      }
    );
    return await findProjectByExternalId(context);
  }
};
