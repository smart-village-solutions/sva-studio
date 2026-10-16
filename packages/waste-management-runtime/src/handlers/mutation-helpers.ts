import { asApiItem, createApiError } from '@sva/server-runtime';
import { emitWasteAuditEvent } from './auth.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import type { AuthenticatedRequestContext } from './types.js';
import type { ApiErrorCode } from '@sva/core';

export type MappedPersistenceError = Readonly<{
  status: number;
  code: ApiErrorCode;
  message: string;
  reasonCode: string;
}>;

type MutationAuditConfig = Readonly<{
  actionId: string;
  resourceType: string;
}>;

type MutationMessages = Readonly<{
  verificationFailed: string;
  persistenceFailed: string;
  mapPersistenceErrorMessage?: (error: unknown) => string | undefined;
  mapPersistenceError?: (error: unknown) => MappedPersistenceError | undefined;
}>;

type UpdateMutationMessages = MutationMessages &
  Readonly<{
    notFound: string;
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

export const mapWasteAddressMutationPersistenceError = (error: unknown): MappedPersistenceError | undefined => {
  const message = error instanceof Error ? error.message : '';
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (message === 'address_confirmation_required') return {
    status: 409, code: 'conflict',
    message: 'Bitte laden Sie die Folgen des Elternwechsels und bestätigen Sie die betroffenen E-Mail-Abos ausdrücklich.',
    reasonCode: message,
  };
  if (code === '40001' || code === '40P01' || message === 'address_preview_stale' || message === 'address_data_inconsistent') return {
    status: 409, code: 'conflict',
    message: 'Die Vorschau ist nicht mehr aktuell oder die Adressdaten sind widersprüchlich. Bitte laden Sie die Vorschau erneut.',
    reasonCode: message === 'address_data_inconsistent' ? message : 'address_preview_stale',
  };
  if (message === 'address_entity_not_found' || message === 'address_move_target_not_found') return {
    status: 404, code: 'not_found', message: 'Der ausgewählte Adressdatensatz wurde nicht gefunden.', reasonCode: message,
  };
  if (message === 'address_move_unchanged' || message === 'invalid_address_move') return {
    status: 400, code: 'invalid_request', message: 'Die ausgewählte Zuordnung ist ungültig oder bereits gesetzt.', reasonCode: message,
  };
  return undefined;
};

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

    const mappedError = messages.mapPersistenceError?.(error);
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: audit.actionId,
      result: 'failure',
      reasonCode: mappedError?.reasonCode ?? 'database_unavailable',
      resourceType: audit.resourceType,
      resourceId,
    });
    await updateWasteVisibleStatus(deps, instanceId, mappedError ? 'success' : 'revalidate');
    if (mappedError) {
      return createApiError(mappedError.status, mappedError.code, mappedError.message, requestId);
    }
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

    const mappedError = messages.mapPersistenceError?.(error);
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: audit.actionId,
      result: 'failure',
      reasonCode: mappedError?.reasonCode ?? 'database_unavailable',
      resourceType: audit.resourceType,
      resourceId,
    });
    await updateWasteVisibleStatus(deps, instanceId, mappedError ? 'success' : 'revalidate');
    if (mappedError) {
      return createApiError(mappedError.status, mappedError.code, mappedError.message, requestId);
    }
    return createApiError(
      503,
      'database_unavailable',
      messages.mapPersistenceErrorMessage?.(error) ?? messages.persistenceFailed,
      requestId
    );
  }
};

export { runWasteDeleteMutation } from './mutation-delete-helper.js';
