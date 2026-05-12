import type { AuthHandlers, AuthRoutePath, RouteGuardLogger } from './auth.route-handlers.types.js';
import {
  emitMethodNotAllowedDiagnostic,
  verifyRouteDiagnosticsLogger,
  wrapHandlersWithJsonErrorBoundary,
} from './auth.route-diagnostics.server.js';

const methodNotAllowedJson = (allow: string, requestId?: string) =>
  new Response(
    JSON.stringify({
      error: 'method_not_allowed',
      message: 'HTTP-Methode nicht erlaubt.',
      ...(requestId ? { requestId } : {}),
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        Allow: allow,
        ...(requestId ? { 'X-Request-Id': requestId } : {}),
      },
    }
  );

const createMethodNotAllowedResponse = (
  request: Request,
  route: string,
  allow: string,
  options: {
    readonly log?: boolean;
  } = {}
): Response => {
  return methodNotAllowedJson(allow, emitMethodNotAllowedDiagnostic(request, route, allow, options));
};

const matchesRoutePath = (pattern: string, pathname: string): boolean => {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return false;
  }

  return patternSegments.every((segment, index) => segment.startsWith('$') || segment === pathSegments[index]);
};

export const createMethodNotAllowedHandler =
  (route: AuthRoutePath, allow: string) =>
  async ({ request }: { request: Request }): Promise<Response> =>
    createMethodNotAllowedResponse(request, route, allow);

export const resolveRoutePathForRequestPath = <TPath extends string>(
  paths: readonly TPath[],
  pathname: string
): TPath | null => {
  const exactMatch = paths.find((path) => path === pathname);
  if (exactMatch) {
    return exactMatch;
  }

  return paths.find((path) => matchesRoutePath(path, pathname)) ?? null;
};

export const verifyRouteHandlerCoverage = (
  paths: readonly string[],
  handlers: Record<string, AuthHandlers>,
  log: RouteGuardLogger = verifyRouteDiagnosticsLogger()
): void => {
  const handlerKeys = Object.keys(handlers);
  const missingPaths = paths.filter((path) => !handlerKeys.includes(path));
  const extraPaths = handlerKeys.filter((path) => !paths.includes(path));
  const invalidHandlers = handlerKeys.flatMap((path) =>
    Object.entries(handlers[path] ?? {})
      .filter(([, handler]) => handler !== undefined && typeof handler !== 'function')
      .map(([method]) => `${path}#${method}`)
  );

  if (invalidHandlers.length > 0) {
    log.warn('Auth route mapping contains invalid handler registrations', {
      invalid_handlers: invalidHandlers.join(','),
      path_count: paths.length,
      handler_count: handlerKeys.length,
    });
    throw new Error(`Invalid auth route handler registration: ${invalidHandlers.join(', ')}`);
  }

  if (missingPaths.length === 0 && extraPaths.length === 0) {
    return;
  }

  log.warn('Auth route mapping differs from declared auth route paths', {
    missing_paths: missingPaths.join(','),
    extra_paths: extraPaths.join(','),
    path_count: paths.length,
    handler_count: handlerKeys.length,
  });
};

export const dispatchRouteRequest = async <TPath extends string>(input: {
  request: Request;
  resolveRoutePathForRequestPath: (pathname: string) => TPath | null;
  resolveHandlers: (path: TPath) => AuthHandlers;
  suppressMethodNotAllowedLogging?: (path: TPath) => boolean;
}): Promise<Response | null> => {
  const pathname = new URL(input.request.url).pathname;
  const matchedPath = input.resolveRoutePathForRequestPath(pathname);
  if (!matchedPath) {
    return null;
  }

  const handlers = wrapHandlersWithJsonErrorBoundary(input.resolveHandlers(matchedPath), matchedPath);
  const method = input.request.method.toUpperCase() as keyof AuthHandlers;
  const handler = handlers[method];

  if (!handler) {
    const allowedMethods = Object.keys(handlers)
      .sort((left, right) => left.localeCompare(right))
      .join(', ');
    return createMethodNotAllowedResponse(input.request, matchedPath, allowedMethods, {
      log: input.suppressMethodNotAllowedLogging?.(matchedPath) !== true,
    });
  }

  return handler({ request: input.request });
};

export { wrapHandlersWithJsonErrorBoundary };
