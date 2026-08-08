import { recordMainserverDataProviderObservation } from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type {
  DataProviderBearingItem,
  MainserverCreateBindingOutcome,
  MainserverMutationActor,
} from './mutation-principal-types.js';

const logger = createSdkLogger({ component: 'sva-mainserver-mutation-principal', level: 'info' });

export const recordCreatedMainserverDataProvider = async (input: {
  readonly actor: MainserverMutationActor;
  readonly created: DataProviderBearingItem;
  readonly reread: () => Promise<DataProviderBearingItem>;
  readonly contentType: string;
}): Promise<MainserverCreateBindingOutcome> => {
  try {
    const observed = input.created.dataProvider?.id ? input.created : await input.reread();
    const dataProviderId = observed.dataProvider?.id?.trim();
    if (!dataProviderId) return undefined;
    const result = await recordMainserverDataProviderObservation({
      instanceId: input.actor.instanceId,
      principalType: input.actor.mutationPrincipalContext.actingPrincipalType,
      principalId: input.actor.mutationPrincipalContext.actingPrincipalId,
      credentialFingerprint: input.actor.mutationPrincipalContext.credentialFingerprint,
      dataProviderId,
      dataProviderName: observed.dataProvider?.name,
      evidenceKind: input.created.dataProvider?.id ? 'create_response' : 'create_reread',
    });
    return result.outcome;
  } catch (error) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver create binding follow-up failed', {
      operation: 'mainserver_create_binding',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      instance_id: input.actor.instanceId,
      content_type: input.contentType,
      content_id: input.created.id,
      error_code: error instanceof Error ? error.name : 'unknown_error',
    });
    return 'reconciliation_required';
  }
};
