import { createServer, type Server } from 'node:http';
import * as oidc from 'openid-client';
import { personalSessionBinding, type PersonalSessionStore } from './personal-session-store.js';
import type { PersonalMcpContext } from './config.js';
import { PersonalMcpAuthError } from './personal-auth-errors.js';
import {
  handlePersonalCallback,
  type PendingPersonalLogin,
  type PersonalSession,
} from './personal-auth-callback.js';
import {
  assertIssuerEndpoints,
  CALLBACK_HOST,
  CALLBACK_PORT,
  callbackUri,
  discoverConfiguration,
  LOGIN_TIMEOUT_MS,
  realmFor,
  TOKEN_REFRESH_MARGIN_MS,
} from './personal-auth-oidc.js';
export { PersonalMcpAuthError } from './personal-auth-errors.js';

export type PersonalContextSummary = {
  readonly id: string;
  readonly name: string;
  readonly kind: 'platform' | 'tenant';
  readonly host: string;
  readonly realm: string;
  readonly tenantId?: string;
  readonly account?: string;
  readonly loginPending: boolean;
};

export class PersonalMcpContextManager {
  private readonly contextsById: ReadonlyMap<string, PersonalMcpContext>;
  private readonly sessions = new Map<string, PersonalSession>();
  private readonly pendingByState = new Map<string, PendingPersonalLogin>();
  private readonly pendingStateByContext = new Map<string, string>();
  private callbackServer?: Server;
  private disposed = false;
  private readonly operations = new Map<string, Promise<unknown>>();

  constructor(
    contexts: readonly PersonalMcpContext[],
    private readonly options: {
      readonly callbackPort?: number;
      readonly tokenTimeoutMs?: number;
      readonly loginTimeoutMs?: number;
      readonly fetchImpl?: typeof fetch;
      readonly sessionStore?: PersonalSessionStore;
    } = {}
  ) {
    this.contextsById = new Map(contexts.map((context) => [context.id, context]));
  }

  list(): readonly PersonalContextSummary[] {
    return [...this.contextsById.values()].map((context) => {
      const session = this.sessions.get(context.id);
      return {
        id: context.id,
        name: context.name,
        kind: context.kind,
        host: new URL(context.baseUrl).host,
        realm: realmFor(context.issuer),
        ...(context.kind === 'tenant' ? { tenantId: context.tenantId } : {}),
        ...(session ? { account: session.account } : {}),
        loginPending: this.pendingStateByContext.has(context.id),
      };
    });
  }

  async startLogin(contextId: string): Promise<string> {
    return this.exclusive(contextId, () => this.startLoginUnlocked(contextId));
  }

  private async startLoginUnlocked(contextId: string): Promise<string> {
    const context = this.getContext(contextId);
    if (this.sessions.has(contextId))
      throw new PersonalMcpAuthError('context_already_authenticated');
    if (this.pendingStateByContext.has(contextId))
      throw new PersonalMcpAuthError('context_login_pending');
    const configuration = await this.discover(context);
    assertIssuerEndpoints(context, configuration);
    await this.ensureCallbackServer();

    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const callbackUri = this.callbackUri();
    const loginUrl = oidc.buildAuthorizationUrl(configuration, {
      client_id: context.clientId,
      redirect_uri: callbackUri,
      response_type: 'code',
      response_mode: 'query',
      scope: 'openid profile',
      prompt: 'login',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    const timeoutMs = this.options.loginTimeoutMs ?? LOGIN_TIMEOUT_MS;
    const timeout = setTimeout(() => this.removePending(state), timeoutMs);
    timeout.unref();
    this.pendingByState.set(state, {
      context,
      configuration,
      state,
      nonce,
      codeVerifier,
      expiresAt: Date.now() + timeoutMs,
      timeout,
    });
    this.pendingStateByContext.set(contextId, state);
    return loginUrl.href;
  }

  async logout(contextId: string): Promise<void> {
    return this.exclusive(contextId, () => this.logoutUnlocked(contextId));
  }

  private async logoutUnlocked(contextId: string): Promise<void> {
    const context = this.getContext(contextId);
    const pendingState = this.pendingStateByContext.get(contextId);
    if (pendingState) this.removePending(pendingState);
    this.pendingStateByContext.delete(contextId);
    const session = this.sessions.get(contextId);
    this.sessions.delete(contextId);
    const stored = this.options.sessionStore
      ? await this.options.sessionStore.load(context)
      : undefined;
    await this.options.sessionStore?.delete(context);
    const refreshToken = session?.refreshToken ?? stored?.refreshToken;
    if (!refreshToken) return;
    try {
      const configuration = await this.discover(context);
      assertIssuerEndpoints(context, configuration);
      if (!configuration.serverMetadata().revocation_endpoint) {
        throw new PersonalMcpAuthError('oidc_logout_revocation_failed');
      }
      await oidc.tokenRevocation(configuration, refreshToken, { token_type_hint: 'refresh_token' });
    } catch {
      throw new PersonalMcpAuthError('oidc_logout_revocation_failed');
    }
  }

  cancelLogin(contextId: string): void {
    this.getContext(contextId);
    const state = this.pendingStateByContext.get(contextId);
    if (state) this.removePending(state);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    for (const state of this.pendingByState.keys()) this.removePending(state);
    this.pendingStateByContext.clear();
    await Promise.allSettled([...this.operations.values()]);
    const activeSessions = [...this.sessions.entries()];
    this.sessions.clear();
    const server = this.callbackServer;
    this.callbackServer = undefined;
    if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (this.options.sessionStore) return;
    await Promise.all(
      activeSessions.map(async ([contextId, session]) => {
        if (!session.refreshToken) return;
        try {
          const context = this.getContext(contextId);
          const configuration = await this.discover(context);
          assertIssuerEndpoints(context, configuration);
          if (configuration.serverMetadata().revocation_endpoint) {
            await oidc.tokenRevocation(configuration, session.refreshToken, {
              token_type_hint: 'refresh_token',
            });
          }
        } catch {
          // Shutdown remains local and best-effort; no credential detail is emitted.
        }
      })
    );
  }

  async getAccessToken(contextId: string): Promise<string> {
    return this.exclusive(contextId, async () => {
      if (this.pendingStateByContext.has(contextId))
        throw new PersonalMcpAuthError('context_login_pending');
      if (!this.sessions.has(contextId) && this.options.sessionStore)
        await this.restoreSession(contextId);
      return this.getAccessTokenUnlocked(contextId);
    });
  }

  private async getAccessTokenUnlocked(contextId: string): Promise<string> {
    const session = this.sessions.get(contextId);
    if (!session) throw new PersonalMcpAuthError('context_login_required');
    if (session.accessTokenExpiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS)
      return session.accessToken;
    if (!session.refreshToken) {
      this.sessions.delete(contextId);
      throw new PersonalMcpAuthError('context_login_required');
    }
    return this.refreshSession(contextId, session);
  }

  getContext(contextId: string): PersonalMcpContext {
    const context = this.contextsById.get(contextId);
    if (!context) throw new PersonalMcpAuthError('context_not_configured');
    return context;
  }

  private callbackUri(): string {
    const port = this.options.callbackPort ?? CALLBACK_PORT;
    return callbackUri(port);
  }

  private async ensureCallbackServer(): Promise<void> {
    if (this.callbackServer?.listening) return;
    if (this.callbackServer)
      await new Promise<void>((resolve) => this.callbackServer?.close(() => resolve()));
    const server = createServer(
      (request, response) =>
        void handlePersonalCallback(
          request,
          response,
          this.options.callbackPort ?? CALLBACK_PORT,
          this.pendingByState,
          this.pendingStateByContext,
          (context, session, state) => this.installSession(context, session, state),
          (state, preserveContext) => this.removePending(state, preserveContext)
        )
    );
    this.callbackServer = server;
    await new Promise<void>((resolve, reject) => {
      server.once('error', () => {
        if (this.callbackServer === server) this.callbackServer = undefined;
        reject(new PersonalMcpAuthError('login_callback_unavailable'));
      });
      server.listen(this.options.callbackPort ?? CALLBACK_PORT, CALLBACK_HOST, () => resolve());
    });
  }

  private async refreshSession(contextId: string, session: PersonalSession): Promise<string> {
    try {
      const context = this.getContext(contextId);
      const configuration = await this.discover(context);
      assertIssuerEndpoints(context, configuration);
      const response = await oidc.refreshTokenGrant(configuration, session.refreshToken as string);
      if (this.sessions.get(contextId) !== session || typeof response.access_token !== 'string') {
        throw new PersonalMcpAuthError('oidc_token_refresh_failed');
      }
      const identity = await oidc.fetchUserInfo(
        configuration,
        response.access_token,
        session.subject
      );
      if (
        identity.sub !== session.subject ||
        (response.claims()?.sub && response.claims()?.sub !== session.subject)
      ) {
        throw new PersonalMcpAuthError('oidc_token_refresh_failed');
      }
      session.accessToken = response.access_token;
      session.accessTokenExpiresAt = Date.now() + (response.expiresIn() ?? 60) * 1000;
      if (response.refresh_token) session.refreshToken = response.refresh_token;
      await this.persistSession(context, session);
      return session.accessToken;
    } catch {
      if (this.sessions.get(contextId) === session) this.sessions.delete(contextId);
      await this.options.sessionStore?.delete(this.getContext(contextId));
      throw new PersonalMcpAuthError('oidc_token_refresh_failed');
    }
  }

  private exclusive<T>(contextId: string, operation: () => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(new PersonalMcpAuthError('context_login_required'));
    const previous = this.operations.get(contextId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => {
        if (this.disposed) throw new PersonalMcpAuthError('context_login_required');
        return operation();
      });
    this.operations.set(contextId, next);
    void next
      .finally(() => {
        if (this.operations.get(contextId) === next) this.operations.delete(contextId);
      })
      .catch(() => undefined);
    return next;
  }

  private async installSession(
    context: PersonalMcpContext,
    session: PersonalSession,
    state: string
  ): Promise<void> {
    await this.exclusive(context.id, async () => {
      if (this.pendingStateByContext.get(context.id) !== state)
        throw new PersonalMcpAuthError('oidc_login_failed');
      await this.persistSession(context, session);
      if (this.disposed || this.pendingStateByContext.get(context.id) !== state) {
        await this.options.sessionStore?.delete(context);
        throw new PersonalMcpAuthError('oidc_login_failed');
      }
      this.sessions.set(context.id, session);
    });
  }

  private async persistSession(
    context: PersonalMcpContext,
    session: PersonalSession
  ): Promise<void> {
    if (!this.options.sessionStore) return;
    if (!session.refreshToken) {
      await this.options.sessionStore.delete(context);
      return;
    }
    await this.options.sessionStore.save(context, {
      version: 1,
      binding: personalSessionBinding(context),
      subject: session.subject,
      account: session.account,
      refreshToken: session.refreshToken,
    });
  }

  private async restoreSession(contextId: string): Promise<void> {
    const context = this.getContext(contextId);
    const stored = await this.options.sessionStore?.load(context);
    if (!stored) return;
    try {
      if (stored.binding !== personalSessionBinding(context))
        throw new PersonalMcpAuthError('context_login_required');
      const configuration = await this.discover(context);
      assertIssuerEndpoints(context, configuration);
      const response = await oidc.refreshTokenGrant(configuration, stored.refreshToken);
      if (typeof response.access_token !== 'string')
        throw new PersonalMcpAuthError('context_login_required');
      const identity = await oidc.fetchUserInfo(
        configuration,
        response.access_token,
        stored.subject
      );
      if (
        identity.sub !== stored.subject ||
        (response.claims()?.sub && response.claims()?.sub !== stored.subject)
      ) {
        throw new PersonalMcpAuthError('context_login_required');
      }
      const session: PersonalSession = {
        contextId,
        subject: stored.subject,
        account:
          typeof identity.preferred_username === 'string'
            ? identity.preferred_username
            : stored.account,
        accessToken: response.access_token,
        accessTokenExpiresAt: Date.now() + (response.expiresIn() ?? 60) * 1000,
        refreshToken: response.refresh_token ?? stored.refreshToken,
      };
      await this.persistSession(context, session);
      this.sessions.set(contextId, session);
    } catch {
      await this.options.sessionStore?.delete(context);
      throw new PersonalMcpAuthError('context_login_required');
    }
  }

  private async discover(context: PersonalMcpContext): Promise<oidc.Configuration> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const timeoutMs = this.options.tokenTimeoutMs ?? 10_000;
    return discoverConfiguration(context, fetchImpl, timeoutMs);
  }

  private removePending(state: string, preserveContext = false): void {
    const pending = this.pendingByState.get(state);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pendingByState.delete(state);
    if (!preserveContext && this.pendingStateByContext.get(pending.context.id) === state) {
      this.pendingStateByContext.delete(pending.context.id);
    }
    if (this.pendingByState.size === 0 && this.callbackServer?.listening) {
      const server = this.callbackServer;
      this.callbackServer = undefined;
      server.close();
    }
  }
}
