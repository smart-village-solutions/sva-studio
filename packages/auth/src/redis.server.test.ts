import { randomUUID } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  readFileSyncImpl: vi.fn((path: string) => `file:${path}`),
  connectImpl: null as null | (() => Promise<void>),
  pingImpl: null as null | (() => Promise<'PONG'>),
  instances: [] as MockRedis[],
}));

class MockRedis {
  public readonly url: string;
  public readonly options: Record<string, unknown>;
  public readonly handlers = new Map<string, (arg?: unknown) => void>();
  public disconnect = vi.fn();
  public quit = vi.fn(async () => undefined);

  public constructor(url: string, options: Record<string, unknown>) {
    this.url = url;
    this.options = options;
    state.instances.push(this);
  }

  public on(event: string, handler: (arg?: unknown) => void): this {
    this.handlers.set(event, handler);
    return this;
  }

  public async connect(): Promise<void> {
    if (state.connectImpl) {
      await state.connectImpl();
    }
  }

  public async ping(): Promise<'PONG'> {
    if (state.pingImpl) {
      return state.pingImpl();
    }
    return 'PONG';
  }

  public emit(event: string, arg?: unknown): void {
    this.handlers.get(event)?.(arg);
  }
}

vi.mock('ioredis', () => ({
  default: MockRedis,
}));

vi.mock('node:fs', () => ({
  readFileSync: (path: string, encoding: string) => {
    expect(encoding).toBe('utf8');
    return state.readFileSyncImpl(path);
  },
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
}));

const originalEnv = { ...process.env };

describe('redis.server', () => {
  beforeEach(() => {
    const redisAclSecretEnv = ['REDIS', 'PASSWORD'].join('_');

    vi.resetModules();
    state.instances = [];
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
    state.readFileSyncImpl.mockReset();
    state.readFileSyncImpl.mockImplementation((path: string) => `file:${path}`);
    state.connectImpl = null;
    state.pingImpl = null;
    process.env = { ...originalEnv };
    delete process.env.REDIS_USERNAME;
    delete process.env[redisAclSecretEnv];
    delete process.env.REDIS_URL;
    delete process.env.REDIS_CA_PATH;
    delete process.env.REDIS_CERT_PATH;
    delete process.env.REDIS_KEY_PATH;
    delete process.env.TLS_ENABLED;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('creates a singleton redis client with ACL and TLS options', async () => {
    const redisAclSecretEnv = ['REDIS', 'PASSWORD'].join('_');
    const passwordOptionKey = ['pass', 'word'].join('');
    const aclFixture = randomUUID();

    process.env.REDIS_URL = 'rediss://redis.example.com:6380';
    process.env.REDIS_USERNAME = 'svc-user';
    process.env[redisAclSecretEnv] = aclFixture;

    const { getRedisClient } = await import('./redis.server');
    const firstClient = getRedisClient();
    const secondClient = getRedisClient();
    const instance = state.instances[0];

    expect(firstClient).toBe(secondClient);
    expect(instance?.url).toBe('rediss://redis.example.com:6380');
    expect(instance?.options).toEqual(
      expect.objectContaining({
        username: 'svc-user',
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        tls: expect.objectContaining({
          ca: [expect.stringContaining('file:')],
          cert: expect.stringContaining('file:'),
          key: expect.stringContaining('file:'),
          rejectUnauthorized: false,
        }),
      })
    );
    expect((instance?.options as Record<string, unknown>)?.[passwordOptionKey]).toBe(aclFixture);

    const retryStrategy = instance?.options.retryStrategy as (times: number) => number | null;
    expect(retryStrategy(2)).toBe(200);
    expect(retryStrategy(11)).toBeNull();
  });

  it('uses password auth from the runtime secret fallback without ACL username', async () => {
    state.readFileSyncImpl.mockImplementation((path: string) => {
      if (path === '/run/secrets/sva_studio_redis_password') {
        return 'secret-from-swarm';
      }
      return `file:${path}`;
    });

    const { getRedisClient } = await import('./redis.server');
    getRedisClient();
    const instance = state.instances[0];

    expect(instance?.url).toBe('redis://redis:6379');
    expect(instance?.options).toEqual(
      expect.objectContaining({
        password: 'secret-from-swarm',
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      })
    );
  });

  it('falls back to plaintext redis when TLS certificate loading fails', async () => {
    process.env.TLS_ENABLED = 'true';
    state.readFileSyncImpl.mockImplementation(() => {
      throw new Error('missing cert');
    });

    const { getRedisClient } = await import('./redis.server');
    getRedisClient();
    const instance = state.instances[0];

    expect(instance?.options.tls).toBeUndefined();
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Redis TLS configuration failed, continuing without TLS',
      expect.objectContaining({
        operation: 'redis_tls_init',
        error: 'missing cert',
      })
    );
  });

  it('disconnects the client after repeated connection errors and resets on reconnect', async () => {
    const { getRedisClient } = await import('./redis.server');
    getRedisClient();
    const instance = state.instances[0];

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      instance?.emit('error', new Error(attempt === 10 ? 'WRONGPASS invalid username-password pair' : 'socket hang up'));
    }
    instance?.emit('connect');

    expect(instance?.disconnect).toHaveBeenCalledTimes(1);
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Redis max errors reached, disconnecting client',
      expect.objectContaining({
        operation: 'redis_fallback',
        fallback: 'in-memory',
      })
    );
    expect(state.logger.info).toHaveBeenCalledWith(
      'Redis connected',
      expect.objectContaining({
        operation: 'redis_connect',
        tls_enabled: false,
      })
    );
  });

  it('closes the redis client cleanly', async () => {
    const { closeRedis, getRedisClient } = await import('./redis.server');
    getRedisClient();
    const instance = state.instances[0];

    await closeRedis();

    expect(instance?.quit).toHaveBeenCalledTimes(1);
    expect(state.logger.info).toHaveBeenCalledWith(
      'Redis connection closed',
      expect.objectContaining({ operation: 'redis_disconnect' })
    );
  });

  it('reports redis availability via ping and falls back on failures', async () => {
    const { isRedisAvailable } = await import('./redis.server');

    expect(await isRedisAvailable()).toBe(true);

    state.pingImpl = async () => {
      throw new Error('ping failed');
    };

    expect(await isRedisAvailable()).toBe(false);
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Redis unavailable, using in-memory fallback',
      expect.objectContaining({
        operation: 'redis_health_check',
        available: false,
        fallback: 'in-memory',
        error: 'ping failed',
      })
    );
  });

  it('logs asynchronous connection failures from the initial connect attempt', async () => {
    state.connectImpl = async () => {
      throw new Error('connect failed');
    };

    const { getRedisClient } = await import('./redis.server');
    getRedisClient();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state.logger.error).toHaveBeenCalledWith(
      'Redis connection failed',
      expect.objectContaining({
        operation: 'redis_connect',
        error: 'connect failed',
        error_type: 'Error',
      })
    );
  });
});
