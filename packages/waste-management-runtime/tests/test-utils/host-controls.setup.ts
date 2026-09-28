import { vi } from 'vitest';

// Historical direct-handler tests supply domain dependencies, while production
// supplies this guard from the authenticated host composition.
vi.mock('../../src/handlers/host-controls.js', () => ({
  validateCsrf: (
    deps: { validateCsrf?: (request: Request, requestId?: string) => Response | null },
    request: Request,
    requestId?: string
  ): Response | null => {
    if (deps.validateCsrf) return deps.validateCsrf(request, requestId);
    const origin = request.headers.get('origin') ?? request.headers.get('referer');
    const trustedOrigin = (() => {
      try {
        return origin !== null && new URL(origin).origin === new URL(request.url).origin;
      } catch {
        return false;
      }
    })();
    if (
      request.headers.get('x-requested-with')?.toLowerCase() === 'xmlhttprequest' &&
      trustedOrigin
    ) {
      return null;
    }
    return new Response(JSON.stringify({ error: { code: 'csrf_validation_failed' }, requestId }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  },
}));

vi.mock('../../src/handlers/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/handlers/auth.js')>();
  const { evaluateAuthorizeDecision } =
    await vi.importActual<typeof import('@sva/iam-core')>('@sva/iam-core');
  const { createPermissionDenialDetailsForAction } =
    await vi.importActual<typeof import('@sva/core')>('@sva/core');
  const { createApiError } =
    await vi.importActual<typeof import('@sva/server-runtime')>('@sva/server-runtime');
  const { requireActorInstanceId } = await vi.importActual<
    typeof import('../../src/handlers/utils.js')
  >('../../src/handlers/utils.js');
  return {
    ...actual,
    authorizeWasteManagementAction: async (
      ctx: { user: { id: string; instanceId?: string } },
      action: string,
      deps: {
        resolvePermissions?: (input: {
          instanceId: string;
          keycloakSubject: string;
        }) => Promise<
          | { ok: true; permissions: readonly import('@sva/iam-core').EffectivePermission[] }
          | { ok: false; error: string }
        >;
      },
      requestId?: string
    ): Promise<Response | null> => {
      const instanceId = requireActorInstanceId(
        ctx as Parameters<typeof requireActorInstanceId>[0],
        requestId
      );
      if (instanceId instanceof Response) return instanceId;
      try {
        const result = await deps.resolvePermissions?.({
          instanceId,
          keycloakSubject: ctx.user.id,
        });
        if (!result?.ok) throw new Error('permissions_unavailable');
        const decision = evaluateAuthorizeDecision(
          {
            instanceId,
            action,
            resource: { type: 'waste-management' },
            context: requestId ? { requestId } : {},
          },
          result.permissions
        );
        if (decision.allowed) return null;
        return createApiError(
          403,
          'forbidden',
          'Keine Berechtigung für diese Waste-Management-Operation.',
          requestId,
          {
            ...createPermissionDenialDetailsForAction(action, decision.reason),
            action,
            reason_code: decision.reason,
          }
        );
      } catch {
        return createApiError(
          503,
          'database_unavailable',
          'Berechtigungen konnten nicht geprüft werden.',
          requestId
        );
      }
    },
  };
});
