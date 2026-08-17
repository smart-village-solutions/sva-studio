import { withMediaService } from './repository.js';

export type MarkMediaContentSaveFromMainserverResult =
  'marked' | 'not_found' | 'target_mismatch' | 'state_conflict';

export const markMediaContentSaveFromMainserverMutation = async (input: {
  readonly instanceId: string;
  readonly actorSubject: string;
  readonly operationId: string;
  readonly targetType: string;
  readonly targetId: string;
}): Promise<MarkMediaContentSaveFromMainserverResult> =>
  withMediaService(input.instanceId, async (service) => {
    const operation = await service.getContentSaveOperation({
      instanceId: input.instanceId,
      operationId: input.operationId,
      actorSubject: input.actorSubject,
    });
    if (!operation) {
      return 'not_found';
    }
    if (operation.targetType !== input.targetType) {
      return 'target_mismatch';
    }
    const marked = await service.markContentSaveOperationContentSaved({
      instanceId: input.instanceId,
      operationId: input.operationId,
      actorSubject: input.actorSubject,
      targetId: input.targetId,
    });
    return marked ? 'marked' : 'state_conflict';
  });
