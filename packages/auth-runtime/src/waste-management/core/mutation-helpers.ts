import { asApiItem, createApiError } from '../../shared/request-helpers.js';
import { emitWasteAuditEvent } from './auth.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import type { AuthenticatedRequestContext } from '../../middleware.js';

type MutationAuditConfig = Readonly<{
  actionId: string;
  resourceType: string;
}>;

type MutationMessages = Readonly<{
  verificationFailed: string;
  persistenceFailed: string;
  mapPersistenceErrorMessage?: (error: unknown) => string | undefined;
}>;

type UpdateMutationMessages = MutationMessages &
  Readonly<{
    notFound: string;
  }>;

type DeleteMutationMessages = Readonly<{
  notFound: string;
  deleteFailed: string;
}>;

type MutationBaseArgs<TSaved> = Readonly<{
  deps: WasteManagementHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  requestId?: string;
  resourceId: string;
  audit: MutationAuditConfig;
  save: () => Promise<void>;
  loadSaved: () => Promise<TSaved | null>;
}>;

type CreateMutationArgs<TSaved> = MutationBaseArgs<TSaved> &
  Readonly<{
    messages: MutationMessages;
  }>;

type UpdateMutationArgs<TSaved> = MutationBaseArgs<TSaved> &
  Readonly<{
    messages: UpdateMutationMessages;
    loadExisting: () => Promise<unknown | null>;
  }>;

type DeleteMutationArgs = Readonly<{
  deps: WasteManagementHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  requestId?: string;
  resourceId: string;
  audit: MutationAuditConfig;
  messages: DeleteMutationMessages;
  loadExisting: () => Promise<unknown | null>;
  remove: () => Promise<void>;
}>;

const isMissingDependencyError = (error: unknown): error is Error =>
  error instanceof Error && error.message.startsWith('missing_dependency:');

export const runWasteCreateMutation = async <TSaved>({
  deps,
  ctx,
  instanceId,
  requestId,
  resourceId,
  audit,
  messages,
  save,
  loadSaved,
}: CreateMutationArgs<TSaved>): Promise<Response> => {
  try {
    await save();

    const saved = await loadSaved();
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: audit.actionId,
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: audit.resourceType,
        resourceId,
      });
      return createApiError(503, 'database_unavailable', messages.verificationFailed, requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: audit.actionId,
      result: 'success',
      resourceType: audit.resourceType,
      resourceId,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (isMissingDependencyError(error)) {
      throw error;
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: audit.actionId,
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: audit.resourceType,
      resourceId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(
      503,
      'database_unavailable',
      messages.mapPersistenceErrorMessage?.(error) ?? messages.persistenceFailed,
      requestId
    );
  }
};

export const runWasteUpdateMutation = async <TSaved>({
  deps,
  ctx,
  instanceId,
  requestId,
  resourceId,
  audit,
  messages,
  loadExisting,
  save,
  loadSaved,
}: UpdateMutationArgs<TSaved>): Promise<Response> => {
  try {
    const existing = await loadExisting();
    if (!existing) {
      return createApiError(404, 'not_found', messages.notFound, requestId);
    }

    await save();

    const saved = await loadSaved();
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: audit.actionId,
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: audit.resourceType,
        resourceId,
      });
      return createApiError(503, 'database_unavailable', messages.verificationFailed, requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: audit.actionId,
      result: 'success',
      resourceType: audit.resourceType,
      resourceId,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (isMissingDependencyError(error)) {
      throw error;
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: audit.actionId,
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: audit.resourceType,
      resourceId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(
      503,
      'database_unavailable',
      messages.mapPersistenceErrorMessage?.(error) ?? messages.persistenceFailed,
      requestId
    );
  }
};

export const runWasteDeleteMutation = async ({
  deps,
  ctx,
  instanceId,
  requestId,
  resourceId,
  audit,
  messages,
  loadExisting,
  remove,
}: DeleteMutationArgs): Promise<Response> => {
  try {
    const existing = await loadExisting();
    if (!existing) {
      return createApiError(404, 'not_found', messages.notFound, requestId);
    }

    await remove();

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: audit.actionId,
      result: 'success',
      resourceType: audit.resourceType,
      resourceId,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem({ id: resourceId }, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (isMissingDependencyError(error)) {
      throw error;
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: audit.actionId,
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: audit.resourceType,
      resourceId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', messages.deleteFailed, requestId);
  }
};
