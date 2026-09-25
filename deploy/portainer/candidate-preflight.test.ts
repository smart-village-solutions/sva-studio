import { describe, expect, it, vi } from 'vitest';

const { query, connect, end, access } = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
  connect: vi.fn().mockResolvedValue(undefined),
  end: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('pg', () => ({ default: { Client: class { connect = connect; query = query; end = end; } } }));
vi.mock('node:fs/promises', () => ({ access, constants: { R_OK: 4 } }));

const {
  isCandidatePreflightEntrypoint,
  runCandidatePreflight,
} = await import('./candidate-preflight.mjs');

describe('candidate preflight', () => {
  it('recognizes relative and absolute CLI entrypoint paths', () => {
    const absolutePath = new URL('./candidate-preflight.mjs', import.meta.url).pathname;
    expect(
      isCandidatePreflightEntrypoint(
        new URL('./candidate-preflight.mjs', import.meta.url).href,
        absolutePath
      )
    ).toBe(true);
    expect(
      isCandidatePreflightEntrypoint(
        new URL('./candidate-preflight.mjs', import.meta.url).href,
        'deploy/portainer/candidate-preflight.mjs'
      )
    ).toBe(true);
    expect(
      isCandidatePreflightEntrypoint(
        new URL('./candidate-preflight.mjs', import.meta.url).href,
        undefined
      )
    ).toBe(false);
  });

  it('checks image configuration and database connectivity without reading tenants', async () => {
    const previousEnv = process.env;
    process.env = {
      ...previousEnv,
      SVA_RUNTIME_PROFILE: 'studio',
      WASTE_DATABASE_PROVISIONER_PASSWORD_FILE: '/test/provisioner-password',
      POSTGRES_DB: 'studio',
      POSTGRES_HOST: 'postgres',
      APP_DB_PASSWORD: 'test-password',
      POSTGRES_PORT: '5432',
      APP_DB_USER: 'studio',
    };
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await expect(runCandidatePreflight()).resolves.toBeUndefined();
      expect(access).toHaveBeenCalled();
      expect(connect).toHaveBeenCalled();
      expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN READ ONLY', 'SELECT 1', 'ROLLBACK']);
      expect(write).toHaveBeenCalledWith('{"status":"ok"}\n');
      expect(end).toHaveBeenCalled();
    } finally {
      write.mockRestore();
      process.env = previousEnv;
    }
  });
});
