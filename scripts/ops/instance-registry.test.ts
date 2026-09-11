import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetInstanceConfigCache } from '@sva/server-runtime';
import { createInstanceRegistryService } from '@sva/instance-registry/service';

import {
  createExecutor,
  createInstanceRegistryCommandContext,
  type InstanceRegistryCommandContext,
  type PoolClientLike,
  type PoolLike,
} from './instance-registry/command-context.ts';
import { renderResult } from './instance-registry/formatters.ts';
import { parseInstanceRegistryCliOptions } from './instance-registry/parse-options.ts';
import { runMutationCommand } from './instance-registry/mutation-commands.ts';
import { deriveTenantAdminClientId } from './instance-registry/shared.ts';
import { runInstanceRegistryCli } from './instance-registry.ts';

describe('parseInstanceRegistryCliOptions', () => {
  it('parses list options with filters and json output', () => {
    expect(
      parseInstanceRegistryCliOptions(['list', '--search=Demo', '--status=active', '--json'])
    ).toMatchObject({
      command: 'list',
      jsonOutput: true,
      search: 'Demo',
      status: 'active',
    });
  });

  it('parses create options with defaults', () => {
    expect(
      parseInstanceRegistryCliOptions([
        'create',
        '--instance-id=demo',
        '--display-name=Demo',
        '--parent-domain=example.test',
        '--auth-client-id=sva-demo',
        '--auth-realm=demo',
      ])
    ).toMatchObject({
      command: 'create',
      instanceId: 'demo',
      realmMode: 'new',
      authClientId: 'sva-demo',
      authRealm: 'demo',
    });
  });

  it('rejects invalid status values', () => {
    expect(() => parseInstanceRegistryCliOptions(['list', '--status=unknown'])).toThrow('--status');
  });
});

describe('deriveTenantAdminClientId', () => {
  it('prefers the explicit tenant admin client id', () => {
    expect(deriveTenantAdminClientId('sva-demo', 'custom-admin')).toBe('custom-admin');
  });

  it('derives a default tenant admin client id', () => {
    expect(deriveTenantAdminClientId('sva-demo')).toBe('sva-demo-admin');
  });
});

describe('renderResult', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    logSpy.mockClear();
  });

  it('renders arrays as json lines in plain mode', () => {
    renderResult(false, [{ id: 'a' }, { id: 'b' }]);
    expect(logSpy.mock.calls).toEqual([['{"id":"a"}'], ['{"id":"b"}']]);
  });

  it('renders pretty json in json mode', () => {
    renderResult(true, { id: 'a' });
    expect(logSpy.mock.calls[0]?.[0]).toContain('\n');
  });
});

describe('runInstanceRegistryCli', () => {
  it('dispatches list commands through the read path', async () => {
    const listInstances = vi.fn(async () => [{ instanceId: 'demo' }]);
    const close = vi.fn(async () => undefined);
    const withTransaction = vi.fn(async () => {
      throw new Error('mutation path should not run');
    });
    const info = vi.fn();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(
      runInstanceRegistryCli(['list', '--status=active'], {
        env: { IAM_DATABASE_URL: 'postgres://example' },
        createContext: () => ({
          close,
          createReadService: () => ({ listInstances } as never),
          logger: { info, warn: vi.fn(), error: vi.fn(), debug: vi.fn(), isLevelEnabled: vi.fn() },
          withTransaction,
        }),
      })
    ).resolves.toBe(0);

    expect(listInstances).toHaveBeenCalledWith({ search: undefined, status: 'active' });
    expect(withTransaction).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(info).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('dispatches create commands through the mutation path', async () => {
    const createProvisioningRequest = vi.fn(async () => ({ ok: true }));
    const withTransactionSpy = vi.fn(async (_instanceId: string, work: (service: unknown) => Promise<unknown>) =>
      work({
        createProvisioningRequest,
      })
    );
    const withTransaction: InstanceRegistryCommandContext['withTransaction'] = (instanceId, work) =>
      withTransactionSpy(instanceId, work as (service: unknown) => Promise<unknown>) as Promise<
        Awaited<ReturnType<typeof work>>
      >;
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(
      runInstanceRegistryCli(
        [
          'create',
          '--instance-id=demo',
          '--display-name=Demo',
          '--parent-domain=example.test',
          '--auth-client-id=sva-demo',
          '--auth-realm=demo',
        ],
        {
          env: { IAM_DATABASE_URL: 'postgres://example' },
          createContext: (): InstanceRegistryCommandContext => ({
            close: vi.fn(async () => undefined),
            createReadService: vi.fn(() => {
              throw new Error('read path should not run');
            }),
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), isLevelEnabled: vi.fn() },
            withTransaction,
          }),
        }
      )
    ).resolves.toBe(0);

    expect(withTransactionSpy).toHaveBeenCalledWith('demo', expect.any(Function));
    expect(createProvisioningRequest).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('runs fleet backfills as one scoped transaction per active instance', async () => {
    const listInstances = vi.fn(async () => [
      {
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'example.test',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-demo',
        authIssuerUrl: 'https://id.example.test/realms/demo',
        tenantAdminClient: undefined,
        tenantAdminBootstrap: undefined,
        themeKey: 'default',
        featureFlags: {},
        mainserverConfigRef: null,
      },
    ]);
    const updateInstance = vi.fn(async () => ({ instanceId: 'demo' }));
    const executeKeycloakProvisioning = vi.fn(async () => ({ id: 'run-1' }));
    const withTransactionSpy = vi.fn(async (_instanceId: string, work: (service: unknown) => Promise<unknown>) =>
      work({ updateInstance, executeKeycloakProvisioning })
    );
    const withTransaction: InstanceRegistryCommandContext['withTransaction'] = (instanceId, work) =>
      withTransactionSpy(instanceId, work as (service: unknown) => Promise<unknown>) as Promise<
        Awaited<ReturnType<typeof work>>
      >;
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(
      runInstanceRegistryCli(['backfill-admin-client'], {
        env: { IAM_DATABASE_URL: 'postgres://example' },
        createContext: () => ({
          close: vi.fn(async () => undefined),
          createReadService: () => ({ listInstances } as never),
          logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), isLevelEnabled: vi.fn() },
          withTransaction,
        }),
      })
    ).resolves.toBe(0);

    expect(listInstances).toHaveBeenCalledWith({ status: 'active' });
    expect(withTransactionSpy).toHaveBeenCalledWith('demo', expect.any(Function));
    expect(updateInstance).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'demo' }));
    expect(executeKeycloakProvisioning).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'demo' }));
    consoleSpy.mockRestore();
  });
});

describe('runMutationCommand', () => {
  it('cannot bypass the service boundary for a dynamically reserved plugin client id', async () => {
    const repository = {
      getInstanceById: vi.fn(),
      createInstance: vi.fn(),
    };
    const service = createInstanceRegistryService({
      repository: repository as never,
      invalidateHost: vi.fn(),
      reservedOidcClientIds: () => ['ssf'],
    });
    const options = parseInstanceRegistryCliOptions([
      'create',
      '--instance-id=demo',
      '--display-name=Demo',
      '--parent-domain=example.test',
      '--auth-client-id=ssf',
      '--auth-realm=demo',
    ]);

    await expect(runMutationCommand(service, options)).rejects.toThrow('oidc_client_id_reserved');
    expect(repository.getInstanceById).not.toHaveBeenCalled();
    expect(repository.createInstance).not.toHaveBeenCalled();
  });
});

describe('createExecutor', () => {
  it('adapts pool query results to SqlExecutor results', async () => {
    const pool: PoolLike = {
      connect: vi.fn(),
      end: vi.fn(async () => undefined),
      query: vi.fn(async () => ({ rowCount: 2, rows: [{ id: 'a' }, { id: 'b' }] })),
    };

    const executor = createExecutor(pool);
    await expect(executor.execute({ text: 'select 1', values: [] })).resolves.toEqual({
      rowCount: 2,
      rows: [{ id: 'a' }, { id: 'b' }],
    });
  });
});

describe('createInstanceRegistryCommandContext', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetInstanceConfigCache();
  });

  it('reserves the configured platform host in the default CLI mutation service', async () => {
    vi.stubEnv('SVA_PARENT_DOMAIN', 'example.org');
    vi.stubEnv('SVA_STUDIO_ROOT_HOST', 'admin.example.org');
    vi.stubEnv('SVA_ALLOWED_INSTANCE_IDS', '');
    resetInstanceConfigCache();
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    const context = createInstanceRegistryCommandContext('postgres://example', undefined, {
      poolFactory: () => ({ query, connect: vi.fn(), end: vi.fn() }),
    });
    await expect(context.createReadService().createProvisioningRequest({
      instanceId: 'admin', displayName: 'Admin', parentDomain: 'example.org',
      realmMode: 'new', authRealm: 'admin', authClientId: 'sva-admin', idempotencyKey: 'reserved-host',
    })).rejects.toThrow('tenant_hostname_reserved');
    expect(query).not.toHaveBeenCalled();
    await context.close();
  });

  it('rolls back when transactional work fails', async () => {
    const query = vi
      .fn<PoolClientLike['query']>()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const client: PoolClientLike = {
      query,
      release: vi.fn(),
    };
    const pool: PoolLike = {
      connect: vi.fn(async () => client),
      end: vi.fn(async () => undefined),
      query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
    };
    const logger = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      isLevelEnabled: vi.fn(),
      warn: vi.fn(),
    };

    const context = createInstanceRegistryCommandContext('postgres://example', logger, {
      poolFactory: () => pool,
      serviceFactory: () => ({ listInstances: vi.fn() } as never),
    });

    await expect(context.withTransaction('demo', async () => Promise.reject(new Error('failed work')))).rejects.toThrow(
      'failed work'
    );
    expect(query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(query).toHaveBeenNthCalledWith(2, 'SELECT pg_advisory_xact_lock(hashtextextended($1, 0));', ['demo']);
    expect(query).toHaveBeenNthCalledWith(3, 'SET LOCAL ROLE iam_app;');
    expect(query).toHaveBeenNthCalledWith(4, 'SELECT set_config($1, $2, true);', ['app.instance_id', 'demo']);
    expect(query).toHaveBeenNthCalledWith(5, 'ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
