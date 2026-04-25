import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  redisReady: vi.fn(async () => true),
  redisError: vi.fn(() => null as string | null),
  resolvePool: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: () => ({ requestId: 'req-health' }),
  withRequestContext: (_input: unknown, work: () => Promise<unknown>) => work(),
}));

vi.mock('./redis.js', () => ({
  getLastRedisError: state.redisError,
  isRedisAvailable: state.redisReady,
}));

vi.mock('./db.js', () => ({
  jsonResponse: (status: number, payload: unknown, headers?: Record<string, string>) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    }),
  resolvePool: state.resolvePool,
}));

const createReadyPool = () => ({
  connect: vi.fn(async () => ({
    query: vi.fn(async () => ({ rows: [], rowCount: 1 })),
    release: vi.fn(),
  })),
});

describe('auth-runtime health handlers', () => {
  it('returns live status without dependency checks', async () => {
    const { healthLiveHandler } = await import('./runtime-health.js');

    const response = await healthLiveHandler(new Request('http://localhost/health/live'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'alive',
      path: '/health/live',
      requestId: 'req-health',
    });
  });

  it('returns ready when database and redis are ready', async () => {
    state.resolvePool.mockReturnValue(createReadyPool());
    state.redisReady.mockResolvedValue(true);
    const { healthReadyHandler } = await import('./runtime-health.js');

    const response = await healthReadyHandler(new Request('http://localhost/health/ready'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      checks: {
        db: true,
        redis: true,
        errors: {},
      },
    });
  });

  it('returns not_ready when dependencies fail', async () => {
    state.resolvePool.mockReturnValue(null);
    state.redisReady.mockResolvedValue(false);
    state.redisError.mockReturnValue('redis down');
    const { healthReadyHandler } = await import('./runtime-health.js');

    const response = await healthReadyHandler(new Request('http://localhost/health/ready'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'not_ready',
      checks: {
        db: false,
        redis: false,
        errors: {
          db: 'IAM database not configured',
          redis: 'redis down',
        },
      },
    });
  });
});
