import { once } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve(process.cwd(), '../../scripts/ci/keycloak-verify-mock.cjs');
const childProcesses = new Set<ChildProcess>();

const reservePort = async (): Promise<number> => {
  const server = createServer();
  server.unref();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Ephemerer Port konnte nicht bestimmt werden.');
  }
  const { port } = address;
  server.close();
  return port;
};

const waitForJson = async <T>(url: string): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return (await response.json()) as T;
      }
      lastError = new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

describe('keycloak-verify-mock', () => {
  afterEach(() => {
    for (const child of childProcesses) {
      child.kill('SIGTERM');
    }
    childProcesses.clear();
  });

  it('uses the explicit KEYCLOAK_BASE_URL for discovery metadata', async () => {
    const port = await reservePort();
    const child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        PORT: String(port),
        KEYCLOAK_REALM: 'sva-studio',
        KEYCLOAK_BASE_URL: 'http://verify-keycloak:38080',
      },
      stdio: 'ignore',
    });
    childProcesses.add(child);

    const config = await waitForJson<{
      issuer: string;
      token_endpoint: string;
      end_session_endpoint: string;
    }>(`http://127.0.0.1:${port}/realms/sva-studio/.well-known/openid-configuration`);

    expect(config.issuer).toBe('http://verify-keycloak:38080/realms/sva-studio');
    expect(config.token_endpoint).toBe('http://verify-keycloak:38080/realms/sva-studio/protocol/openid-connect/token');
    expect(config.end_session_endpoint).toBe(
      'http://verify-keycloak:38080/realms/sva-studio/protocol/openid-connect/logout'
    );
  });
});
