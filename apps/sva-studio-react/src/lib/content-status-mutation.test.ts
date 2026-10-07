import type { IamContentAccessSummary } from '@sva/core';
import type { RegisteredStudioContentType } from '@sva/plugin-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  definitions: [] as RegisteredStudioContentType[],
  execute: vi.fn(),
}));
vi.mock('./plugins', () => ({ studioContentTypes: state.definitions }));
import {
  getSupportedQuickStatuses,
  isContentMutationAvailable,
  resolveStandaloneMainserverPrincipal,
  updateMainserverContentStatus,
} from './content-status-mutation';

const access: IamContentAccessSummary = {
  state: 'editable',
  canRead: true,
  canCreate: true,
  canUpdate: true,
  organizationIds: [],
  sourceKinds: [],
};
const item = { id: 'item-1', contentType: 'sample.entry', access };
const definition: RegisteredStudioContentType = {
  contentType: 'sample.entry',
  displayName: 'Sample',
  requiredReadAction: 'sample.read',
  requiredCreateAction: 'sample.create',
  createPath: '/sample/new',
  detailPath: '/sample/$id',
  mutations: {
    status: {
      requiredAction: 'sample.update',
      supportedStatuses: ['draft', 'published'],
      execute: state.execute,
    },
  },
};
describe('content status mutation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.definitions.splice(0, state.definitions.length, definition);
  });
  it('executes an additional registered content type through the same host path', async () => {
    expect(getSupportedQuickStatuses(item.contentType)).toEqual(['draft', 'published']);
    await updateMainserverContentStatus(item, 'published', 'organization', ['sample.update'], []);
    expect(state.execute).toHaveBeenCalledExactlyOnceWith('item-1', 'published', 'organization');
  });
  it('rejects missing and removed capabilities without a fallback', async () => {
    state.definitions.splice(0);
    expect(getSupportedQuickStatuses(item.contentType)).toEqual([]);
    await expect(
      updateMainserverContentStatus(item, 'draft', 'user', ['sample.update'], [])
    ).rejects.toThrow('unsupported_content_status');
    expect(state.execute).not.toHaveBeenCalled();
  });
  it('rejects undeclared target statuses', async () => {
    await expect(
      updateMainserverContentStatus(item, 'archived', 'user', ['sample.update'], [])
    ).rejects.toThrow('unsupported_content_status');
    expect(state.execute).not.toHaveBeenCalled();
  });
  it('rechecks action availability before executing', async () => {
    expect(isContentMutationAvailable(item.contentType, 'status', ['sample.update'], [])).toBe(
      true
    );
    await expect(updateMainserverContentStatus(item, 'draft', 'user', [], [])).rejects.toThrow(
      'content_mutation_unavailable'
    );
    expect(state.execute).not.toHaveBeenCalled();
  });
  it('rejects read-only and server-denied row access', async () => {
    for (const state of ['read_only', 'server_denied'] as const) {
      await expect(
        updateMainserverContentStatus(
          { ...item, access: { ...access, state, canUpdate: false } },
          'draft',
          'user',
          ['sample.update'],
          []
        )
      ).rejects.toThrow('content_mutation_unavailable');
    }
    expect(state.execute).not.toHaveBeenCalled();
  });
  it('requires the declared additional Mainserver runtime action', async () => {
    state.definitions[0] = {
      ...definition,
      mutations: {
        status: { ...definition.mutations!.status!, requiresMainserverMutationAction: true },
      },
    };
    await expect(
      updateMainserverContentStatus(item, 'draft', 'user', ['sample.update'], [])
    ).rejects.toThrow('content_mutation_unavailable');
    expect(state.execute).not.toHaveBeenCalled();
    await updateMainserverContentStatus(
      item,
      'draft',
      'user',
      ['sample.update'],
      ['sample.update']
    );
    expect(state.execute).toHaveBeenCalledOnce();
  });
  it('rejects an unavailable principal before calling the handler', async () => {
    await expect(
      updateMainserverContentStatus(
        item,
        'draft',
        undefined as unknown as 'user',
        ['sample.update'],
        []
      )
    ).rejects.toThrow('content_mutation_unavailable');
    expect(state.execute).not.toHaveBeenCalled();
  });
  it('propagates plugin failures to the existing dialog error path', async () => {
    state.execute.mockRejectedValue(new Error('content_status_detail_degraded'));
    await expect(
      updateMainserverContentStatus(item, 'draft', 'user', ['sample.update'], [])
    ).rejects.toThrow('content_status_detail_degraded');
  });
  it('uses the resource credential source before the create policy', () => {
    expect(
      resolveStandaloneMainserverPrincipal(
        { credentialSource: 'user' },
        { kind: 'fixed', value: 'organization', label: 'Organisation' }
      )
    ).toBe('user');
    expect(
      resolveStandaloneMainserverPrincipal(
        { credentialSource: 'organization' },
        { kind: 'fixed', value: 'user', label: 'Persönlich' }
      )
    ).toBe('organization');
  });

  it('fails closed when an existing resource has no principal and create is selectable', () => {
    expect(
      resolveStandaloneMainserverPrincipal(
        {},
        {
          kind: 'selectable',
          value: 'organization',
          options: [
            { value: 'organization', label: 'Organisation' },
            { value: 'user', label: 'Persönlich' },
          ],
        }
      )
    ).toBeUndefined();
    expect(
      resolveStandaloneMainserverPrincipal(
        {},
        { kind: 'fixed', value: 'organization', label: 'Organisation' }
      )
    ).toBeUndefined();
    expect(
      resolveStandaloneMainserverPrincipal(
        {},
        { kind: 'fixed', value: 'user', label: 'Persönlich' }
      )
    ).toBe('user');
    expect(resolveStandaloneMainserverPrincipal({}, undefined)).toBeUndefined();
  });
});
