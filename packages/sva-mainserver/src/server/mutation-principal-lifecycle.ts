import type { MainserverLifecycleStatus } from './mutation-principal-types.js';

export const resolveMainserverLifecycleAction = (
  currentStatus: MainserverLifecycleStatus,
  nextStatus: MainserverLifecycleStatus
):
  | 'content.archive'
  | 'content.changeStatus'
  | 'content.publish'
  | 'content.restore'
  | undefined => {
  if (currentStatus === nextStatus) return undefined;
  if (nextStatus === 'published') return 'content.publish';
  if (nextStatus === 'archived') return 'content.archive';
  return currentStatus === 'archived' ? 'content.restore' : 'content.changeStatus';
};

export const resolveMainserverVisibilityAction = (
  currentVisible: boolean,
  nextVisible: boolean | undefined
): 'content.changeStatus' | 'content.publish' | undefined =>
  nextVisible === undefined || nextVisible === currentVisible
    ? undefined
    : nextVisible
      ? 'content.publish'
      : 'content.changeStatus';

export const toMainserverAdditionalActions = (action: string | undefined): readonly string[] =>
  action ? [action] : [];
