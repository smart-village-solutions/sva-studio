import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IamContentAccessSummary, IamContentListItem } from '@sva/core';
import type { AuthenticatedRequestContext } from '../middleware.js';

const {
  authorizeContentActionMock,
  loadContentByIdMock,
  loadContentDetailMock,
  loadContentListItemsMock,
  resolveContentAccessMock,
  resolveContentActorMock,
} = vi.hoisted(() => ({
  authorizeContentActionMock: vi.fn(),
  loadContentByIdMock: vi.fn(),
  loadContentDetailMock: vi.fn(),
  loadContentListItemsMock: vi.fn(),
  resolveContentAccessMock: vi.fn(),
  resolveContentActorMock: vi.fn(),
}));

vi.mock('./request-context.js', () => ({
  authorizeContentAction: authorizeContentActionMock,
  resolveContentAccess: resolveContentAccessMock,
  resolveContentActor: resolveContentActorMock,
  withAuthenticatedContentHandler: vi.fn(),
}));

vi.mock('./repository.js', () => ({
  loadContentById: loadContentByIdMock,
  loadContentDetail: loadContentDetailMock,
  loadContentHistory: vi.fn(),
  loadContentListItems: loadContentListItemsMock,
}));

vi.mock('./mutations.js', () => ({
  createContentResponse: vi.fn(),
  deleteContentResponse: vi.fn(),
  updateContentResponse: vi.fn(),
}));

const { getContentInternal, listContentsInternal } = await import('./core.js');

const actor = {
  instanceId: 'instance-1',
  keycloakSubject: 'subject-1',
  actorDisplayName: 'Actor',
  requestId: 'request-1',
  traceId: 'trace-1',
};

const access = {
  state: 'allowed',
  canRead: true,
  canCreate: true,
  canUpdate: true,
  organizationIds: [],
  sourceKinds: [],
} satisfies IamContentAccessSummary;

const item = (id: string, organizationId: string): IamContentListItem => ({
  id,
  instanceId: 'instance-1',
  contentType: 'news.article',
  organizationId,
  title: `Content ${id}`,
  createdAt: '2026-04-26T10:00:00.000Z',
  createdBy: 'creator-1',
  updatedAt: '2026-04-26T10:00:00.000Z',
  updatedBy: 'updater-1',
  author: 'Actor',
  payload: {},
  status: 'draft',
  validationState: 'valid',
  historyRef: `history-${id}`,
});

const readJson = async (response: Response) => response.json() as Promise<Record<string, unknown>>;
const ctx = { sessionId: 'session-1', user: { sub: 'subject-1' } } as unknown as AuthenticatedRequestContext;

describe('content core authorization', () => {
  beforeEach(() => {
    authorizeContentActionMock.mockReset();
    loadContentByIdMock.mockReset();
    loadContentDetailMock.mockReset();
    loadContentListItemsMock.mockReset();
    resolveContentAccessMock.mockReset();
    resolveContentActorMock.mockReset();

    resolveContentActorMock.mockResolvedValue({ actor });
    resolveContentAccessMock.mockResolvedValue(access);
  });

  it('filters list responses per item using the persisted organization context', async () => {
    const visible = item('content-1', '11111111-1111-4111-8111-111111111111');
    const hidden = item('content-2', '22222222-2222-4222-8222-222222222222');
    loadContentListItemsMock.mockResolvedValue([visible, hidden]);
    authorizeContentActionMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(new Response(null, { status: 403 }));

    const response = await listContentsInternal(new Request('https://studio.test/api/v1/iam/contents'), ctx);

    expect(response.status).toBe(200);
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      1,
      actor,
      'content.read',
      expect.objectContaining({
        contentId: 'content-1',
        contentType: 'news.article',
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      2,
      actor,
      'content.read',
      expect.objectContaining({
        contentId: 'content-2',
        contentType: 'news.article',
        organizationId: '22222222-2222-4222-8222-222222222222',
      })
    );
    expect(await readJson(response)).toMatchObject({
      data: [expect.objectContaining({ id: 'content-1' })],
      pagination: expect.objectContaining({ total: 1 }),
    });
  });

  it('returns server authorization errors from list reads even when other items are readable', async () => {
    const first = item('content-1', '11111111-1111-4111-8111-111111111111');
    const second = item('content-2', '22222222-2222-4222-8222-222222222222');
    loadContentListItemsMock.mockResolvedValue([first, second]);
    authorizeContentActionMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    const response = await listContentsInternal(new Request('https://studio.test/api/v1/iam/contents'), ctx);

    expect(response.status).toBe(503);
  });

  it('loads content metadata before authorizing detail reads', async () => {
    const content = item('content-1', '11111111-1111-4111-8111-111111111111');
    loadContentByIdMock.mockResolvedValue(content);
    loadContentDetailMock.mockResolvedValue({ ...content, history: [] });
    authorizeContentActionMock.mockResolvedValue(null);

    const response = await getContentInternal(new Request('https://studio.test/api/v1/iam/contents/content-1'), ctx);

    expect(response.status).toBe(200);
    expect(authorizeContentActionMock).toHaveBeenCalledWith(
      actor,
      'content.read',
      expect.objectContaining({
        contentId: 'content-1',
        contentType: 'news.article',
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(loadContentDetailMock).toHaveBeenCalledWith('instance-1', 'content-1');
  });
});
