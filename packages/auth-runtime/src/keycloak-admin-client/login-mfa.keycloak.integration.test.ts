/** Real provider/browser acceptance; opt in only against a disposable loopback Keycloak. */
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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
      method: 'POST',
      body: new URLSearchParams({
        client_id: 'admin-cli',
        grant_type: 'password',
        username: process.env.KEYCLOAK_MFA_TEST_ADMIN_USERNAME ?? 'recording-test-admin',
        password: process.env.KEYCLOAK_MFA_TEST_ADMIN_PASSWORD ?? 'recording-test-password',
      }),
    });
    if (!response.ok)
      throw new Error(`Disposable bootstrap authentication failed: ${response.status}`);
    const token = (await response.json()) as { access_token: string; expires_in: number };
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
    current: Session,
    realm: string,
    extra: Record<string, string> = {}
  ): Promise<string> => {
    const verifier = randomBytes(32).toString('base64url');
    const query = new URLSearchParams({
      client_id: 'ssf-frontend',
      redirect_uri: callback,
      response_type: 'code',
      scope: 'openid',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      ...extra,
    });
    await current.page.goto(`${base}/realms/${realm}/protocol/openid-connect/auth?${query}`);
    return verifier;
  };

  const enterPassword = async ({ page, username }: Session): Promise<void> => {
    await expect.poll(() => page.locator('#password').isVisible()).toBe(true);
    const name = page.locator('#username');
    if ((await name.isVisible()) && (await name.isEditable())) await name.fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#kc-login').click();
  };

  const otp = async (username: string, secret: string): Promise<string> => {
    const tick = Math.floor(Date.now() / 30_000);
    const remaining = 30_000 - (Date.now() % 30_000);
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

  const tokenForCode = async (
    current: Session,
    realm: string,
    verifier: string,
    clientId = 'ssf-frontend',
    clientSecret?: string
  ): Promise<string> => {
    try {
      await current.page.waitForURL(isCallback, { timeout: 20_000 });
    } catch {
      const fields = await current.page
        .locator('input')
        .evaluateAll((elements) =>
          elements.map((element) => ({ id: element.id, type: element.type }))
        );
      throw new Error(
        `Disposable authorization did not complete at ${new URL(current.page.url()).pathname}; fields=${JSON.stringify(fields)}`
      );
    }
    const code = new URL(current.page.url()).searchParams.get('code');
    if (!code) throw new Error('Disposable authorization produced no code');
    const response = await fetch(`${base}/realms/${realm}/protocol/openid-connect/token`, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: callback,
        code,
        code_verifier: verifier,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
      }),
    });
    if (!response.ok) throw new Error(`Disposable token exchange failed: ${response.status}`);
    const token = (await response.json()) as { access_token: string };
    return token.access_token;
  };
  const claims = async (
    current: Session,
    realm: string,
    verifier: string,
    clientId = 'ssf-frontend'
  ): Promise<Claims> => {
    const payload = (await tokenForCode(current, realm, verifier, clientId)).split('.')[1];
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
      clientId: tag,
      secret: serviceSecret,
      enabled: true,
      publicClient: false,
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
          clientId,
          enabled: true,
          publicClient: true,
          standardFlowEnabled: true,
          redirectUris: [callback],
          webOrigins: [new URL(callback).origin],
        });
      }
      for (const username of ['ordinary', 'voluntary']) {
        await api('POST', `${realm}/users`, {
          username,
          enabled: true,
          firstName: 'Synthetic',
          lastName: 'Tester',
          email: `${username}@example.org`,
          emailVerified: true,
          credentials: [{ type: 'password', value: password, temporary: false }],
        });
      }
    }
    const makeClient = (realm: string) =>
      new KeycloakAdminClient({
        baseUrl: base,
        realm,
        adminRealm: 'master',
        clientId: tag,
        clientSecret: serviceSecret,
      });
    clientA = makeClient(realmA);
    clientB = makeClient(realmB);
    for (const client of [clientA, clientB]) {
      await client.ensureLoginMfaPolicy({
        mode: 'optional',
        clientIds: ['studio-client', 'ssf-frontend'],
      });
    }
    browser = await chromium.launch({
      headless: true,
      ...(process.env.KEYCLOAK_MFA_TEST_BROWSER_EXECUTABLE
        ? { executablePath: process.env.KEYCLOAK_MFA_TEST_BROWSER_EXECUTABLE }
        : {}),
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
        listener.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (cleaned.some((result) => result.status === 'rejected')) {
      throw new Error('Disposable Keycloak cleanup failed');
    }
  }, 30_000);

  it.skipIf(process.env.RUN_SSF_EXCHANGE_INTEGRATION !== '1')(
    'exchanges a tenant Studio MFA session retaining its identity and refuses other realms and audiences',
    async () => {
      const clientId = 'recording-studio',
        secret = randomBytes(30).toString('hex'),
        instanceId = 'fixture-' + randomUUID();
      const fixturePermissions = [
        'ssf.configuration.tenant.manage',
        'ssf.recording.access.transfer',
      ];
      for (const [realm, client] of [
        [realmA, clientA],
        [realmB, clientB],
      ] as const) {
        await api('POST', realm + '/clients', {
          clientId,
          secret,
          publicClient: false,
          standardFlowEnabled: true,
          enabled: true,
          redirectUris: [callback],
          attributes: {
            managed_by: 'studio',
            instance_id: instanceId,
            artifact_key: 'login_client',
          },
        });
        await client.ensureSsfRecordingExchange(clientId, instanceId);
        await client.ensureSsfExchangeAssuranceMapper(clientId, 'ssf-frontend');
        await client.ensureAdminOnlyUserProfileAttributes([
          { name: 'studio_tenant_id', multivalued: false },
          { name: 'ssf_permissions', multivalued: true },
        ]);
        for (const name of ['studio_tenant_id', 'ssf_permissions'])
          await client.ensureUserAttributeProtocolMapper({
            clientId,
            name: 'studio-' + name.replaceAll('_', '-'),
            userAttribute: name,
            claimName: name,
            exclusiveClaim: true,
            multivalued: name === 'ssf_permissions',
          });
        await client.ensureAudienceProtocolMapper({
          clientId,
          name: 'studio-ssf-recording-audience',
          audience: 'ssf-frontend',
        });
        await client.ensureLoginMfaPolicy({
          mode: 'optional',
          clientIds: [clientId, 'ssf-frontend', 'studio-client'],
        });
      }
      const username = 'exchange-user';
      await api('POST', realmA + '/users', {
        username,
        firstName: 'Fixture',
        lastName: 'User',
        email: username + '@example.org',
        emailVerified: true,
        enabled: true,
        attributes: {
          studio_tenant_id: [instanceId],
          ssf_permissions: fixturePermissions,
        },
        credentials: [{ type: 'password', value: password, temporary: false }],
      });
      const current = await session(username);
      const verifier = await authorize(current, realmA, {
        client_id: clientId,
        acr_values: 'mfa',
        max_age: '0',
      });
      await enterPassword(current);
      await enroll(current);
      const source = await tokenForCode(current, realmA, verifier, clientId, secret);
      const decode = (token: string) =>
        JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as Record<
          string,
          unknown
        >;
      const initial = decode(source);
      expect(initial).toMatchObject({
        azp: clientId,
        studio_tenant_id: instanceId,
        ssf_permissions: fixturePermissions,
      });
      expect(initial.acr).toBe('mfa');
      expect(initial.auth_time).toBeTypeOf('number');
      const exchange = (realm: string, audience: string) =>
        fetch(base + '/realms/' + realm + '/protocol/openid-connect/token', {
          method: 'POST',
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
            client_id: clientId,
            client_secret: secret,
            subject_token: source,
            subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
            requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
            audience,
          }),
        });
      const response = await exchange(realmA, 'ssf-frontend');
      expect(response.status).toBe(200);
      const result = decode(((await response.json()) as { access_token: string }).access_token);
      expect(result).toMatchObject({
        sub: initial.sub,
        sid: initial.sid,
        iss: initial.iss,
        azp: clientId,
        acr: initial.acr,
        auth_time: initial.auth_time,
        aud: 'ssf-frontend',
        studio_tenant_id: instanceId,
        ssf_permissions: fixturePermissions,
      });
      expect((await exchange(realmB, 'ssf-frontend')).ok).toBe(false);
      expect((await exchange(realmA, 'unprovisioned-audience')).ok).toBe(false);
      const directory = process.env.SSF_RECORDING_JOURNEY_DIRECTORY,
        seed = process.env.SSF_RECORDING_JOURNEY_SEED;
      if (directory && seed) {
        const otherTenant = 'fixture-' + randomUUID();
        await api('POST', realmB + '/users', {
          username,
          firstName: 'Fixture',
          lastName: 'User',
          email: username + '@example.org',
          emailVerified: true,
          enabled: true,
          attributes: { studio_tenant_id: [otherTenant], ssf_permissions: fixturePermissions },
          credentials: [{ type: 'password', value: password, temporary: false }],
        });
        const other = await session(username),
          otherVerifier = await authorize(other, realmB, {
            client_id: clientId,
            acr_values: 'mfa',
            max_age: '0',
          });
        await enterPassword(other);
        await enroll(other);
        const otherSource = await tokenForCode(other, realmB, otherVerifier, clientId, secret),
          otherClaims = decode(otherSource);
        const { recordingGatewayJourney } =
          await import('../../../plugin-ssf/tests/recording-gateway-journey.js');
        const sessions = await import('../redis-session.js'),
          config = await import('../config.js'),
          host = await import('../ssf-recording-gateway.js');
        const sessionStore = vi.spyOn(sessions, 'getSession'),
          tenantConfig = vi.spyOn(config, 'resolveAuthConfigForInstance');
        try {
          await recordingGatewayJourney({
            tenant: instanceId,
            actor: String(initial.sub),
            realm: realmA,
            otherTenant,
            otherActor: String(otherClaims.sub),
            otherRealm: realmB,
            directory,
            seed,
            forward: (which, handlerId, request, operation) => {
              const sourceToken = which === 'current' ? source : otherSource,
                claims = which === 'current' ? initial : otherClaims,
                tenant = which === 'current' ? instanceId : otherTenant;
              const issuer = String(claims.iss),
                userId = String(claims.sub);
              sessionStore.mockResolvedValue({
                id: 'fixture-session',
                userId,
                createdAt: Date.now(),
                accessToken: sourceToken,
                auth: {
                  kind: 'instance',
                  instanceId: tenant,
                  issuer,
                  clientId,
                  postLogoutRedirectUri: '/',
                },
              });
              tenantConfig.mockResolvedValue({
                kind: 'instance',
                instanceId: tenant,
                issuer,
                clientId,
                clientSecret: secret,
              } as Awaited<ReturnType<typeof config.resolveAuthConfigForInstance>>);
              return host.forwardSsfRecordingRequest(
                {
                  scope: 'tenant',
                  sessionId: 'fixture-session',
                  pluginId: 'ssf',
                  handlerId,
                  request,
                  pathParams: {},
                  actor: { id: userId, instanceId: tenant, roles: [] },
                },
                operation
              );
            },
          });
        } finally {
          sessionStore.mockRestore();
          tenantConfig.mockRestore();
        }
      }
    },
    90000
  );

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
    if (typeof fresh.auth_time !== 'number')
      throw new Error('MFA token has no authentication time');
    expect(fresh.auth_time).toBeGreaterThanOrEqual(stepUpStarted - 1);
    expect(Math.floor(Date.now() / 1000) - fresh.auth_time).toBeGreaterThanOrEqual(-60);
    expect(Math.floor(Date.now() / 1000) - fresh.auth_time).toBeLessThanOrEqual(300);

    await clientA.ensureLoginMfaPolicy({
      mode: 'required',
      clientIds: ['studio-client', 'ssf-frontend'],
    });
    // The ordinary user's existing password-only SSO cookie must not bypass enrollment.
    verifier = await authorize(ordinary, realm);
    if (await ordinary.page.locator('#password').isVisible()) await enterPassword(ordinary);
    const ordinarySecret = await enroll(ordinary);
    expect((await claims(ordinary, realm, verifier)).acr).toBe('mfa');
    expect(ordinarySecret.length).toBeGreaterThan(0);

    await api('POST', `${realm}/users`, {
      username: 'new-staff',
      enabled: true,
      firstName: 'Synthetic',
      lastName: 'New tester',
      email: 'new-staff@example.org',
      emailVerified: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
    });
    const newStaff = await session('new-staff');
    verifier = await authorize(newStaff, realm, { client_id: 'studio-client' });
    await enterPassword(newStaff);
    await enroll(newStaff);
    expect((await claims(newStaff, realm, verifier, 'studio-client')).acr).toBe('mfa');

    // Simulate the existing administrator recovery operation after identity verification.
    const staff = (await api<User[]>('GET', `${realm}/users?username=new-staff`))[0];
    if (!staff) throw new Error('Disposable staff user not found');
    const staffCredentials = await api<{ id: string; type: string }[]>(
      'GET',
      `${realm}/users/${staff.id}/credentials`
    );
    const lostFactor = staffCredentials.find((credential) => credential.type === 'otp');
    if (!lostFactor) throw new Error('Disposable recovery factor not found');
    await api('DELETE', `${realm}/users/${staff.id}/credentials/${lostFactor.id}`);
    await api('PUT', `${realm}/users/${staff.id}`, { requiredActions: ['CONFIGURE_TOTP'] });
    const recoveredStaff = await session('new-staff');
    verifier = await authorize(recoveredStaff, realm, { client_id: 'studio-client' });
    await enterPassword(recoveredStaff);
    await enroll(recoveredStaff);
    expect((await claims(recoveredStaff, realm, verifier, 'studio-client')).acr).toBe('mfa');

    const other = await session('ordinary');
    verifier = await authorize(other, realmB);
    await enterPassword(other);
    expect((await claims(other, realmB, verifier)).acr).not.toBe('mfa');

    await clientA.ensureLoginMfaPolicy({
      mode: 'optional',
      clientIds: ['studio-client', 'ssf-frontend'],
    });
    const users = await api<User[]>('GET', `${realm}/users?username=ordinary`);
    const ordinaryUser = users[0];
    if (!ordinaryUser) throw new Error('Disposable ordinary user not found');
    const credentials = await api<{ type: string }[]>(
      'GET',
      `${realm}/users/${ordinaryUser.id}/credentials`
    );
    expect(credentials.some((credential) => credential.type === 'otp')).toBe(true);
    verifier = await authorize(ordinary, realm);
    if (await ordinary.page.locator('#password').isVisible()) await enterPassword(ordinary);
    await enterOtp(ordinary, ordinarySecret);
    await claims(ordinary, realm, verifier);
    const before = await api<{ id: string; alias: string }[]>(
      'GET',
      `${realm}/authentication/flows`
    );
    await clientA.ensureLoginMfaPolicy({
      mode: 'optional',
      clientIds: ['studio-client', 'ssf-frontend'],
    });
    expect(await api('GET', `${realm}/authentication/flows`)).toEqual(before);
    expect(
      (
        await clientA.readLoginMfaPolicy({
          mode: 'optional',
          clientIds: ['studio-client', 'ssf-frontend'],
        })
      ).aligned
    ).toBe(true);
  }, 180_000);

  it('preserves an unmanaged realm browser binding and reports the conflict', async () => {
    const realm = realmB;
    const alias = `${tag}-custom-browser`;
    await api('POST', `${realm}/authentication/flows`, {
      alias,
      providerId: 'basic-flow',
      topLevel: true,
      builtIn: false,
    });
    await api('PUT', realm, { realm, browserFlow: alias });
    await expect(
      clientB.ensureLoginMfaPolicy({
        mode: 'required',
        clientIds: ['studio-client', 'ssf-frontend'],
      })
    ).rejects.toThrow('login_mfa_binding_conflict');
    expect((await api<{ browserFlow: string }>('GET', realm)).browserFlow).toBe(alias);
  });
});
