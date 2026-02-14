import { describe, it, expect, beforeEach } from 'vitest';
import type { Session } from './types';
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  clearExpiredSessions,
  createLoginState,
  consumeLoginState,
  clearExpiredLoginStates,
} from './session';

describe('Session Management', () => {
  beforeEach(() => {
    // Clear all sessions before each test
    // Since we can't clear directly, we rely on isolation
  });

  describe('createSession & getSession', () => {
    it('should create and retrieve a session', () => {
      const mockSession: Session = {
        id: 'test-session-1',
        userId: 'user-123',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      createSession(mockSession);
      const retrieved = getSession('test-session-1');

      expect(retrieved).toEqual(mockSession);
    });

    it('should return null for non-existent session', () => {
      const retrieved = getSession('non-existent-session');
      expect(retrieved).toBeNull();
    });

    it('should create multiple sessions', () => {
      const session1: Session = {
        id: 'session-1',
        userId: 'user-1',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const session2: Session = {
        id: 'session-2',
        userId: 'user-2',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      createSession(session1);
      createSession(session2);

      expect(getSession('session-1')).toEqual(session1);
      expect(getSession('session-2')).toEqual(session2);
    });
  });

  describe('updateSession', () => {
    it('should update an existing session', () => {
      const originalSession: Session = {
        id: 'session-update-test',
        userId: 'user-123',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      createSession(originalSession);

      const updated = updateSession('session-update-test', {
        userId: 'user-456',
      });

      expect(updated?.userId).toBe('user-456');
      expect(updated?.id).toBe('session-update-test');
    });

    it('should return null when updating non-existent session', () => {
      const result = updateSession('non-existent', { userId: 'new-user' });
      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', () => {
      const session: Session = {
        id: 'session-to-delete',
        userId: 'user-123',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      createSession(session);
      expect(getSession('session-to-delete')).toBeDefined();

      deleteSession('session-to-delete');
      expect(getSession('session-to-delete')).toBeNull();
    });

    it('should handle deleting non-existent session gracefully', () => {
      expect(() => deleteSession('non-existent')).not.toThrow();
    });
  });

  describe('clearExpiredSessions', () => {
    it('should remove expired sessions', () => {
      const now = Date.now();
      const ttl = 3600000; // 1 hour

      const expiredSession: Session = {
        id: 'expired-session',
        userId: 'user-123',
        createdAt: now - ttl - 1000, // 1 second past TTL
        expiresAt: now - 1000,
      };

      const activeSession: Session = {
        id: 'active-session',
        userId: 'user-456',
        createdAt: now - 1000, // 1 second old
        expiresAt: now + ttl,
      };

      createSession(expiredSession);
      createSession(activeSession);

      clearExpiredSessions(now, ttl);

      expect(getSession('expired-session')).toBeNull();
      expect(getSession('active-session')).toBeDefined();
    });
  });

  describe('Login State Management', () => {
    it('should create and consume login state', () => {
      const loginState = {
        codeVerifier: 'verifier-123',
        state: 'state-123',
        nonce: 'nonce-123',
        createdAt: Date.now(),
      };

      createLoginState('state-123', loginState);
      const retrieved = consumeLoginState('state-123');

      expect(retrieved).toEqual(loginState);
    });

    it('should consume login state only once', () => {
      const loginState = {
        codeVerifier: 'verifier-123',
        state: 'state-456',
        nonce: 'nonce-456',
        createdAt: Date.now(),
      };

      createLoginState('state-456', loginState);
      consumeLoginState('state-456');
      const secondAttempt = consumeLoginState('state-456');

      expect(secondAttempt).toBeNull();
    });

    it('should return null for non-existent login state', () => {
      const result = consumeLoginState('non-existent-state');
      expect(result).toBeNull();
    });
  });

  describe('clearExpiredLoginStates', () => {
    it('should remove expired login states', () => {
      const now = Date.now();
      const ttl = 600000; // 10 minutes

      const expiredState = {
        codeVerifier: 'verifier-expired',
        state: 'state-expired',
        nonce: 'nonce-expired',
        createdAt: now - ttl - 1000, // 1 second past TTL
      };

      const activeState = {
        codeVerifier: 'verifier-active',
        state: 'state-active',
        nonce: 'nonce-active',
        createdAt: now - 1000, // 1 second old
      };

      createLoginState('state-expired', expiredState);
      createLoginState('state-active', activeState);

      clearExpiredLoginStates(now, ttl);

      expect(consumeLoginState('state-expired')).toBeNull();
      expect(consumeLoginState('state-active')).toEqual(activeState);
    });
  });
});
