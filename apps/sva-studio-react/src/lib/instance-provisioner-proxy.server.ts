const INSTANCE_PROVISIONER_BASE_URL = 'http://provisioner:3000';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

class InstanceProvisionerPayloadTooLargeError extends Error {}

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

const payloadTooLargeResponse = (): Response =>
  Response.json(
    {
      error: {
        code: 'instance_provisioner_payload_too_large',
        message: 'Der Request ist zu groß.',
      },
    },
    { status: 413 }
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

const hasOversizedDeclaredBody = (request: Request): boolean => {
  const contentLength = request.headers.get('content-length')?.trim();
  if (!contentLength || !/^\d+$/u.test(contentLength)) {
    return false;
  }

  return Number(contentLength) > MAX_REQUEST_BODY_BYTES;
};

const createBoundedBodyStream = (
  request: Request,
  signal: AbortSignal
):
  | {
      readonly stream: ReadableStream<Uint8Array>;
      readonly exceededLimit: () => boolean;
    }
  | undefined => {
  if (!request.body) {
    return undefined;
  }

  let receivedBytes = 0;
  let limitExceeded = false;
  return {
    stream: request.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          receivedBytes += chunk.byteLength;
          if (receivedBytes > MAX_REQUEST_BODY_BYTES) {
            limitExceeded = true;
            controller.error(new InstanceProvisionerPayloadTooLargeError());
            return;
          }
          controller.enqueue(chunk);
        },
      }),
      { signal }
    ),
    exceededLimit: () => limitExceeded,
  };
};

export const dispatchInstanceProvisionerRequest = async (
  request: Request
): Promise<Response | null> => {
  const originalUrl = new URL(request.url);
  if (!isForwardedRoute(request, originalUrl)) {
    return null;
  }
  if (process.env.SVA_INSTANCE_PROVISIONER_LOCAL_HANDLING?.trim() === 'true') {
    return null;
  }

  const configuredBaseUrl = process.env.SVA_INSTANCE_PROVISIONER_INTERNAL_BASE_URL?.trim();
  if (!configuredBaseUrl) {
    return unavailableResponse();
  }
  if (configuredBaseUrl !== INSTANCE_PROVISIONER_BASE_URL) {
    return unavailableResponse();
  }
  if (hasOversizedDeclaredBody(request)) {
    return payloadTooLargeResponse();
  }

  const targetUrl = new URL(`${originalUrl.pathname}${originalUrl.search}`, configuredBaseUrl);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const boundedBody =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : createBoundedBodyStream(request, signal);
  const body = boundedBody?.stream;
  const requestInit: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: createForwardedHeaders(request, originalUrl),
    body,
    redirect: 'manual',
    signal,
  };
  if (body) {
    requestInit.duplex = 'half';
  }
  try {
    return await fetch(targetUrl, requestInit);
  } catch (error) {
    if (error instanceof InstanceProvisionerPayloadTooLargeError || boundedBody?.exceededLimit()) {
      return payloadTooLargeResponse();
    }
    return unavailableResponse();
  }
};
