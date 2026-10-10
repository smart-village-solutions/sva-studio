import type { Server } from 'node:http';
import { persistPersonalSession, type PersonalSessionStore } from './personal-session-store.js';
import {
  summarizePersonalContext,
  type PersonalMcpContext,
  type PersonalContextSummary,
} from './config.js';
import { PersonalMcpAuthError } from './personal-auth-errors.js';
import {
  startPersonalCallbackServer,
  handlePersonalCallback,
  type PendingPersonalLogin,
  type PersonalSession,
} from './personal-auth-callback.js';
import {
  CALLBACK_PORT,
  discoverConfiguration,
  refreshPersonalSession,
  restorePersonalSession,
  createPersonalLogin,
  revokePersonalSession,
  revokePersonalSessions,
} from './personal-auth-oidc.js';
export { PersonalMcpAuthError } from './personal-auth-errors.js';
export type { PersonalContextSummary } from './config.js';
const TOKEN_REFRESH_MARGIN_MS = 30_000;

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
    return [...this.contextsById.values()].map((context) =>
      summarizePersonalContext(
        context,
        this.sessions.get(context.id)?.account,
        this.pendingStateByContext.has(context.id)
      )
    );
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
    await this.options.sessionStore?.delete(context);
    const configuration = await this.discover(context);
    await this.ensureCallbackServer();

    const { pending, loginUrl } = await createPersonalLogin(
      context,
      configuration,
      this.options.callbackPort ?? CALLBACK_PORT,
      this.options.loginTimeoutMs,
      (state) => this.removePending(state)
    );
    this.pendingByState.set(pending.state, pending);
    this.pendingStateByContext.set(contextId, pending.state);
    return loginUrl;
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
    await revokePersonalSession(
      context,
      refreshToken,
      this.options.fetchImpl ?? fetch,
      this.options.tokenTimeoutMs ?? 10_000
    );
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
    await revokePersonalSessions(
      activeSessions,
      this.contextsById,
      this.options.fetchImpl ?? fetch,
      this.options.tokenTimeoutMs ?? 10_000
    );
  }

  async getAccessToken(contextId: string): Promise<string> {
    return this.exclusive(contextId, async () => {
      if (this.pendingStateByContext.has(contextId))
        throw new PersonalMcpAuthError('context_login_pending');
      if (!this.sessions.has(contextId) && this.options.sessionStore) {
        const restored = await restorePersonalSession(
          this.getContext(contextId),
          this.options.sessionStore,
          this.options.fetchImpl ?? fetch,
          this.options.tokenTimeoutMs ?? 10_000
        );
        if (restored) this.sessions.set(contextId, restored);
      }
      const session = this.sessions.get(contextId);
      if (!session) throw new PersonalMcpAuthError('context_login_required');
      if (session.accessTokenExpiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS)
        return session.accessToken;
      if (!session.refreshToken) {
        this.sessions.delete(contextId);
        throw new PersonalMcpAuthError('context_login_required');
      }
      return this.refreshSession(contextId, session);
    });
  }

  getContext(contextId: string): PersonalMcpContext {
    const context = this.contextsById.get(contextId);
    if (!context) throw new PersonalMcpAuthError('context_not_configured');
    return context;
  }

  private async ensureCallbackServer(): Promise<void> {
    if (this.callbackServer?.listening) return;
    if (this.callbackServer)
      await new Promise<void>((resolve) => this.callbackServer?.close(() => resolve()));
    this.callbackServer = await startPersonalCallbackServer(
      this.options.callbackPort ?? CALLBACK_PORT,
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
  }

  private async refreshSession(contextId: string, session: PersonalSession): Promise<string> {
    const context = this.getContext(contextId);
    try {
      const updated = await refreshPersonalSession(context, session, await this.discover(context));
      if (this.sessions.get(contextId) !== session)
        throw new PersonalMcpAuthError('oidc_token_refresh_failed');
      await persistPersonalSession(context, updated, this.options.sessionStore);
      Object.assign(session, updated);
      return session.accessToken;
    } catch {
      if (this.sessions.get(contextId) === session) this.sessions.delete(contextId);
      await this.options.sessionStore?.delete(context);
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
      await persistPersonalSession(context, session, this.options.sessionStore);
      if (this.disposed || this.pendingStateByContext.get(context.id) !== state) {
        await this.options.sessionStore?.delete(context);
        throw new PersonalMcpAuthError('oidc_login_failed');
      }
      this.sessions.set(context.id, session);
    });
  }

  private async discover(context: PersonalMcpContext) {
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
