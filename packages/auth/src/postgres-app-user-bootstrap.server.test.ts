import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
  readFileSync: vi.fn(),
  getAppDbPassword: vi.fn(),
  clientConnect: vi.fn(),
  clientQuery: vi.fn(),
  clientEnd: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readFileSync: state.readFileSync,
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('./runtime-secrets.server.js', () => ({
  getAppDbPassword: state.getAppDbPassword,
}));

vi.mock('pg', () => ({
  Client: class MockClient {
    connect = state.clientConnect;
    query = state.clientQuery;
    end = state.clientEnd;
  },
}));

const originalEnv = { ...process.env };

describe('postgres-app-user bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    state.readFileSync.mockReturnValue('super-secret\n');
    state.getAppDbPassword.mockReturnValue('app-secret');
    state.clientConnect.mockResolvedValue(undefined);
    state.clientQuery.mockResolvedValue({ rowCount: 1, rows: [] });
    state.clientEnd.mockResolvedValue(undefined);
  });

  it('returns false when bootstrap conditions are not met', async () => {
    const { bootstrapStudioAppDbUserIfNeeded } = await import('./postgres-app-user-bootstrap.server.js');

    await expect(bootstrapStudioAppDbUserIfNeeded(new Error('password authentication failed'))).resolves.toBe(
      false
    );

    process.env.SVA_RUNTIME_PROFILE = 'studio';
    await expect(bootstrapStudioAppDbUserIfNeeded(new Error('another error'))).resolves.toBe(false);
  });

  it('returns false when required passwords are unavailable', async () => {
    process.env.SVA_RUNTIME_PROFILE = 'studio';
    process.env.POSTGRES_PASSWORD = '';
    delete process.env.POSTGRES_PASSWORD_FILE;
    state.getAppDbPassword.mockReturnValue(undefined);

    const { bootstrapStudioAppDbUserIfNeeded } = await import('./postgres-app-user-bootstrap.server.js');

    await expect(
      bootstrapStudioAppDbUserIfNeeded(new Error('password authentication failed for user "sva_app"'))
    ).resolves.toBe(false);
  });

  it('bootstraps the studio app user with file-based superuser password', async () => {
    process.env.SVA_RUNTIME_PROFILE = 'studio';
    process.env.POSTGRES_PASSWORD_FILE = '/run/secrets/postgres-password';
    delete process.env.POSTGRES_PASSWORD;
    process.env.APP_DB_USER = 'app_user';
    process.env.POSTGRES_USER = 'postgres';
    process.env.POSTGRES_DB = 'studio';

    const { bootstrapStudioAppDbUserIfNeeded } = await import('./postgres-app-user-bootstrap.server.js');

    await expect(
      bootstrapStudioAppDbUserIfNeeded(new Error('password authentication failed for user "sva_app"'))
    ).resolves.toBe(true);

    expect(state.readFileSync).toHaveBeenCalledWith('/run/secrets/postgres-password', 'utf8');
    expect(state.clientConnect).toHaveBeenCalledOnce();
    expect(state.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('CREATE ROLE "app_user" LOGIN PASSWORD'),
    );
    expect(state.clientQuery).toHaveBeenCalledWith('GRANT iam_app TO "app_user"');
    expect(state.logger.info).toHaveBeenCalledWith(
      'Bootstrapped studio app DB role',
      expect.objectContaining({
        operation: 'studio_db_bootstrap',
        app_db_user: 'app_user',
        database: 'studio',
      })
    );
  });

  it('logs a warning and returns false when bootstrap itself fails', async () => {
    process.env.SVA_RUNTIME_PROFILE = 'studio';
    process.env.POSTGRES_PASSWORD = 'super-secret';
    state.clientQuery.mockRejectedValue(new Error('bootstrap failed'));

    const { bootstrapStudioAppDbUserIfNeeded } = await import('./postgres-app-user-bootstrap.server.js');

    await expect(
      bootstrapStudioAppDbUserIfNeeded(new Error('password authentication failed for user "sva_app"'))
    ).resolves.toBe(false);

    expect(state.logger.warn).toHaveBeenCalledWith(
      'Studio DB bootstrap failed',
      expect.objectContaining({
        operation: 'studio_db_bootstrap',
        error: 'bootstrap failed',
      })
    );
    expect(state.clientEnd).toHaveBeenCalled();
  });
});
