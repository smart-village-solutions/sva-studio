import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { PublicWasteRuntime } from './public-waste-runtime.js';

const normalizeForwardedProto = (value: string | readonly string[] | undefined): string | null => {
  if (typeof value === 'string') {
    return value.split(',')[0]?.trim() ?? null;
  }

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? null;
  }

  return null;
};

const MAX_REQUEST_BODY_BYTES = 65_536;
class RequestBodyTooLargeError extends Error {}

const readRequestBody = async (request: IncomingMessage): Promise<Buffer> => {
  if (Number(request.headers['content-length']) > MAX_REQUEST_BODY_BYTES) {
    throw new RequestBodyTooLargeError();
  }
  const chunks: Buffer[] = [];
  let byteLength = 0;
  // Keep the socket alive long enough to deliver the rejection on early iterator return.
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const buffer: Buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    byteLength += buffer.length;
    if (byteLength > MAX_REQUEST_BODY_BYTES) throw new RequestBodyTooLargeError();
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, byteLength);
};

const toRequest = async (request: IncomingMessage): Promise<Request> => {
  const method = (request.method ?? 'GET').toUpperCase();
  const protocol = normalizeForwardedProto(request.headers['x-forwarded-proto']) ?? 'http';
  const host = request.headers.host ?? 'localhost';
  const url = new URL(request.url ?? '/', `${protocol}://${host}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') {
      headers.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      headers.set(key, value.join(', '));
    }
  }

  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, { method, headers });
  }

  const body = await readRequestBody(request);

  return new Request(url, {
    method,
    headers,
    body: new Uint8Array(body),
  });
};

const writeResponse = async (nodeResponse: ServerResponse, response: Response): Promise<void> => {
  nodeResponse.statusCode = response.status;
  nodeResponse.statusMessage = response.statusText;
  response.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  if (!nodeResponse.hasHeader('x-content-type-options'))
    nodeResponse.setHeader('x-content-type-options', 'nosniff');
  if (!nodeResponse.hasHeader('referrer-policy'))
    nodeResponse.setHeader('referrer-policy', 'no-referrer');
  if (response.headers.get('content-type')?.includes('text/html')) {
    if (!nodeResponse.hasHeader('content-security-policy') && !nodeResponse.hasHeader('x-frame-options'))
      nodeResponse.setHeader('content-security-policy', 'frame-ancestors *');
    if (
      !nodeResponse.hasHeader('content-security-policy-report-only') &&
      !response.headers.has('content-security-policy')
    ) {
      nodeResponse.setHeader(
        'content-security-policy-report-only',
        "script-src 'self'; object-src 'none'; base-uri 'self'"
      );
    }
  }

  if (!response.body) {
    nodeResponse.end();
    return;
  }

  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
};

export const createPublicWasteHttpServer = (input: {
  readonly runtime: Pick<PublicWasteRuntime, 'handle'>;
}): Server =>
  createServer(async (request, response) => {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    try {
      const runtimeResponse = await input.runtime.handle(await toRequest(request));
      await writeResponse(response, runtimeResponse);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        request.pause();
        response.statusCode = 413;
        response.shouldKeepAlive = false;
        response.setHeader('connection', 'close');
        response.end();
        return;
      }
      response.statusCode = 500;
      response.setHeader('content-type', 'text/plain; charset=utf-8');
      response.end('Internal Server Error');
    }
  });
