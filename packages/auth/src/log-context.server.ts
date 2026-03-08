import { getWorkspaceContext } from '@sva/sdk/server';

export const buildLogContext = (workspaceId?: string) => {
  const context = getWorkspaceContext();
  return {
    workspace_id: workspaceId ?? context.workspaceId ?? 'default',
    request_id: context.requestId,
  };
};

export const isTokenErrorLike = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const typed = error as { name?: unknown; code?: unknown; error?: unknown };
  const name = typeof typed.name === 'string' ? typed.name.toLowerCase() : '';
  const code = typeof typed.code === 'string' ? typed.code.toLowerCase() : '';
  const oauthError = typeof typed.error === 'string' ? typed.error.toLowerCase() : '';
  return (
    name.includes('token') ||
    name.includes('oauth') ||
    code.includes('token') ||
    oauthError.length > 0
  );
};
