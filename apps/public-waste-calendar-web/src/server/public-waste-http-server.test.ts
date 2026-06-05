import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPublicWasteHttpServer } from './public-waste-http-server.js';

const runningServers = new Set<ReturnType<typeof createPublicWasteHttpServer>>();

afterEach(async () => {
  await Promise.all(
    [...runningServers].map(
      async (server) =>
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        })
    )
  );
  runningServers.clear();
});

describe('public waste http server', () => {
  it('forwards requests to the runtime handler and writes the response back', async () => {
    const handle = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe('/health/live');
      return new Response('ok', {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-runtime': 'public-waste',
        },
      });
    });

    const server = createPublicWasteHttpServer({
      runtime: {
        handle,
      },
    });
    runningServers.add(server);

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const { port } = server.address() as AddressInfo;
    const response = await new Promise<{
      readonly status: number;
      readonly headers: Record<string, string | string[] | undefined>;
      readonly body: string;
    }>((resolve, reject) => {
      const request = httpRequest(
        {
          host: '127.0.0.1',
          port,
          path: '/health/live',
          method: 'GET',
        },
        (result) => {
          let body = '';
          result.setEncoding('utf8');
          result.on('data', (chunk) => {
            body += chunk;
          });
          result.on('end', () => {
            resolve({
              status: result.statusCode ?? 0,
              headers: result.headers,
              body,
            });
          });
        }
      );

      request.on('error', reject);
      request.end();
    });

    expect(response.status).toBe(200);
    expect(response.headers['x-runtime']).toBe('public-waste');
    expect(response.body).toBe('ok');
    expect(handle).toHaveBeenCalledTimes(1);
  });
});
