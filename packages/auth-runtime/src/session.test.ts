import { describe, expect, it } from 'vitest';

import type { LoginState, Session } from './types.js';
import {
  clearExpiredLoginStates,
  clearExpiredSessions,
  consumeLoginState,
  createLoginState,
  createSession,
  deleteSession,
  getSession,
  updateSession,
} from './session.js';

const session = (id: string, createdAt: number): Session => ({
  id,
  userId: `user-${id}`,
  createdAt,
});

const loginState = (createdAt: number): LoginState => ({
  kind: 'platform',
  codeVerifier: 'verifier',
  nonce: 'nonce',
  createdAt,
});

describe('in-memory auth runtime session store', () => {
  it('creates, updates and deletes sessions', () => {
    createSession(session('session-a', 100));

    expect(getSession('session-a')).toMatchObject({ id: 'session-a', userId: 'user-session-a' });
    expect(updateSession('session-a', { accessToken: 'access-token', sessionVersion: 2 })).toMatchObject({
      id: 'session-a',
      accessToken: 'access-token',
      sessionVersion: 2,
    });
    expect(updateSession('missing', { accessToken: 'none' })).toBeNull();

    deleteSession('session-a');
    expect(getSession('session-a')).toBeNull();
  });

  it('consumes login states once and expires stale entries', () => {
    createLoginState('state-a', loginState(100));
    createLoginState('state-b', loginState(1_000));

    expect(consumeLoginState('state-a')).toMatchObject({ codeVerifier: 'verifier' });
    expect(consumeLoginState('state-a')).toBeNull();

    clearExpiredLoginStates(1_500, 400);
    expect(consumeLoginState('state-b')).toBeNull();
  });

  it('expires stale sessions by ttl', () => {
    createSession(session('old', 100));
    createSession(session('fresh', 1_000));

    clearExpiredSessions(1_500, 600);

    expect(getSession('old')).toBeNull();
    expect(getSession('fresh')).toMatchObject({ id: 'fresh' });
  });
});
