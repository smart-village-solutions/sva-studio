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
  it.each(
    [65_535, 65_536, 65_537].flatMap((size) =>
      ['declared', 'chunked'].map((encoding) => ({ size, encoding }))
    )
  )('bounds a $size-byte $encoding request before runtime dispatch', async ({ size, encoding }) => {
    const handle = vi.fn(async (request: Request) => {
      expect((await request.arrayBuffer()).byteLength).toBe(size);
      return new Response(null, { status: 204 });
    });
    const server = createPublicWasteHttpServer({ runtime: { handle } });
    runningServers.add(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    const status = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(
        {
          host: '127.0.0.1',
          port,
          path: '/unknown',
          method: 'POST',
          headers:
            encoding === 'declared'
              ? { 'content-length': size }
              : { 'transfer-encoding': 'chunked' },
        },
        (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode ?? 0));
        }
      );
      request.on('error', reject);
      request.end(Buffer.alloc(size));
    });
    expect(status).toBe(size > 65_536 ? 413 : 204);
    expect(handle).toHaveBeenCalledTimes(size > 65_536 ? 0 : 1);
  });

  it.each(['declared', 'chunked'])(
    'rejects an oversized %s body without waiting for the sender to finish',
    async (mode) => {
      const handle = vi.fn(async () => new Response(null, { status: 204 }));
      const server = createPublicWasteHttpServer({ runtime: { handle } });
      runningServers.add(server);
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const { port } = server.address() as AddressInfo;
      let client: ReturnType<typeof httpRequest> | undefined;
      let referrerPolicy: unknown;
      let contentTypeOptions: unknown;
      try {
        const status = await new Promise<number>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('No early rejection')), 1500);
          client = httpRequest(
            {
              host: '127.0.0.1',
              port,
              path: '/signup',
              method: 'POST',
              headers:
                mode === 'declared'
                  ? { 'content-length': 65_537 }
                  : { 'transfer-encoding': 'chunked' },
            },
            (response) => {
              clearTimeout(timer);
              referrerPolicy = response.headers['referrer-policy'];
              contentTypeOptions = response.headers['x-content-type-options'];
              response.resume();
              resolve(response.statusCode ?? 0);
            }
          );
          client.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
          });
          client.flushHeaders();
          if (mode === 'chunked') client.write(Buffer.alloc(65_537));
        });
        expect(status).toBe(413);
        expect(referrerPolicy).toBe('no-referrer');
        expect(contentTypeOptions).toBe('nosniff');
        expect(handle).not.toHaveBeenCalled();
      } finally {
        client?.destroy();
      }
    }
  );

  it('serves another connection while an incomplete body is pending and tolerates its abort', async () => {
    const handle = vi.fn(async () => new Response(null, { status: 204 }));
    const server = createPublicWasteHttpServer({ runtime: { handle } });
    runningServers.add(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    const pending = httpRequest({
      host: '127.0.0.1',
      port,
      method: 'POST',
      headers: { 'transfer-encoding': 'chunked' },
    });
    pending.on('error', () => undefined);
    try {
      const accepted = once(server, 'request');
      pending.write('incomplete');
      await accepted;
      const status = await new Promise<number>((resolve, reject) => {
        const healthy = httpRequest(
          { host: '127.0.0.1', port, path: '/health/live' },
          (response) => {
            response.resume();
            response.on('end', () => resolve(response.statusCode ?? 0));
          }
        );
        healthy.on('error', reject);
        healthy.end();
      });
      expect(status).toBe(204);
      expect(handle).toHaveBeenCalledTimes(1);
    } finally {
      const closed = new Promise<void>((resolve) => pending.once('close', () => resolve()));
      pending.destroy();
      await closed;
    }
  });

  it('forwards requests to the runtime handler and writes the response back', async () => {
    const handle = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe('/health/live');
      return new Response('ok', {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
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
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'self'");
    expect(response.headers['content-security-policy-report-only']).toContain("script-src 'self'");
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.body).toBe('ok');
    expect(handle).toHaveBeenCalledTimes(1);
  });
});
