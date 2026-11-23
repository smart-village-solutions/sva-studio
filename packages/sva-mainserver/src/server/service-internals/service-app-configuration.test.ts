import { describe, expect, it, vi } from 'vitest';
import { readAppConfigurationFields } from '../app-configuration-reconciliation.js';
import { createAppConfigurationService } from './service-app-configuration.js';

const raw = '{"appDesignSystem":{"serviceTiles":{"numberOfLines":2}},"foreign":9007199254740993}';
const updated = raw.replace('numberOfLines":2', 'numberOfLines":4');
const record = {
  id: '2',
  name: 'globalSettings',
  version: null,
  updatedAt: '2026-11-23',
  content: raw,
  revision: 'r1',
};
const command = {
  id: record.id,
  baselineRevision: 'r1',
  baseline: readAppConfigurationFields(raw)!,
  changes: { tileTitleLines: 4 },
};
const connection = { instanceId: 'sandbox', keycloakSubject: 'user' };

const setup = () => {
  const execute = vi.fn();
  const service = createAppConfigurationService({
    executeGraphqlWithConfig: execute,
    loadValidatedInstanceConfig: vi.fn().mockResolvedValue({}),
  });
  return { execute, service };
};

describe('App configuration Mainserver transport', () => {
  it('reads, sends a revision-guarded content-only update and independently verifies the raw result', async () => {
    const { execute, service } = setup();
    execute
      .mockResolvedValueOnce({ staticContent: record })
      .mockResolvedValueOnce({ createOrUpdateStaticContent: { id: record.id } })
      .mockResolvedValueOnce({ staticContent: { ...record, revision: 'r2', content: updated } });
    const result = await service.saveAppConfiguration(connection, command);
    expect(result).toMatchObject({
      status: 'saved',
      document: { revision: 'r2', name: 'globalSettings' },
    });
    expect(result.status === 'saved' && result.document).not.toHaveProperty('content');
    expect(execute.mock.calls.map(([operation]) => operation.operationName)).toEqual([
      'SvaMainserverStaticJsonById',
      'SvaMainserverUpdateStaticJson',
      'SvaMainserverStaticJsonById',
    ]);
    expect(execute.mock.calls[1]?.[0]).toMatchObject({
      ...connection,
      allowRetry: false,
      variables: { id: '2', content: updated, revision: 'r1' },
    });
    expect(execute.mock.calls[1]?.[0].variables).not.toHaveProperty('name');
    expect(execute.mock.calls[1]?.[0].variables).not.toHaveProperty('version');
  });

  it('reports an unconfirmed write if the independent readback does not match', async () => {
    const { execute, service } = setup();
    execute
      .mockResolvedValueOnce({ staticContent: record })
      .mockResolvedValueOnce({ createOrUpdateStaticContent: { id: record.id } })
      .mockResolvedValueOnce({ staticContent: record });
    expect(await service.saveAppConfiguration(connection, command)).toEqual({
      status: 'unconfirmed',
    });
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('returns conflicts without sending a mutation', async () => {
    const { execute, service } = setup();
    execute.mockResolvedValueOnce({
      staticContent: {
        ...record,
        content: raw.replace('numberOfLines":2', 'numberOfLines":3'),
        revision: 'r2',
      },
    });
    expect(await service.saveAppConfiguration(connection, command)).toMatchObject({
      status: 'review',
      conflicts: ['tileTitleLines'],
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('refreshes the comparison when the mutation rejects a racing revision', async () => {
    const { execute, service } = setup();
    execute
      .mockResolvedValueOnce({ staticContent: record })
      .mockImplementationOnce(({ mapErrorCode }) => {
        throw mapErrorCode('REVISION_CONFLICT');
      })
      .mockResolvedValueOnce({
        staticContent: {
          ...record,
          content: raw.replace('numberOfLines":2', 'numberOfLines":3'),
          revision: 'r2',
        },
      });
    expect(await service.saveAppConfiguration(connection, command)).toMatchObject({
      status: 'review',
      conflicts: ['tileTitleLines'],
      document: { revision: 'r2' },
    });
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('reports a transport failure as unconfirmed and does not retry the mutation', async () => {
    const { execute, service } = setup();
    execute
      .mockResolvedValueOnce({ staticContent: record })
      .mockRejectedValueOnce(new Error('timeout'));
    expect(await service.saveAppConfiguration(connection, command)).toEqual({
      status: 'unconfirmed',
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
