import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const observableGauge = {
    addCallback: vi.fn(),
  };

  class FakeRedis {
    static instances: FakeRedis[] = [];

    readonly handlers = new Map<string, (error?: unknown) => void>();
    pingImpl = vi.fn(async () => 'PONG');
    quitImpl = vi.fn(async () => 'OK');
    disconnect = vi.fn(() => {
      this.status = 'end';
    });
    connect = vi.fn(async () => undefined);
    status = 'ready';

    constructor(
      readonly url: string,
      readonly options: Record<string, unknown>
    ) {
      FakeRedis.instances.push(this);
    }

    on(event: string, listener: (error?: unknown) => void) {
      this.handlers.set(event, listener);
      return this;
    }

    ping() {
      return this.pingImpl();
    }

    quit() {
      return this.quitImpl();
    }
  }

  return {
    FakeRedis,
    gauge: observableGauge,
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
    getRedisPassword: vi.fn(),
    getRedisUrl: vi.fn(),
    readFileSync: vi.fn(),
  };
});

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createObservableGauge: () => state.gauge,
    }),
  },
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('./runtime-secrets.js', () => ({
  getRedisPassword: state.getRedisPassword,
  getRedisUrl: state.getRedisUrl,
}));

vi.mock('node:fs', () => ({
  readFileSync: state.readFileSync,
}));

vi.mock('ioredis', () => ({
  default: state.FakeRedis,
}));

describe('auth runtime redis client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.FakeRedis.instances.length = 0;
    state.getRedisUrl.mockReturnValue('redis://localhost:6379');
    state.getRedisPassword.mockReturnValue('redis-secret');
    state.readFileSync.mockImplementation((filePath: string) => `pem:${filePath}`);
    delete process.env.REDIS_USERNAME;
    delete process.env.TLS_ENABLED;
    delete process.env.REDIS_CA_PATH;
    delete process.env.REDIS_CERT_PATH;
    delete process.env.REDIS_KEY_PATH;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a singleton client with ACL credentials and retry behavior', async () => {
    process.env.REDIS_USERNAME = 'studio';
    const mod = await import('./redis.js');

    const first = mod.getRedisClient();
    const second = mod.getRedisClient();

    expect(first).toBe(second);
    expect(state.FakeRedis.instances).toHaveLength(1);
    expect(state.FakeRedis.instances[0]?.options).toEqual(
      expect.objectContaining({
        username: 'studio',
        password: 'redis-secret',
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      })
    );
    const retryStrategy = state.FakeRedis.instances[0]?.options.retryStrategy as ((times: number) => number | null);
    expect(retryStrategy(2)).toBe(200);
    expect(retryStrategy(11)).toBeNull();
  });

  it('tracks health and disconnects after repeated connection errors', async () => {
    const mod = await import('./redis.js');
    const client = mod.getRedisClient();
    const instance = state.FakeRedis.instances[0];

    instance.handlers.get('error')?.(new Error('WRONGPASS invalid password'));
    instance.handlers.get('error')?.(new Error('redis down'));
    for (let attempt = 0; attempt < 8; attempt += 1) {
      instance.handlers.get('error')?.(new Error(`failure-${attempt}`));
    }

    expect(instance.disconnect).toHaveBeenCalledTimes(1);
    expect(mod.getRedisHealthSnapshot()).toMatchObject({
      available: false,
      status: 'down',
      errorCount: 10,
      lastError: 'failure-7',
    });

    instance.handlers.get('connect')?.();
    expect(mod.getRedisHealthSnapshot()).toMatchObject({
      available: true,
      status: 'up',
      errorCount: 0,
      lastError: null,
    });
    expect(client).toBeDefined();
  });

  it('enables TLS for rediss urls when certificate files are readable', async () => {
    state.getRedisUrl.mockReturnValue('rediss://redis.example:6380');

    await import('./redis.js').then((mod) => mod.getRedisClient());

    expect(state.FakeRedis.instances[0]?.options).toEqual(
      expect.objectContaining({
        tls: expect.objectContaining({
          ca: [expect.stringContaining('ca.pem')],
          cert: expect.stringContaining('redis.pem'),
          key: expect.stringContaining('redis-key.pem'),
        }),
      })
    );
  });

  it('falls back without TLS when certificate loading fails', async () => {
    process.env.TLS_ENABLED = 'true';
    state.readFileSync.mockImplementation(() => {
      throw new Error('missing cert');
    });

    await import('./redis.js').then((mod) => mod.getRedisClient());

    expect(state.FakeRedis.instances[0]?.options.tls).toBeUndefined();
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Redis TLS configuration failed, continuing without TLS',
      expect.objectContaining({
        error: 'missing cert',
      })
    );
  });

  it('reports availability from ping and resets state on close', async () => {
    const mod = await import('./redis.js');
    mod.getRedisClient();
    const instance = state.FakeRedis.instances[0];

    await expect(mod.isRedisAvailable()).resolves.toBe(true);
    expect(mod.getRedisHealthSnapshot()).toMatchObject({
      available: true,
      status: 'up',
    });

    instance.pingImpl.mockRejectedValueOnce(new Error('ping failed'));
    await expect(mod.isRedisAvailable()).resolves.toBe(false);
    expect(mod.getLastRedisError()).toBe('ping failed');

    await mod.closeRedis();
    expect(instance.quitImpl).toHaveBeenCalledTimes(1);
    expect(mod.getRedisHealthSnapshot()).toMatchObject({
      available: false,
      status: 'down',
      errorCount: 0,
      lastError: null,
    });
  });
});
