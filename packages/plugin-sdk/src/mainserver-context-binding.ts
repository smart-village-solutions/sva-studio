import {
  createMainserverMutationHeaders,
  MAINSERVER_CONTEXT_BINDING_HEADER,
  type MainserverActingPrincipalType,
} from './mainserver-request.js';

export const createMainserverContextBindingStore = () => {
  const contextBindings = new Map<string, string>();
  const capture =
    (contentId: string) => (meta: { readonly ok: boolean; readonly contextBinding?: string }) => {
      if (!meta.ok) return;
      if (meta.contextBinding) contextBindings.set(contentId, meta.contextBinding);
      else contextBindings.delete(contentId);
    };
  const mutationHeaders = (
    contentId: string,
    actingPrincipalType: MainserverActingPrincipalType,
    headers?: HeadersInit,
    operationId?: string
  ): Headers => {
    const result = createMainserverMutationHeaders(actingPrincipalType, headers, operationId);
    const contextBinding = contextBindings.get(contentId);
    if (contextBinding) result.set(MAINSERVER_CONTEXT_BINDING_HEADER, contextBinding);
    return result;
  };
  return {
    capture,
    has: (contentId: string): boolean => contextBindings.has(contentId),
    invalidate: (contentId: string): void => {
      contextBindings.delete(contentId);
    },
    mutationHeaders,
  };
};

export type MainserverContextBindingStore = ReturnType<typeof createMainserverContextBindingStore>;

export const invalidateBindingOnStaleContext = <TError extends Error>(
  error: TError,
  contentId: string,
  invalidate: (contentId: string) => void
): never => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as Error & { readonly code?: unknown }).code === 'stale_mainserver_context'
  ) {
    invalidate(contentId);
  }
  throw error;
};
