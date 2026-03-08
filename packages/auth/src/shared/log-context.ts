import { getWorkspaceContext } from '@sva/sdk/server';

export const buildLogContext = (
  workspaceId?: string,
  options?: { includeTraceId?: boolean }
): Record<string, string | undefined> => {
  const context = getWorkspaceContext();
  const base = {
    workspace_id: workspaceId ?? context.workspaceId ?? 'default',
    request_id: context.requestId,
  };

  if (options?.includeTraceId) {
    return {
      ...base,
      trace_id: context.traceId,
    };
  }

  return base;
};
