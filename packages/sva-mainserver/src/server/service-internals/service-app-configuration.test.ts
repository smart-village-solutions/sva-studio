import { describe, expect, it, vi } from 'vitest';
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
  baseline: {
    alternativeLocation: { state: 'missing' },
    tileTitleLines: { state: 'value', value: 2 },
  } as const,
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

describe('App configuration variant transport', () => {
  const source = { ...record, name: 'globalsettings' };
  const create = {
    operation: 'create',
    id: source.id,
    revision: source.revision,
    version: '2.1.0',
  } as const;
  const remove = { operation: 'delete', id: source.id, revision: source.revision } as const;

  it('copies full raw JSON to a newly created ID and independently checks the result', async () => {
    const { execute, service } = setup();
    execute
      .mockResolvedValueOnce({ staticContent: source })
      .mockResolvedValueOnce({ staticContents: [source] })
      .mockResolvedValueOnce({ createOrUpdateStaticContent: { id: '3' } })
      .mockResolvedValueOnce({ staticContent: { ...source, id: '3', version: '2.1.0' } });

    const result = await service.changeAppConfigurationVariant(connection, create);
    expect(result).toMatchObject({ status: 'created', document: { id: '3', version: '2.1.0' } });
    expect(result.status === 'created' && result.document).not.toHaveProperty('content');
    expect(execute.mock.calls[2]?.[0]).toMatchObject({
      allowRetry: false,
      operationName: 'SvaMainserverCopyStaticJson',
      variables: { name: source.name, content: raw, version: '2.1.0' },
    });
    expect(execute.mock.calls[2]?.[0].variables).not.toHaveProperty('id');
    expect(execute.mock.calls[3]?.[0]).toMatchObject({
      operationName: 'SvaMainserverStaticJsonById',
      variables: { id: '3' },
    });
  });

  it('checks the target again before allowing a manual retry after a timeout', async () => {
    const { execute, service } = setup();
    execute
      .mockResolvedValueOnce({ staticContent: source })
      .mockResolvedValueOnce({ staticContents: [source] })
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ staticContent: source })
      .mockResolvedValueOnce({
        staticContents: [source, { ...source, id: '3', version: create.version }],
      });
    expect(await service.changeAppConfigurationVariant(connection, create)).toEqual({
      status: 'unconfirmed',
    });
    expect(await service.changeAppConfigurationVariant(connection, create)).toEqual({
      status: 'exists',
    });
    expect(execute.mock.calls.filter(([request]) => request.allowRetry === false)).toHaveLength(1);
  });

  it('does not write if the Mainserver would change the file name', async () => {
    const { execute, service } = setup();
    execute.mockResolvedValueOnce({ staticContent: record });
    expect(await service.changeAppConfigurationVariant(connection, create)).toEqual({
      status: 'unsupported',
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['2.1', '2.1.0'],
    [null, null],
  ])('does not create over existing target %s', async (existing, requested) => {
    const { execute, service } = setup();
    execute
      .mockResolvedValueOnce({ staticContent: { ...source, version: '1.0' } })
      .mockResolvedValueOnce({
        staticContents: [{ ...source, id: '3', name: 'globalSettings', version: existing }],
      });
    expect(
      await service.changeAppConfigurationVariant(connection, { ...create, version: requested })
    ).toEqual({ status: 'exists' });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it.each([create, remove])(
    'does not mutate if the selected revision is stale ($operation)',
    async (command) => {
      const { execute, service } = setup();
      execute.mockResolvedValueOnce({ staticContent: { ...source, revision: 'r2' } });
      expect(await service.changeAppConfigurationVariant(connection, command)).toEqual({
        status: 'stale',
      });
      expect(execute).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    [null, 'deleted'],
    [source, 'unconfirmed'],
  ])('only confirms deletion after the exact ID disappears', async (after, status) => {
    const { execute, service } = setup();
    execute
      .mockResolvedValueOnce({ staticContent: source })
      .mockResolvedValueOnce({ destroyRecord: { id: Number(source.id), statusCode: 200 } })
      .mockResolvedValueOnce({ staticContent: after });
    expect(await service.changeAppConfigurationVariant(connection, remove)).toEqual({ status });
    expect(execute.mock.calls[1]?.[0]).toMatchObject({
      allowRetry: false,
      operationName: 'SvaMainserverDeleteStaticJson',
      variables: { id: source.id },
    });
    expect(execute.mock.calls[1]?.[0].document).toContain('recordType: "StaticContent"');
    expect(execute.mock.calls[2]?.[0]).toMatchObject({
      operationName: 'SvaMainserverStaticJsonById',
      variables: { id: source.id },
    });
  });
});
