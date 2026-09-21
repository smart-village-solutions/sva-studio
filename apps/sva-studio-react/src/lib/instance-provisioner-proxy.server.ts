const INSTANCE_PROVISIONER_BASE_URL = 'http://provisioner:3000';
const REQUEST_TIMEOUT_MS = 15_000;

const forwardedRoutes = new Map<string, ReadonlySet<string>>([
  ['/api/v1/iam/instances', new Set(['POST'])],
  ['/api/v1/iam/instances/draft-readiness', new Set(['POST'])],
  ['/api/v1/iam/instances/keycloak-realms', new Set(['GET'])],
]);

const hopByHopHeaders = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const unavailableResponse = (): Response =>
  Response.json(
    {
      error: {
        code: 'instance_provisioner_unavailable',
        message: 'Der interne Provisioning-Dienst ist derzeit nicht erreichbar.',
      },
    },
    { status: 503 }
  );

const isForwardedRoute = (request: Request, url: URL): boolean =>
  forwardedRoutes.get(url.pathname)?.has(request.method.toUpperCase()) === true;

const createForwardedHeaders = (request: Request, originalUrl: URL): Headers => {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase()) && !key.toLowerCase().startsWith('x-forwarded-')) {
      headers.set(key, value);
    }
  });
  headers.set('x-forwarded-host', originalUrl.host);
  headers.set('x-forwarded-proto', originalUrl.protocol.replace(/:$/, ''));
  return headers;
};

export const dispatchInstanceProvisionerRequest = async (
  request: Request
): Promise<Response | null> => {
  const originalUrl = new URL(request.url);
  if (!isForwardedRoute(request, originalUrl)) {
    return null;
  }

  const configuredBaseUrl = process.env.SVA_INSTANCE_PROVISIONER_INTERNAL_BASE_URL?.trim();
  if (!configuredBaseUrl) {
    return null;
  }
  if (configuredBaseUrl !== INSTANCE_PROVISIONER_BASE_URL) {
    return unavailableResponse();
  }

  const targetUrl = new URL(`${originalUrl.pathname}${originalUrl.search}`, configuredBaseUrl);
  const body =
    request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  try {
    return await fetch(targetUrl, {
      method: request.method,
      headers: createForwardedHeaders(request, originalUrl),
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return unavailableResponse();
  }
};
