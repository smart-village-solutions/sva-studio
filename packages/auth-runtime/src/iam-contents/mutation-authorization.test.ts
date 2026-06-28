import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IamContentListItem } from '@sva/core';

const { authorizeContentActionMock, resolveContentAuthorizationPermissionsMock } = vi.hoisted(
  () => ({
    authorizeContentActionMock: vi.fn(),
    resolveContentAuthorizationPermissionsMock: vi.fn(),
  })
);

vi.mock('./request-context.js', () => ({
  authorizeContentAction: authorizeContentActionMock,
  resolveContentAuthorizationPermissions: resolveContentAuthorizationPermissionsMock,
}));

const { authorizeUpdateContentActions, resolveUpdateContentActions } =
  await import('./mutation-authorization.js');

const content = (
  status: IamContentListItem['status'] = 'draft',
  organizationId = '11111111-1111-4111-8111-111111111111'
): IamContentListItem =>
  ({
    id: 'content-1',
    instanceId: 'instance-1',
    contentType: 'generic',
    organizationId,
    title: 'Content',
    createdAt: '2026-04-26T10:00:00.000Z',
    createdBy: 'actor-1',
    updatedAt: '2026-04-26T10:00:00.000Z',
    updatedBy: 'actor-1',
    authorDisplayMode: 'organization',
    author: 'Actor',
    payload: {},
    status,
    validationState: 'valid',
    historyRef: 'history-1',
  }) satisfies IamContentListItem;

const actor = {
  instanceId: 'instance-1',
  keycloakSubject: 'subject-1',
  actorDisplayName: 'Actor',
  requestId: 'request-1',
  traceId: 'trace-1',
};

const expectAuthorizationCall = (
  callIndex: number,
  primitiveAction: string,
  expectedResource: Record<string, unknown>
) => {
  expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
    callIndex,
    actor,
    primitiveAction,
    expect.objectContaining(expectedResource),
    expect.objectContaining({ permissions: [] })
  );
};

describe('content mutation authorization', () => {
  beforeEach(() => {
    authorizeContentActionMock.mockReset();
    resolveContentAuthorizationPermissionsMock.mockReset();
    resolveContentAuthorizationPermissionsMock.mockResolvedValue({ permissions: [] });
  });

  it('resolves update capabilities to primitive actions', () => {
    expect(resolveUpdateContentActions(content(), { title: 'Updated' })).toEqual([
      { domainCapability: 'content.update_metadata', primitiveAction: 'content.updateMetadata' },
    ]);
    expect(resolveUpdateContentActions(content(), { payload: { body: 'Text' } })).toEqual([
      { domainCapability: 'content.update_payload', primitiveAction: 'content.updatePayload' },
    ]);
    expect(resolveUpdateContentActions(content(), { status: 'published' })).toEqual([
      { domainCapability: 'content.publish', primitiveAction: 'content.publish' },
    ]);
    expect(resolveUpdateContentActions(content(), { status: 'archived' })).toEqual([
      { domainCapability: 'content.archive', primitiveAction: 'content.archive' },
    ]);
    expect(resolveUpdateContentActions(content('archived'), { status: 'draft' })).toEqual([
      { domainCapability: 'content.restore', primitiveAction: 'content.restore' },
    ]);
    expect(resolveUpdateContentActions(content('draft'), { status: 'in_review' })).toEqual([
      { domainCapability: 'content.change_status', primitiveAction: 'content.changeStatus' },
    ]);
    expect(resolveUpdateContentActions(content(), {})).toEqual([]);
  });

  it('deduplicates combined capability requirements in deterministic order', () => {
    expect(
      resolveUpdateContentActions(content(), {
        title: 'Updated',
        validationState: 'pending',
        payload: { body: 'Text' },
        status: 'published',
      })
    ).toEqual([
      { domainCapability: 'content.update_metadata', primitiveAction: 'content.updateMetadata' },
      { domainCapability: 'content.update_payload', primitiveAction: 'content.updatePayload' },
      { domainCapability: 'content.publish', primitiveAction: 'content.publish' },
    ]);
  });

  it('authorizes resolved primitive actions with domain capability context', async () => {
    authorizeContentActionMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(
      authorizeUpdateContentActions(actor, 'content-1', content(), {
        title: 'Updated',
        payload: { body: 'Text' },
      })
    ).resolves.toBeNull();

    expectAuthorizationCall(1, 'content.updateMetadata', {
      domainCapability: 'content.update_metadata',
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
    expectAuthorizationCall(2, 'content.updatePayload', {
      domainCapability: 'content.update_payload',
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
    expect(resolveContentAuthorizationPermissionsMock).toHaveBeenCalledTimes(1);
    expect(resolveContentAuthorizationPermissionsMock).toHaveBeenCalledWith(
      actor,
      '11111111-1111-4111-8111-111111111111'
    );
  });

  it('checks source and destination organization for reassignment', async () => {
    authorizeContentActionMock.mockResolvedValue(null);

    await expect(
      authorizeUpdateContentActions(actor, 'content-1', content(), {
        organizationId: '22222222-2222-4222-8222-222222222222',
      })
    ).resolves.toBeNull();

    expectAuthorizationCall(1, 'content.updateMetadata', {
      domainCapability: 'content.update_metadata',
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
    expectAuthorizationCall(2, 'content.updateMetadata', {
      domainCapability: 'content.update_metadata',
      organizationId: '22222222-2222-4222-8222-222222222222',
    });
    expect(authorizeContentActionMock).toHaveBeenCalledTimes(2);
    expect(resolveContentAuthorizationPermissionsMock).toHaveBeenNthCalledWith(
      1,
      actor,
      '11111111-1111-4111-8111-111111111111'
    );
    expect(resolveContentAuthorizationPermissionsMock).toHaveBeenNthCalledWith(
      2,
      actor,
      '22222222-2222-4222-8222-222222222222'
    );
    expect(resolveContentAuthorizationPermissionsMock).toHaveBeenCalledTimes(2);
  });

  it('checks status and payload actions against current and destination organizations during reassignment', async () => {
    authorizeContentActionMock.mockResolvedValue(null);

    await expect(
      authorizeUpdateContentActions(actor, 'content-1', content(), {
        organizationId: '22222222-2222-4222-8222-222222222222',
        payload: { body: 'Text' },
        status: 'published',
      })
    ).resolves.toBeNull();

    expectAuthorizationCall(1, 'content.updateMetadata', {
      domainCapability: 'content.update_metadata',
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
    expectAuthorizationCall(2, 'content.updatePayload', {
      domainCapability: 'content.update_payload',
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
    expectAuthorizationCall(3, 'content.publish', {
      domainCapability: 'content.publish',
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
    expectAuthorizationCall(4, 'content.updateMetadata', {
      domainCapability: 'content.update_metadata',
      organizationId: '22222222-2222-4222-8222-222222222222',
    });
    expectAuthorizationCall(5, 'content.updatePayload', {
      domainCapability: 'content.update_payload',
      organizationId: '22222222-2222-4222-8222-222222222222',
    });
    expectAuthorizationCall(6, 'content.publish', {
      domainCapability: 'content.publish',
      organizationId: '22222222-2222-4222-8222-222222222222',
    });
    expect(authorizeContentActionMock).toHaveBeenCalledTimes(6);
    expect(resolveContentAuthorizationPermissionsMock).toHaveBeenCalledTimes(2);
  });

  it('authorizes reassignment against prospective owner attributes', async () => {
    authorizeContentActionMock.mockResolvedValue(null);

    await expect(
      authorizeUpdateContentActions(
        actor,
        'content-1',
        {
          ...content(),
          ownerUserId: '33333333-3333-4333-8333-333333333333',
          ownerOrganizationId: '11111111-1111-4111-8111-111111111111',
        },
        {
          organizationId: '22222222-2222-4222-8222-222222222222',
          ownerUserId: '44444444-4444-4444-8444-444444444444',
        }
      )
    ).resolves.toBeNull();

    expectAuthorizationCall(1, 'content.updateMetadata', {
      organizationId: '11111111-1111-4111-8111-111111111111',
      ownerUserId: '33333333-3333-4333-8333-333333333333',
      ownerOrganizationId: '11111111-1111-4111-8111-111111111111',
    });
    expectAuthorizationCall(2, 'content.updateMetadata', {
      organizationId: '22222222-2222-4222-8222-222222222222',
      ownerUserId: '44444444-4444-4444-8444-444444444444',
      ownerOrganizationId: '11111111-1111-4111-8111-111111111111',
    });
    expect(authorizeContentActionMock).toHaveBeenCalledTimes(2);
    expect(resolveContentAuthorizationPermissionsMock).toHaveBeenCalledTimes(2);
  });

  it('authorizes owner-only transfers against the prospective owner target', async () => {
    authorizeContentActionMock.mockResolvedValue(null);

    await expect(
      authorizeUpdateContentActions(
        actor,
        'content-1',
        {
          ...content(),
          ownerUserId: '33333333-3333-4333-8333-333333333333',
          ownerOrganizationId: '11111111-1111-4111-8111-111111111111',
        },
        {
          ownerUserId: '44444444-4444-4444-8444-444444444444',
        }
      )
    ).resolves.toBeNull();

    expectAuthorizationCall(1, 'content.updateMetadata', {
      organizationId: '11111111-1111-4111-8111-111111111111',
      ownerUserId: '33333333-3333-4333-8333-333333333333',
      ownerOrganizationId: '11111111-1111-4111-8111-111111111111',
    });
    expectAuthorizationCall(2, 'content.updateMetadata', {
      organizationId: '11111111-1111-4111-8111-111111111111',
      ownerUserId: '44444444-4444-4444-8444-444444444444',
      ownerOrganizationId: '11111111-1111-4111-8111-111111111111',
    });
    expect(authorizeContentActionMock).toHaveBeenCalledTimes(2);
    expect(resolveContentAuthorizationPermissionsMock).toHaveBeenCalledTimes(1);
  });

  it('stops on authorization denial before later actions are evaluated', async () => {
    const denied = new Response(null, { status: 403 });
    authorizeContentActionMock.mockResolvedValueOnce(denied);

    await expect(
      authorizeUpdateContentActions(actor, 'content-1', content(), {
        title: 'Updated',
        payload: { body: 'Text' },
      })
    ).resolves.toBe(denied);

    expect(authorizeContentActionMock).toHaveBeenCalledTimes(1);
  });
});
