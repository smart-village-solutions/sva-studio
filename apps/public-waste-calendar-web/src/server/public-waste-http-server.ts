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

const readRequestBody = async (request: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
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
    try {
      const runtimeResponse = await input.runtime.handle(await toRequest(request));
      await writeResponse(response, runtimeResponse);
    } catch (error) {
      response.statusCode = 500;
      response.setHeader('content-type', 'text/plain; charset=utf-8');
      response.end('Internal Server Error');
    }
  });
