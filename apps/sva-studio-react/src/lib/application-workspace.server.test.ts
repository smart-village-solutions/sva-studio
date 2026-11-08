import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginServerHandlerExecutionContext } from '@sva/plugin-sdk';
const mocks = vi.hoisted(() => {
  const client = { query: vi.fn() };
  return {
    client,
    read: vi.fn(),
    save: vi.fn(),
    audit: vi.fn(),
    withInstanceDb: vi.fn(
      async (_instance: string, operation: (client: object) => Promise<unknown>) =>
        operation(client)
    ),
  };
});
vi.mock('@sva/data-repositories/server', () => ({
  readApplicationWorkspace: mocks.read,
  saveApplicationWorkspace: mocks.save,
}));
vi.mock('@sva/auth-runtime/plugin-server-host', () => ({
  pluginServerHost: { withInstanceDb: mocks.withInstanceDb, insertActivityLog: mocks.audit },
}));
import { applicationWorkspaceHost } from './application-workspace.server.js';
type Context = Extract<PluginServerHandlerExecutionContext, { scope: 'tenant' | 'platform' }>;
const context = (instanceId: string | undefined = 'municipality'): Context => ({
  request: new Request('https://studio.example/settings', {
    headers: { 'x-instance-id': 'forged' },
  }),
  sessionId: 'session',
  pluginId: 'application-workspace',
  handlerId: 'application-workspace.settings.save',
  pathParams: {},
  scope: 'platform',
  actor: { id: 'actor', roles: [], instanceId },
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockReset().mockResolvedValue({ version: 0, tiles: [] });
  mocks.save.mockReset().mockResolvedValue({ version: 1, tiles: [] });
  mocks.audit.mockReset().mockResolvedValue(undefined);
});
describe('workspace host adapter boundaries', () => {
  it('uses each explicit read scope without retaining a previous instance', async () => {
    const first = { version: 2, tiles: [] },
      second = { version: 5, tiles: [] };
    mocks.read.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    await expect(applicationWorkspaceHost.read('first')).resolves.toBe(first);
    await expect(applicationWorkspaceHost.read('second')).resolves.toBe(second);
    expect(mocks.read.mock.calls).toEqual([
      [mocks.client, 'first'],
      [mocks.client, 'second'],
    ]);
  });
  it('rejects a missing verified instance before any database or audit operation', () => {
    const invalid = { ...context(), actor: { id: 'actor', roles: [] } };
    expect(() => applicationWorkspaceHost.save(invalid, { version: 0, tiles: [] })).toThrow(
      'invalid_instance_context'
    );
    expect(mocks.withInstanceDb).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('audits unique old and new IDs using the transaction client and omits configuration content', async () => {
    mocks.read.mockResolvedValue({
      version: 1,
      tiles: [{ id: 'kept' }, { id: 'removed' }, null, 2, { id: 12 }, { name: 'legacy' }],
    });
    const configuration = {
      version: 1,
      tiles: [
        { id: 'kept', url: 'https://private.example', name: 'Private application' },
        { id: 'new' },
      ],
    };
    const stored = { ...configuration, version: 2 };
    mocks.save.mockResolvedValue(stored);
    await expect(applicationWorkspaceHost.save(context(), configuration)).resolves.toBe(stored);
    expect(mocks.withInstanceDb).toHaveBeenCalledWith('municipality', expect.any(Function));
    expect(mocks.save).toHaveBeenCalledWith(mocks.client, 'municipality', configuration);
    const events = mocks.audit.mock.calls.map(([client, event]) => {
      expect(client).toBe(mocks.client);
      expect(event).toMatchObject({
        instanceId: 'municipality',
        actorUserId: 'actor',
        outcome: 'success',
      });
      return event;
    });
    expect(events.map((event) => event.pluginAction.resourceId)).toEqual([
      '2',
      'kept',
      'removed',
      'new',
    ]);
    expect(JSON.stringify(events)).not.toContain('private.example');
    expect(JSON.stringify(events)).not.toContain('Private application');
  });
  it('propagates a later tile audit failure without retrying the write', async () => {
    const failure = new Error('audit unavailable');
    mocks.audit
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(failure);
    await expect(
      applicationWorkspaceHost.save(context(), {
        version: 0,
        tiles: [{ id: 'first' }, { id: 'second' }],
      })
    ).rejects.toBe(failure);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.withInstanceDb).toHaveBeenCalledTimes(1);
    expect(mocks.audit).toHaveBeenCalledTimes(3);
  });
  it('does not report a successful action when persistence fails', async () => {
    const failure = new Error('workspace_version_conflict');
    mocks.save.mockRejectedValue(failure);
    await expect(applicationWorkspaceHost.save(context(), { version: 1, tiles: [] })).rejects.toBe(
      failure
    );
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
});
