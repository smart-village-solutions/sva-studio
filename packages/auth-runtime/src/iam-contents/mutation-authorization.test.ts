import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IamContentListItem } from '@sva/core';

const { authorizeContentActionMock } = vi.hoisted(() => ({
  authorizeContentActionMock: vi.fn(),
}));

vi.mock('./request-context.js', () => ({
  authorizeContentAction: authorizeContentActionMock,
}));

const { authorizeUpdateContentActions, resolveUpdateContentActions } = await import('./mutation-authorization.js');

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

describe('content mutation authorization', () => {
  beforeEach(() => {
    authorizeContentActionMock.mockReset();
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

    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      1,
      actor,
      'content.updateMetadata',
      expect.objectContaining({
        domainCapability: 'content.update_metadata',
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      2,
      actor,
      'content.updatePayload',
      expect.objectContaining({
        domainCapability: 'content.update_payload',
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
  });

  it('uses persisted source organization for update checks and checks destination on reassignment', async () => {
    authorizeContentActionMock.mockResolvedValue(null);

    await expect(
      authorizeUpdateContentActions(actor, 'content-1', content(), {
        organizationId: '22222222-2222-4222-8222-222222222222',
      })
    ).resolves.toBeNull();

    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      1,
      actor,
      'content.updateMetadata',
      expect.objectContaining({
        domainCapability: 'content.update_metadata',
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      2,
      actor,
      'content.updateMetadata',
      expect.objectContaining({
        domainCapability: 'content.update_metadata',
        organizationId: '22222222-2222-4222-8222-222222222222',
      })
    );
  });

  it('checks status and payload actions against the destination organization during reassignment', async () => {
    authorizeContentActionMock.mockResolvedValue(null);

    await expect(
      authorizeUpdateContentActions(actor, 'content-1', content(), {
        organizationId: '22222222-2222-4222-8222-222222222222',
        payload: { body: 'Text' },
        status: 'published',
      })
    ).resolves.toBeNull();

    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      1,
      actor,
      'content.updateMetadata',
      expect.objectContaining({
        domainCapability: 'content.update_metadata',
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      2,
      actor,
      'content.updatePayload',
      expect.objectContaining({
        domainCapability: 'content.update_payload',
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      3,
      actor,
      'content.publish',
      expect.objectContaining({
        domainCapability: 'content.publish',
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      4,
      actor,
      'content.updateMetadata',
      expect.objectContaining({
        domainCapability: 'content.update_metadata',
        organizationId: '22222222-2222-4222-8222-222222222222',
      })
    );
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      5,
      actor,
      'content.updatePayload',
      expect.objectContaining({
        domainCapability: 'content.update_payload',
        organizationId: '22222222-2222-4222-8222-222222222222',
      })
    );
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      6,
      actor,
      'content.publish',
      expect.objectContaining({
        domainCapability: 'content.publish',
        organizationId: '22222222-2222-4222-8222-222222222222',
      })
    );
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
