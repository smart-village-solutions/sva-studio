import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertStandardProductionReadiness } from './verify-promote-readiness.ts';

describe('pre-mutation production readiness', () => {
  it('does not follow a readiness redirect before validating its status', async () => {
    let followedRedirect = false;
    const server = createServer((request, response) => {
      if (request.url === '/health/ready') {
        response.writeHead(302, { location: '/redirected' }).end();
        return;
      }
      followedRedirect = true;
      response.writeHead(200).end();
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Readiness-Testserver fehlt.');

    try {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', resolve(import.meta.dirname, 'verify-promote-readiness.ts'), 'prod'],
        {
          env: {
            PATH: process.env.PATH,
            PROMOTE_MODE: 'standard',
            SVA_PUBLIC_BASE_URL: `http://127.0.0.1:${address.port}`,
          },
          stdio: ['ignore', 'ignore', 'pipe'],
        }
      );
      let stderr = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });
      const [exitCode] = await once(child, 'close');

      expect(exitCode).toBe(1);
      expect(stderr).toContain('PROMOTE_READINESS_NOT_READY');
      expect(followedRedirect).toBe(false);
    } finally {
      server.close();
    }
  }, 20_000);

  it.each([204, 302, 401, 503])('rejects HTTP %i for standard production', (status) => {
    expect(() =>
      assertStandardProductionReadiness({ environment: 'prod', mode: 'standard', status })
    ).toThrow(/PROMOTE_READINESS_NOT_READY/u);
  });

  it('permits HTTP 200 in standard production and skips the pre-mutation check outside it', () => {
    expect(() =>
      assertStandardProductionReadiness({ environment: 'prod', mode: 'standard', status: 200 })
    ).not.toThrow();
    expect(() =>
      assertStandardProductionReadiness({ environment: 'prod', mode: 'recovery', status: 503 })
    ).not.toThrow();
    expect(() =>
      assertStandardProductionReadiness({ environment: 'staging', mode: 'standard', status: 503 })
    ).not.toThrow();
    expect(() =>
      assertStandardProductionReadiness({ environment: 'dev', mode: 'standard', status: 503 })
    ).not.toThrow();
  });
});
