import { metrics } from '@opentelemetry/api';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { MainserverMutationActor } from './mutation-principal.js';

const logger = createSdkLogger({
  component: 'sva-mainserver-content-ownership-route',
  level: 'info',
});
const transferCounter = metrics
  .getMeter('sva.mainserver')
  .createCounter('sva_mainserver_content_ownership_transfer_total', {
    description: 'Anzahl kontrollierter Mainserver-Inhabertransfers nach Ergebnis.',
  });

export const recordOwnershipTransferOutcome = (input: {
  readonly actor: MainserverMutationActor;
  readonly contentType: string;
  readonly outcome: 'denied' | 'reconciliation_required' | 'rejected' | 'success';
  readonly errorCode?: string;
}) => {
  transferCounter.add(1, {
    content_type: input.contentType,
    outcome: input.outcome,
    ...(input.errorCode ? { error_code: input.errorCode } : {}),
  });
  const context = getWorkspaceContext();
  const details = {
    operation: 'mainserver_content_ownership_transfer',
    request_id: context.requestId,
    trace_id: context.traceId,
    instance_id: input.actor.instanceId,
    content_type: input.contentType,
    result: input.outcome,
    ...(input.errorCode ? { error_code: input.errorCode } : {}),
  };
  if (input.outcome === 'success') {
    logger.info('Mainserver content ownership transfer finished', details);
  } else {
    logger.warn('Mainserver content ownership transfer finished', details);
  }
};
