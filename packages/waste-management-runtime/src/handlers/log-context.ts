import { getWorkspaceContext } from '@sva/server-runtime';

export const buildLogContext = (
  scope: Readonly<{ kind: 'instance'; instanceId: string }>,
  options?: Readonly<{ includeTraceId?: boolean }>
): Record<string, string | undefined> => {
  const context = getWorkspaceContext();
  return {
    workspace_id: scope.instanceId,
    scope_kind: scope.kind,
    instance_id: scope.instanceId,
    request_id: context.requestId,
    ...(options?.includeTraceId ? { trace_id: context.traceId } : {}),
  };
};
