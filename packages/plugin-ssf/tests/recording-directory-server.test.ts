import { expect, it, vi } from 'vitest';
import type { PluginServerHandlerExecutionContext } from '@sva/plugin-sdk';
import { createPluginServerHandlers } from '../src/server/index.js';
const handlerId = 'ssf.recording-directory-v2';
const context = (): PluginServerHandlerExecutionContext => ({
  request: new Request(
    'https://studio.test/internal/plugins/ssf/v2/recording-directory?tenantId=tenant-b'
  ),
  pluginId: 'ssf',
  handlerId,
  scope: 'service',
  service: { id: 'ssf-runtime', subject: 'technical', actionId: 'ssf.runtime-configuration.read' },
  tenant: {
    instanceId: 'tenant-a',
    displayName: 'A',
    timeZone: 'UTC',
    authorizationRevision: `sha256:${'a'.repeat(64)}`,
  },
});
it('binds a live tenant directory, reflects immediate revocation and fails closed on authority loss', async () => {
  let users = [
    {
      keycloakSubject: 'reviewer',
      displayName: 'Synthetic Reviewer',
      permissionIds: ['ssf.recording.review', 'content.read'],
      languages: ['de', 'en'],
    },
  ];
  const reader = vi.fn(async () => users);
  const handler = createPluginServerHandlers({ readPermissionDirectorySubjects: reader })[
    handlerId
  ];
  expect(handler).toBeTypeOf('function');
  if (!handler) throw new Error('directory handler missing');
  const first = await (await handler(context())).json();
  expect(first).toMatchObject({
    contractVersion: '2.0',
    tenantId: 'tenant-a',
    users: [
      {
        sub: 'reviewer',
        displayName: 'Synthetic Reviewer',
        permissions: ['ssf.recording.review'],
        languages: ['de', 'en'],
      },
    ],
  });
  expect(reader).toHaveBeenCalledWith({
    instanceId: 'tenant-a',
    permissionIds: expect.arrayContaining(['ssf.recording.recovery.custodian']),
  });
  expect((await (await handler(context())).json()).directoryRevision).toBe(
    first.directoryRevision
  );
  users = [];
  const removed = await (await handler(context())).json();
  expect(removed.users).toEqual([]);
  expect(removed.directoryRevision).not.toBe(first.directoryRevision);
  reader.mockRejectedValueOnce(new Error('IAM unavailable'));
  const failed = await handler(context());
  expect(failed.status).toBe(503);
  expect(await failed.json()).toMatchObject({
    contractVersion: '2.0',
    error: { code: 'recording_directory_unavailable', retryable: true },
  });
});
it('returns directory unavailability when host capability is absent', async () => {
  const handler = createPluginServerHandlers()[handlerId];
  expect(handler).toBeTypeOf('function');
  if (!handler) throw new Error('directory handler missing');
  expect((await handler(context())).status).toBe(503);
});
