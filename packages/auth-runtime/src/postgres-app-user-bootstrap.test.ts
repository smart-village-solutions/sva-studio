import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  class FakeClient {
    static instances: FakeClient[] = [];
    static nextConnectError: Error | null = null;

    connectImpl = vi.fn(async () => undefined);
    queryImpl = vi.fn(async () => undefined);
    endImpl = vi.fn(async () => undefined);

    constructor(readonly config: Record<string, unknown>) {
      FakeClient.instances.push(this);
      if (FakeClient.nextConnectError) {
        this.connectImpl.mockRejectedValueOnce(FakeClient.nextConnectError);
        FakeClient.nextConnectError = null;
      }
    }

    connect() {
      return this.connectImpl();
    }

    query(sql: string) {
      return this.queryImpl(sql);
    }

    end() {
      return this.endImpl();
    }
  }

  return {
    FakeClient,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
    },
    getAppDbPassword: vi.fn(),
    readFileSync: vi.fn(),
  };
});

vi.mock('pg', () => ({
  Client: state.FakeClient,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('./runtime-secrets.js', () => ({
  getAppDbPassword: state.getAppDbPassword,
}));

vi.mock('node:fs', () => ({
  readFileSync: state.readFileSync,
}));

describe('postgres app user bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.FakeClient.instances.length = 0;
    state.FakeClient.nextConnectError = null;
    state.getAppDbPassword.mockReturnValue('app-secret');
    delete process.env.SVA_RUNTIME_PROFILE;
    delete process.env.POSTGRES_PASSWORD;
    delete process.env.POSTGRES_PASSWORD_FILE;
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_DB;
    delete process.env.APP_DB_USER;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips bootstrap when the runtime profile or error message does not match', async () => {
    const { bootstrapStudioAppDbUserIfNeeded } = await import('./postgres-app-user-bootstrap.js');

    await expect(bootstrapStudioAppDbUserIfNeeded(new Error('other error'))).resolves.toBe(false);
    expect(state.FakeClient.instances).toHaveLength(0);

    vi.stubEnv('SVA_RUNTIME_PROFILE', 'production');
    await expect(
      bootstrapStudioAppDbUserIfNeeded(new Error('password authentication failed for user "sva_app"'))
    ).resolves.toBe(false);
    expect(state.FakeClient.instances).toHaveLength(0);
  });

  it('bootstraps the app role with env and file-based superuser passwords', async () => {
    vi.stubEnv('SVA_RUNTIME_PROFILE', 'studio');
    vi.stubEnv('POSTGRES_PASSWORD', 'super-secret');
    vi.stubEnv('POSTGRES_PASSWORD_FILE', '/run/secrets/postgres');
    vi.stubEnv('POSTGRES_USER', 'postgres');
    vi.stubEnv('POSTGRES_DB', 'sva_studio');
    vi.stubEnv('APP_DB_USER', 'sva_app');
    state.readFileSync.mockReturnValue('super-secret\n');

    const { bootstrapStudioAppDbUserIfNeeded } = await import('./postgres-app-user-bootstrap.js');

    await expect(
      bootstrapStudioAppDbUserIfNeeded(new Error('password authentication failed for user "sva_app"'))
    ).resolves.toBe(true);

    expect(state.FakeClient.instances).toHaveLength(1);
    expect(state.FakeClient.instances[0]?.config).toMatchObject({
      user: 'postgres',
      database: 'sva_studio',
      password: 'super-secret',
    });
    expect(state.FakeClient.instances[0]?.queryImpl).toHaveBeenCalledWith(
      expect.stringContaining('CREATE ROLE "sva_app" LOGIN PASSWORD')
    );
    expect(state.FakeClient.instances[0]?.queryImpl).toHaveBeenCalledWith(
      'GRANT CONNECT ON DATABASE "sva_studio" TO "sva_app"'
    );
    expect(state.FakeClient.instances[0]?.queryImpl).toHaveBeenCalledWith(
      'GRANT CREATE ON DATABASE "sva_studio" TO "sva_app"'
    );
    expect(state.FakeClient.instances[0]?.queryImpl).toHaveBeenCalledWith(
      'GRANT USAGE, CREATE ON SCHEMA public TO "sva_app"'
    );
    expect(state.logger.info).toHaveBeenCalledWith(
      'Bootstrapped studio app DB role',
      expect.objectContaining({
        operation: 'studio_db_bootstrap',
        app_db_user: 'sva_app',
      })
    );
  });

  it('returns false when required bootstrap secrets are absent', async () => {
    vi.stubEnv('SVA_RUNTIME_PROFILE', 'studio');
    state.getAppDbPassword.mockReturnValue(undefined);

    const { bootstrapStudioAppDbUserIfNeeded } = await import('./postgres-app-user-bootstrap.js');

    await expect(
      bootstrapStudioAppDbUserIfNeeded(new Error('password authentication failed for user "sva_app"'))
    ).resolves.toBe(false);
    expect(state.FakeClient.instances).toHaveLength(0);
  });

  it('returns false and logs a warning when every superuser attempt fails', async () => {
    vi.stubEnv('SVA_RUNTIME_PROFILE', 'studio');
    vi.stubEnv('POSTGRES_PASSWORD', 'bad-secret');
    state.FakeClient.nextConnectError = new Error('bad password');

    const { bootstrapStudioAppDbUserIfNeeded } = await import('./postgres-app-user-bootstrap.js');

    await expect(
      bootstrapStudioAppDbUserIfNeeded(new Error('password authentication failed for user "sva_app"'))
    ).resolves.toBe(false);

    expect(state.logger.warn).toHaveBeenCalledWith(
      'Studio DB bootstrap failed',
      expect.objectContaining({
        error: 'bad password',
      })
    );
  });
});
