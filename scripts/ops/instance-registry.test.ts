import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createExecutor,
  createInstanceRegistryCommandContext,
  type InstanceRegistryCommandContext,
  type PoolClientLike,
  type PoolLike,
} from './instance-registry/command-context.ts';
import { renderResult } from './instance-registry/formatters.ts';
import { parseInstanceRegistryCliOptions } from './instance-registry/parse-options.ts';
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
    const withTransaction: InstanceRegistryCommandContext['withTransaction'] = async (work) =>
      work({
        createProvisioningRequest,
      } as never);
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

    expect(withTransaction).toHaveBeenCalled();
    expect(createProvisioningRequest).toHaveBeenCalled();
    consoleSpy.mockRestore();
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

    await expect(context.withTransaction(async () => Promise.reject(new Error('failed work')))).rejects.toThrow(
      'failed work'
    );
    expect(query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
