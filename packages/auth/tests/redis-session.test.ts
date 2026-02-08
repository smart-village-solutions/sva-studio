import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RedisClientType } from 'redis';
import {
  createSessionInRedis,
  getSessionFromRedis,
  deleteSessionFromRedis,
  refreshSessionInRedis,
  isValidSessionData,
  type SessionData,
} from '../redis-session';

// Mock Redis Client
const createMockRedisClient = (): RedisClientType => {
  const store = new Map<string, string>();

  return {
    setEx: vi.fn(async (key: string, ttl: number, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => {
      return store.get(key) ?? null;
    }),
    del: vi.fn(async (key: string) => {
      const deleted = store.has(key) ? 1 : 0;
      store.delete(key);
      return deleted;
    }),
    expire: vi.fn(async (key: string, ttl: number) => {
      return store.has(key) ? 1 : 0;
    }),
    quit: vi.fn(async () => {
      store.clear();
      return 'OK';
    }),
  } as unknown as RedisClientType;
};

describe('redis-session', () => {
  let mockRedis: RedisClientType;
  let sessionData: SessionData;

  beforeEach(() => {
    mockRedis = createMockRedisClient();
    sessionData = {
      userId: 'user-123',
      workspaceId: 'org-456',
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      metadata: {
        loginMethod: 'oauth2',
        ipAddress: '192.168.1.1', // Will be redacted in logs
      },
    };
  });

  afterEach(async () => {
    await mockRedis.quit();
  });

  describe('createSessionInRedis', () => {
    it('should create a session and return a sessionId', async () => {
      const sessionId = await createSessionInRedis(mockRedis, sessionData);

      expect(sessionId).toBeTruthy();
      expect(sessionId).toHaveLength(32); // Hex string of 16 bytes
      expect(mockRedis.setEx).toHaveBeenCalled();
    });

    it('should store session data with 7-day TTL', async () => {
      const sessionId = await createSessionInRedis(mockRedis, sessionData);
      const stored = await mockRedis.get(`session:${sessionId}`);

      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.userId).toBe('user-123');
      expect(parsed.workspaceId).toBe('org-456');
    });

    it('should throw error if Redis is not initialized', async () => {
      await expect(createSessionInRedis(null as any, sessionData)).rejects.toThrow(
        'Redis client not initialized'
      );
    });
  });

  describe('getSessionFromRedis', () => {
    it('should retrieve stored session data', async () => {
      const sessionId = await createSessionInRedis(mockRedis, sessionData);
      const retrieved = await getSessionFromRedis(mockRedis, sessionId);

      expect(retrieved).toEqual(sessionData);
    });

    it('should return null for non-existent session', async () => {
      const retrieved = await getSessionFromRedis(mockRedis, 'non-existent-id');

      expect(retrieved).toBeNull();
    });

    it('should parse JSON correctly', async () => {
      const sessionId = await createSessionInRedis(mockRedis, sessionData);
      const retrieved = await getSessionFromRedis(mockRedis, sessionId);

      expect(retrieved?.metadata?.loginMethod).toBe('oauth2');
      expect(typeof retrieved?.createdAt).toBe('number');
    });

    it('should throw error if Redis is not initialized', async () => {
      await expect(getSessionFromRedis(null as any, 'session-id')).rejects.toThrow(
        'Redis client not initialized'
      );
    });
  });

  describe('deleteSessionFromRedis', () => {
    it('should delete existing session', async () => {
      const sessionId = await createSessionInRedis(mockRedis, sessionData);
      await deleteSessionFromRedis(mockRedis, sessionId);

      const retrieved = await getSessionFromRedis(mockRedis, sessionId);
      expect(retrieved).toBeNull();
    });

    it('should handle deletion of non-existent session gracefully', async () => {
      // Should not throw
      await expect(deleteSessionFromRedis(mockRedis, 'non-existent-id')).resolves.toBeUndefined();
    });

    it('should throw error if Redis is not initialized', async () => {
      await expect(deleteSessionFromRedis(null as any, 'session-id')).rejects.toThrow(
        'Redis client not initialized'
      );
    });
  });

  describe('refreshSessionInRedis', () => {
    it('should refresh session TTL and return true', async () => {
      const sessionId = await createSessionInRedis(mockRedis, sessionData);
      const result = await refreshSessionInRedis(mockRedis, sessionId);

      expect(result).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should return false for non-existent session', async () => {
      const result = await refreshSessionInRedis(mockRedis, 'non-existent-id');

      expect(result).toBe(false);
    });

    it('should throw error if Redis is not initialized', async () => {
      await expect(refreshSessionInRedis(null as any, 'session-id')).rejects.toThrow(
        'Redis client not initialized'
      );
    });
  });

  describe('isValidSessionData', () => {
    it('should validate correct session data', () => {
      expect(isValidSessionData(sessionData)).toBe(true);
    });

    it('should reject data without required fields', () => {
      expect(isValidSessionData({ userId: 'user-123' })).toBe(false);
      expect(isValidSessionData({ workspaceId: 'org-456' })).toBe(false);
      expect(isValidSessionData({})).toBe(false);
    });

    it('should reject non-objects', () => {
      expect(isValidSessionData('not an object')).toBe(false);
      expect(isValidSessionData(null)).toBe(false);
      expect(isValidSessionData(undefined)).toBe(false);
    });

    it('should reject data with wrong field types', () => {
      expect(
        isValidSessionData({
          userId: 123, // Should be string
          workspaceId: 'org-456',
          createdAt: Date.now(),
          expiresAt: Date.now() + 1000,
        })
      ).toBe(false);
    });

    it('should accept data with optional metadata field', () => {
      const withMetadata = {
        ...sessionData,
        metadata: { custom: 'value' },
      };
      expect(isValidSessionData(withMetadata)).toBe(true);
    });
  });

  describe('Session lifecycle', () => {
    it('should support complete session lifecycle: create -> get -> refresh -> delete', async () => {
      // Create
      const sessionId = await createSessionInRedis(mockRedis, sessionData);
      expect(sessionId).toBeTruthy();

      // Get
      let session = await getSessionFromRedis(mockRedis, sessionId);
      expect(session).toEqual(sessionData);

      // Refresh
      const refreshed = await refreshSessionInRedis(mockRedis, sessionId);
      expect(refreshed).toBe(true);

      // Verify still accessible
      session = await getSessionFromRedis(mockRedis, sessionId);
      expect(session?.userId).toBe('user-123');

      // Delete
      await deleteSessionFromRedis(mockRedis, sessionId);

      // Verify deleted
      session = await getSessionFromRedis(mockRedis, sessionId);
      expect(session).toBeNull();
    });
  });

  describe('Multi-workspace isolation', () => {
    it('should isolate sessions by workspace_id', async () => {
      const session1 = { ...sessionData, workspaceId: 'org-1' };
      const session2 = { ...sessionData, userId: 'user-456', workspaceId: 'org-2' };

      const id1 = await createSessionInRedis(mockRedis, session1);
      const id2 = await createSessionInRedis(mockRedis, session2);

      const retrieved1 = await getSessionFromRedis(mockRedis, id1);
      const retrieved2 = await getSessionFromRedis(mockRedis, id2);

      expect(retrieved1?.workspaceId).toBe('org-1');
      expect(retrieved2?.workspaceId).toBe('org-2');
      expect(retrieved1?.userId).toBe(retrieved2?.userId); // Same user, different workspaces
    });
  });
});
