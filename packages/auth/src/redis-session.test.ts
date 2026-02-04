import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  clearExpiredSessions,
  createLoginState,
  consumeLoginState,
  getAllSessionKeys,
  getSessionCount,
} from './redis-session.server';
import type { Session } from './types';
import { getRedisClient, closeRedis } from './redis.server';

describe('Redis Session Management', () => {
  beforeEach(async () => {
    // Clear all test sessions before each test
    const redis = getRedisClient();
    const keys = await redis.keys('session:*');
    const loginKeys = await redis.keys('login_state:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    if (loginKeys.length > 0) {
      await redis.del(...loginKeys);
    }
  });

  afterAll(async () => {
    // Clean up Redis connection after all tests
    await closeRedis();
  });

  describe('createSession & getSession', () => {
    it('should create and retrieve a session', async () => {
      const mockSession: Session = {
        userId: 'user-123',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      await createSession('test-session-1', mockSession);
      const retrieved = await getSession('test-session-1');

      expect(retrieved).toEqual(mockSession);
    });

    it('should return undefined for non-existent session', async () => {
      const retrieved = await getSession('non-existent-session');
      expect(retrieved).toBeUndefined();
    });

    it('should create multiple sessions', async () => {
      const session1: Session = {
        userId: 'user-1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      const session2: Session = {
        userId: 'user-2',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      await createSession('session-1', session1);
      await createSession('session-2', session2);

      const retrieved1 = await getSession('session-1');
      const retrieved2 = await getSession('session-2');

      expect(retrieved1).toEqual(session1);
      expect(retrieved2).toEqual(session2);
    });

    it('should not return expired sessions', async () => {
      const expiredSession: Session = {
        userId: 'user-456',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
      };

      await createSession('expired-session', expiredSession);
      const retrieved = await getSession('expired-session');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('updateSession', () => {
    it('should update an existing session', async () => {
      const originalSession: Session = {
        userId: 'user-789',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      await createSession('update-test', originalSession);

      const updates = {
        userId: 'user-789-updated',
      };

      await updateSession('update-test', updates);
      const updated = await getSession('update-test');

      expect(updated?.userId).toBe('user-789-updated');
      expect(updated?.createdAt).toBe(originalSession.createdAt);
    });

    it('should throw error when updating non-existent session', async () => {
      await expect(updateSession('non-existent', { userId: 'test' })).rejects.toThrow(
        'Session not found'
      );
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const mockSession: Session = {
        userId: 'user-delete',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      await createSession('delete-test', mockSession);
      await deleteSession('delete-test');

      const retrieved = await getSession('delete-test');
      expect(retrieved).toBeUndefined();
    });

    it('should not throw when deleting non-existent session', async () => {
      await expect(deleteSession('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('clearExpiredSessions', () => {
    it('should be a no-op (Redis TTL handles expiration)', async () => {
      // This is just for API compatibility
      await expect(clearExpiredSessions()).resolves.toBeUndefined();
    });
  });

  describe('Login State (PKCE)', () => {
    it('should create and consume login state', async () => {
      const loginData = {
        codeVerifier: 'test-verifier-123',
        nonce: 'test-nonce-123',
        createdAt: Date.now(),
        redirectTo: '/dashboard',
      };

      await createLoginState('test-state-1', loginData);
      const consumed = await consumeLoginState('test-state-1');

      expect(consumed).toEqual(loginData);
    });

    it('should return undefined for non-existent login state', async () => {
      const consumed = await consumeLoginState('non-existent-state');
      expect(consumed).toBeUndefined();
    });

    it('should only allow login state to be consumed once', async () => {
      const loginData = {
        codeVerifier: 'one-time-verifier',
        nonce: 'one-time-nonce',
        createdAt: Date.now(),
        redirectTo: '/home',
      };

      await createLoginState('one-time-state', loginData);
      const first = await consumeLoginState('one-time-state');
      const second = await consumeLoginState('one-time-state');

      expect(first).toEqual(loginData);
      expect(second).toBeUndefined();
    });

    it('should handle login state without redirectTo', async () => {
      const loginData = {
        codeVerifier: 'verifier-no-redirect',
        nonce: 'nonce-no-redirect',
        createdAt: Date.now(),
      };

      await createLoginState('state-no-redirect', loginData);
      const consumed = await consumeLoginState('state-no-redirect');

      expect(consumed).toEqual(loginData);
    });
  });

  describe('Utility Functions', () => {
    it('should get all session keys', async () => {
      await createSession('key-test-1', {
        userId: 'user-1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      await createSession('key-test-2', {
        userId: 'user-2',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      const keys = await getAllSessionKeys();
      expect(keys).toContain('key-test-1');
      expect(keys).toContain('key-test-2');
    });

    it('should count active sessions', async () => {
      const initialCount = await getSessionCount();

      await createSession('count-1', {
        userId: 'user-1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      await createSession('count-2', {
        userId: 'user-2',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      const finalCount = await getSessionCount();
      expect(finalCount).toBe(initialCount + 2);
    });
  });

  describe('TTL (Time-To-Live)', () => {
    it('should automatically expire sessions after TTL', async () => {
      const redis = getRedisClient();
      
      await createSession(
        'ttl-test',
        {
          userId: 'ttl-user',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        2 // 2 seconds TTL
      );

      // Immediately should exist
      const immediate = await getSession('ttl-test');
      expect(immediate).toBeDefined();

      // Wait 3 seconds
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Should be expired
      const expired = await getSession('ttl-test');
      expect(expired).toBeUndefined();
    }, 10000); // Increase test timeout to 10 seconds

    it('should preserve TTL on update', async () => {
      const redis = getRedisClient();

      await createSession(
        'ttl-update-test',
        {
          userId: 'original-user',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        10 // 10 seconds TTL
      );

      // Get initial TTL
      const initialTtl = await redis.ttl('session:ttl-update-test');
      expect(initialTtl).toBeGreaterThan(8);
      expect(initialTtl).toBeLessThanOrEqual(10);

      // Update session
      await updateSession('ttl-update-test', { userId: 'updated-user' });

      // TTL should be preserved (approximately)
      const updatedTtl = await redis.ttl('session:ttl-update-test');
      expect(updatedTtl).toBeGreaterThan(8);
      expect(updatedTtl).toBeLessThanOrEqual(10);
    });
  });
});
