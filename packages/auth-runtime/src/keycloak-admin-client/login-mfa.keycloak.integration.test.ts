/** Real provider/browser acceptance; opt in only against a disposable loopback Keycloak. */
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { KeycloakAdminClient } from './core.js';

const enabled = process.env.RUN_KEYCLOAK_MFA_INTEGRATION === '1';
let callback: string;
const isCallback = (url: URL): boolean => {
  const target = new URL(callback);
  return url.origin === target.origin && url.pathname === target.pathname;
};
const password = 'synthetic-browser-password';
type Claims = { acr?: string; auth_time?: number };
type User = { id: string; username: string };
type Session = { context: BrowserContext; page: Page; username: string };

describe.skipIf(!enabled)('tenant MFA real Keycloak/browser acceptance', () => {
  let base: string;
  let adminToken: string;
  let adminExpiresAt = 0;
  let provisionerId: string | undefined;
  let browser: Browser | undefined;
  let callbackServer: Server | undefined;
  let clientA: KeycloakAdminClient;
  let clientB: KeycloakAdminClient;
  const tag = `studio-mfa-test-${randomUUID()}`;
  const realmA = `${tag}-a`;
  const realmB = `${tag}-b`;
  const realms = [realmA, realmB];
  const createdRealms: string[] = [];
  const sessions: Session[] = [];
  const usedTicks = new Map<string, number>();

  const refreshAdminToken = async (): Promise<void> => {
    const response = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
      method: 'POST', body: new URLSearchParams({
        client_id: 'admin-cli', grant_type: 'password',
        username: process.env.KEYCLOAK_MFA_TEST_ADMIN_USERNAME ?? 'recording-test-admin',
        password: process.env.KEYCLOAK_MFA_TEST_ADMIN_PASSWORD ?? 'recording-test-password',
      }),
    });
    if (!response.ok) throw new Error(`Disposable bootstrap authentication failed: ${response.status}`);
    const token = await response.json() as { access_token: string; expires_in: number };
    adminToken = token.access_token;
    adminExpiresAt = Date.now() + Math.max(1, token.expires_in - 10) * 1000;
  };

  const api = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    if (Date.now() >= adminExpiresAt) await refreshAdminToken();
    const response = await fetch(`${base}/admin/realms/${path}`, {
      method,
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`Disposable Keycloak ${method} failed: ${response.status}`);
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  };

  const session = async (username: string): Promise<Session> => {
    if (!browser) throw new Error('Browser fixture not initialized');
    const context = await browser.newContext();
    const result = { context, page: await context.newPage(), username };
    sessions.push(result);
    return result;
  };

  const authorize = async (
    current: Session, realm: string, extra: Record<string, string> = {},
  ): Promise<string> => {
    const verifier = randomBytes(32).toString('base64url');
    const query = new URLSearchParams({
      client_id: 'ssf-frontend', redirect_uri: callback, response_type: 'code', scope: 'openid',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256', ...extra,
    });
    await current.page.goto(`${base}/realms/${realm}/protocol/openid-connect/auth?${query}`);
    return verifier;
  };

  const enterPassword = async ({ page, username }: Session): Promise<void> => {
    await expect.poll(() => page.locator('#password').isVisible()).toBe(true);
    const name = page.locator('#username');
    if (await name.isVisible() && await name.isEditable()) await name.fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#kc-login').click();
  };

  const otp = async (username: string, secret: string): Promise<string> => {
    const tick = Math.floor(Date.now() / 30_000);
    const remaining = 30_000 - Date.now() % 30_000;
    if (usedTicks.get(username) === tick || remaining < 1000) {
      await new Promise((resolve) => setTimeout(resolve, remaining + 200));
    }
    const current = Math.floor(Date.now() / 30_000);
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(current));
    // Keycloak's hidden enrollment value is the raw secret, not its displayed Base32 encoding.
    const digest = createHmac('sha1', Buffer.from(secret, 'utf8')).update(counter).digest();
    const offset = digest.readUInt8(digest.length - 1) & 15;
    usedTicks.set(username, current);
    return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
  };

  const enroll = async (current: Session): Promise<string> => {
    const secret = await current.page.locator('#totpSecret').inputValue();
    await current.page.locator('#totp').fill(await otp(current.username, secret));
    const label = current.page.locator('#userLabel');
    if (await label.isVisible()) await label.fill('Disposable test factor');
    await current.page.locator('#saveTOTPBtn').click();
    return secret;
  };

  const enterOtp = async (current: Session, secret: string): Promise<void> => {
    await current.page.locator('#otp').fill(await otp(current.username, secret));
    await current.page.locator('#kc-login').click();
  };

  const claims = async (
    current: Session, realm: string, verifier: string, clientId = 'ssf-frontend',
  ): Promise<Claims> => {
    try {
      await current.page.waitForURL(isCallback, { timeout: 20_000 });
    } catch {
      const fields = await current.page.locator('input').evaluateAll((elements) =>
        elements.map((element) => ({ id: element.id, type: element.type })));
      throw new Error(`Disposable authorization did not complete at ${new URL(current.page.url()).pathname}; fields=${JSON.stringify(fields)}`);
    }
    const code = new URL(current.page.url()).searchParams.get('code');
    if (!code) throw new Error('Disposable authorization produced no code');
    const response = await fetch(`${base}/realms/${realm}/protocol/openid-connect/token`, {
      method: 'POST', body: new URLSearchParams({
        grant_type: 'authorization_code', client_id: clientId, redirect_uri: callback,
        code, code_verifier: verifier,
      }),
    });
    if (!response.ok) throw new Error(`Disposable token exchange failed: ${response.status}`);
    const token = await response.json() as { access_token: string };
    const payload = token.access_token.split('.')[1];
    if (!payload) throw new Error('Disposable access token is malformed');
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as Claims;
  };

  beforeAll(async () => {
    base = process.env.KEYCLOAK_MFA_TEST_BASE_URL ?? '';
    const target = new URL(base);
    if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.pathname !== '/') {
      throw new Error('Real MFA acceptance requires a disposable http://127.0.0.1:<port> server');
    }
    base = target.origin;
    await refreshAdminToken();
    const serviceSecret = randomBytes(32).toString('base64url');
    await api('POST', 'master/clients', {
      clientId: tag, secret: serviceSecret, enabled: true, publicClient: false,
      serviceAccountsEnabled: true,
    });
    const service = await api<{ id: string }[]>('GET', `master/clients?clientId=${tag}`);
    const provisioner = service[0];
    if (!provisioner) throw new Error('Disposable provisioner not found');
    provisionerId = provisioner.id;
    const account = await api<User>('GET', `master/clients/${provisionerId}/service-account-user`);
    const role = await api<unknown>('GET', 'master/roles/admin');
    await api('POST', `master/users/${account.id}/role-mappings/realm`, [role]);
    const listener = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('Disposable callback');
    });
    callbackServer = listener;
    await new Promise<void>((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', resolve);
    });
    const address = listener.address();
    if (!address || typeof address === 'string') throw new Error('Callback listener did not bind');
    callback = `http://127.0.0.1:${address.port}/callback`;
    for (const realm of realms) {
      await api('POST', '', { realm, enabled: true });
      createdRealms.push(realm);
      for (const clientId of ['studio-client', 'ssf-frontend']) {
        await api('POST', `${realm}/clients`, {
          clientId, enabled: true, publicClient: true, standardFlowEnabled: true,
          redirectUris: [callback], webOrigins: [new URL(callback).origin],
        });
      }
      for (const username of ['ordinary', 'voluntary']) {
        await api('POST', `${realm}/users`, {
          username, enabled: true, firstName: 'Synthetic', lastName: 'Tester',
          email: `${username}@example.org`, emailVerified: true,
          credentials: [{ type: 'password', value: password, temporary: false }],
        });
      }
    }
    const makeClient = (realm: string) => new KeycloakAdminClient({
      baseUrl: base, realm, adminRealm: 'master', clientId: tag, clientSecret: serviceSecret,
    });
    clientA = makeClient(realmA);
    clientB = makeClient(realmB);
    for (const client of [clientA, clientB]) {
      await client.ensureLoginMfaPolicy({ mode: 'optional', clientIds: ['studio-client', 'ssf-frontend'] });
    }
    browser = await chromium.launch({
      headless: true,
      ...(process.env.KEYCLOAK_MFA_TEST_BROWSER_EXECUTABLE
        ? { executablePath: process.env.KEYCLOAK_MFA_TEST_BROWSER_EXECUTABLE } : {}),
      args: ['--no-sandbox'],
    });
  }, 120_000);

  afterAll(async () => {
    await Promise.allSettled(sessions.map((current) => current.context.close()));
    await browser?.close().catch(() => undefined);
    const cleanup: Promise<unknown>[] = [];
    for (const realm of createdRealms.reverse()) {
      if (!realm.startsWith(`${tag}-`)) throw new Error('Refusing to delete an unowned test realm');
      cleanup.push(api('DELETE', realm));
    }
    if (provisionerId) cleanup.push(api('DELETE', `master/clients/${provisionerId}`));
    const cleaned = await Promise.allSettled(cleanup);
    const listener = callbackServer;
    if (listener?.listening) {
      listener.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        listener.close((error) => error ? reject(error) : resolve());
      });
    }
    if (cleaned.some((result) => result.status === 'rejected')) {
      throw new Error('Disposable Keycloak cleanup failed');
    }
  }, 30_000);

  it('enforces voluntary/required factors, preserves SSO and certifies fresh step-up', async () => {
    const realm = realmA;
    const ordinary = await session('ordinary');
    let verifier = await authorize(ordinary, realm);
    await enterPassword(ordinary);
    expect((await claims(ordinary, realm, verifier)).acr).not.toBe('mfa');
    verifier = await authorize(ordinary, realm);
    expect((await claims(ordinary, realm, verifier)).acr).not.toBe('mfa');
    expect(await ordinary.page.locator('#password').count()).toBe(0);

    const voluntary = await session('voluntary');
    verifier = await authorize(voluntary, realm, { kc_action: 'CONFIGURE_TOTP' });
    await enterPassword(voluntary);
    const secret = await enroll(voluntary);
    await claims(voluntary, realm, verifier);
    verifier = await authorize(voluntary, realm, { prompt: 'login' });
    await enterPassword(voluntary);
    await enterOtp(voluntary, secret);
    await claims(voluntary, realm, verifier);

    const stepUpStarted = Math.floor(Date.now() / 1000);
    verifier = await authorize(voluntary, realm, { acr_values: 'mfa', max_age: '0' });
    await enterPassword(voluntary);
    await enterOtp(voluntary, secret);
    const fresh = await claims(voluntary, realm, verifier);
    expect(fresh.acr).toBe('mfa');
    expect(fresh.auth_time).toBeTypeOf('number');
    if (typeof fresh.auth_time !== 'number') throw new Error('MFA token has no authentication time');
    expect(fresh.auth_time).toBeGreaterThanOrEqual(stepUpStarted - 1);
    expect(Math.floor(Date.now() / 1000) - fresh.auth_time).toBeGreaterThanOrEqual(-60);
    expect(Math.floor(Date.now() / 1000) - fresh.auth_time).toBeLessThanOrEqual(300);

    await clientA.ensureLoginMfaPolicy({ mode: 'required', clientIds: ['studio-client', 'ssf-frontend'] });
    // The ordinary user's existing password-only SSO cookie must not bypass enrollment.
    verifier = await authorize(ordinary, realm);
    if (await ordinary.page.locator('#password').isVisible()) await enterPassword(ordinary);
    const ordinarySecret = await enroll(ordinary);
    expect((await claims(ordinary, realm, verifier)).acr).toBe('mfa');
    expect(ordinarySecret.length).toBeGreaterThan(0);

    await api('POST', `${realm}/users`, {
      username: 'new-staff', enabled: true, firstName: 'Synthetic', lastName: 'New tester',
      email: 'new-staff@example.org', emailVerified: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
    });
    const newStaff = await session('new-staff');
    verifier = await authorize(newStaff, realm, { client_id: 'studio-client' });
    await enterPassword(newStaff);
    await enroll(newStaff);
    expect((await claims(newStaff, realm, verifier, 'studio-client')).acr).toBe('mfa');

    const other = await session('ordinary');
    verifier = await authorize(other, realmB);
    await enterPassword(other);
    expect((await claims(other, realmB, verifier)).acr).not.toBe('mfa');

    await clientA.ensureLoginMfaPolicy({ mode: 'optional', clientIds: ['studio-client', 'ssf-frontend'] });
    const users = await api<User[]>('GET', `${realm}/users?username=ordinary`);
    const ordinaryUser = users[0];
    if (!ordinaryUser) throw new Error('Disposable ordinary user not found');
    const credentials = await api<{ type: string }[]>('GET', `${realm}/users/${ordinaryUser.id}/credentials`);
    expect(credentials.some((credential) => credential.type === 'otp')).toBe(true);
    verifier = await authorize(ordinary, realm);
    if (await ordinary.page.locator('#password').isVisible()) await enterPassword(ordinary);
    await enterOtp(ordinary, ordinarySecret);
    await claims(ordinary, realm, verifier);
    const before = await api<{ id: string; alias: string }[]>('GET', `${realm}/authentication/flows`);
    await clientA.ensureLoginMfaPolicy({ mode: 'optional', clientIds: ['studio-client', 'ssf-frontend'] });
    expect(await api('GET', `${realm}/authentication/flows`)).toEqual(before);
    expect((await clientA.readLoginMfaPolicy({ mode: 'optional', clientIds: ['studio-client', 'ssf-frontend'] })).aligned).toBe(true);
  }, 180_000);

  it('preserves an unmanaged realm browser binding and reports the conflict', async () => {
    const realm = realmB;
    const alias = `${tag}-custom-browser`;
    await api('POST', `${realm}/authentication/flows`, {
      alias, providerId: 'basic-flow', topLevel: true, builtIn: false,
    });
    await api('PUT', realm, { realm, browserFlow: alias });
    await expect(clientB.ensureLoginMfaPolicy({
      mode: 'required', clientIds: ['studio-client', 'ssf-frontend'],
    })).rejects.toThrow('login_mfa_binding_conflict');
    expect((await api<{ browserFlow: string }>('GET', realm)).browserFlow).toBe(alias);
  });
});
