import { describe, expect, it, vi } from 'vitest';

import { resolveUserTimeline } from './iam-account-management/user-timeline-query';

const listGovernanceCasesMock = vi.fn();
const listAdminDsrCasesMock = vi.fn();

vi.mock('./iam-governance/read-models', () => ({
  listGovernanceCases: (...args: unknown[]) => listGovernanceCasesMock(...args),
}));

vi.mock('./iam-data-subject-rights/read-models', () => ({
  listAdminDsrCases: (...args: unknown[]) => listAdminDsrCasesMock(...args),
}));

describe('iam-account-management/user-timeline-query', () => {
  it('merges activity logs, governance cases and DSR cases into a reverse-chronological timeline', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: 'activity-1',
          event_type: 'iam.user.updated',
          created_at: '2026-03-15T09:00:00.000Z',
          payload: { description: 'Profil aktualisiert' },
          account_id: 'user-1',
        },
      ],
    });

    listGovernanceCasesMock.mockResolvedValue({
      items: [
        {
          id: 'gov-1',
          type: 'delegation',
          title: 'Delegation',
          summary: 'Delegation fuer Redaktion',
          createdAt: '2026-03-15T10:00:00.000Z',
          actorAccountId: 'user-2',
          targetAccountId: 'user-1',
          status: 'open',
          metadata: { ticketId: 'ABC-1' },
        },
      ],
    });
    listAdminDsrCasesMock.mockResolvedValue({
      items: [
        {
          id: 'dsr-1',
          type: 'request',
          title: 'Auskunft',
          summary: 'Auskunft angefragt',
          createdAt: '2026-03-15T11:00:00.000Z',
          actorAccountId: 'user-1',
          requesterAccountId: 'user-3',
          targetAccountId: 'user-1',
          canonicalStatus: 'in_progress',
          rawStatus: 'processing',
          metadata: { channel: 'portal' },
        },
      ],
    });

    const timeline = await resolveUserTimeline(
      { query } as never,
      { instanceId: 'de-musterhausen', userId: 'user-1' }
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM iam.activity_logs'), ['de-musterhausen', 'user-1']);
    expect(listGovernanceCasesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ relatedAccountId: 'user-1', page: 1, pageSize: 100 })
    );
    expect(listAdminDsrCasesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ relatedAccountId: 'user-1', page: 1, pageSize: 100 })
    );
    expect(timeline.map((entry) => entry.id)).toEqual(['dsr:request:dsr-1', 'governance:gov-1', 'activity-1']);
    expect(timeline[0]).toMatchObject({
      category: 'dsr',
      perspective: 'actor_and_target',
      metadata: expect.objectContaining({
        canonicalStatus: 'in_progress',
        rawStatus: 'processing',
        channel: 'portal',
      }),
    });
    expect(timeline[1]).toMatchObject({
      category: 'governance',
      perspective: 'target',
      metadata: expect.objectContaining({
        status: 'open',
        ticketId: 'ABC-1',
      }),
    });
    expect(timeline[2]).toMatchObject({
      category: 'iam',
      perspective: 'actor',
      description: 'Profil aktualisiert',
    });
  });

  it('falls back to action/event names and actor perspective when no description or target match exists', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: 'activity-2',
          event_type: 'iam.role.assigned',
          created_at: '2026-03-15T08:00:00.000Z',
          payload: { action: 'role_assign' },
          account_id: 'user-1',
        },
      ],
    });

    listGovernanceCasesMock.mockResolvedValue({
      items: [
        {
          id: 'gov-2',
          type: 'permission_change',
          title: 'Rollenwechsel',
          summary: 'Neue Rolle beantragt',
          createdAt: '2026-03-15T08:30:00.000Z',
          actorAccountId: 'user-1',
          targetAccountId: 'user-2',
          status: 'approved',
          metadata: {},
        },
      ],
    });
    listAdminDsrCasesMock.mockResolvedValue({ items: [] });

    const timeline = await resolveUserTimeline(
      { query } as never,
      { instanceId: 'de-musterhausen', userId: 'user-1' }
    );

    expect(timeline[0]).toMatchObject({
      id: 'governance:gov-2',
      perspective: 'actor',
    });
    expect(timeline[1]).toMatchObject({
      id: 'activity-2',
      description: 'role_assign',
    });
  });
});
