import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const client = { query: vi.fn(), release: vi.fn() };
  const pool = { connect: vi.fn(async () => client), end: vi.fn(async () => undefined) };
  const resolvePool = vi.fn(() => pool);
  return { client, pool, resolvePool, createPoolResolver: vi.fn(() => resolvePool) };
});

vi.mock('../db.js', () => ({ createPoolResolver: state.createPoolResolver }));
vi.mock('../runtime-secrets.js', () => ({ getIamDatabaseUrl: vi.fn() }));

describe('instance registry repository access', () => {
  it('uses the same pool for repository access and shutdown', async () => {
    const access = await import('./repository-access.js');
    expect(state.createPoolResolver).toHaveBeenCalledOnce();
    expect(access.resolveInstanceRegistryPool).toBe(state.resolvePool);

    const result = await access.withRegistryRepository(async () => 'read');
    await access.closeInstanceRegistryRepositoryPoolForShutdown();

    expect(result).toBe('read');
    expect(state.pool.connect).toHaveBeenCalledOnce();
    expect(state.client.release).toHaveBeenCalledOnce();
    expect(state.pool.end).toHaveBeenCalledOnce();
  });
});
