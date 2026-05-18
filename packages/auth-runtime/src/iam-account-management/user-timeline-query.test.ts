import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  listGovernanceCases: vi.fn(),
  listAdminDsrCases: vi.fn(),
}));

vi.mock('@sva/iam-governance', () => ({
  listAdminDsrCases: state.listAdminDsrCases,
  listGovernanceCases: state.listGovernanceCases,
}));

describe('resolveUserTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.listGovernanceCases.mockResolvedValue({
      items: [
        {
          id: 'gov-1',
          type: 'case_opened',
          title: 'Governance',
          summary: 'Governance summary',
          createdAt: '2026-05-15T11:00:00.000Z',
          actorAccountId: 'user-1',
          targetAccountId: 'user-1',
          status: 'open',
          metadata: { severity: 'high' },
        },
      ],
    });
    state.listAdminDsrCases.mockResolvedValue({
      items: [
        {
          id: 'dsr-1',
          type: 'export_requested',
          title: 'DSR',
          summary: 'DSR summary',
          createdAt: '2026-05-15T09:00:00.000Z',
          actorAccountId: 'other-user',
          requesterAccountId: 'user-1',
          targetAccountId: 'target-1',
          canonicalStatus: 'queued',
          rawStatus: 'pending',
          metadata: { format: 'json' },
        },
      ],
    });
  });

  it('merges IAM, governance, and DSR events in reverse chronological order', async () => {
    const { resolveUserTimeline } = await import('./user-timeline-query.js');
    const client = {
      query: vi.fn(async () => ({
        rows: [
          {
            id: 'iam-1',
            event_type: 'user.updated',
            created_at: '2026-05-15T10:00:00.000Z',
            payload: { description: 'Profil geändert', action: 'fallback' },
            account_id: 'user-1',
            subject_id: null,
          },
        ],
      })),
    };

    const timeline = await resolveUserTimeline(client as never, {
      instanceId: 'instance-1',
      userId: 'user-1',
    });

    expect(timeline.map((item) => item.id)).toEqual(['governance:gov-1', 'iam-1', 'dsr:export_requested:dsr-1']);
    expect(timeline[0]).toMatchObject({
      perspective: 'actor_and_target',
      metadata: { severity: 'high', status: 'open' },
    });
    expect(timeline[1]).toMatchObject({
      category: 'iam',
      description: 'Profil geändert',
      perspective: 'actor',
    });
    expect(timeline[2]).toMatchObject({
      category: 'dsr',
      perspective: 'actor',
      metadata: { format: 'json', canonicalStatus: 'queued', rawStatus: 'pending' },
    });
  });

  it('falls back to action/event type strings and computes target perspective correctly', async () => {
    const { resolveUserTimeline } = await import('./user-timeline-query.js');
    const client = {
      query: vi.fn(async () => ({
        rows: [
          {
            id: 'iam-2',
            event_type: 'user.login',
            created_at: '2026-05-15T08:00:00.000Z',
            payload: { action: 'interactive_login' },
            account_id: 'user-1',
            subject_id: null,
          },
        ],
      })),
    };
    state.listGovernanceCases.mockResolvedValueOnce({
      items: [
        {
          id: 'gov-2',
          type: 'case_updated',
          title: 'Targeted governance',
          summary: 'Target summary',
          createdAt: '2026-05-15T07:00:00.000Z',
          actorAccountId: 'other-user',
          targetAccountId: 'user-1',
          status: 'closed',
          metadata: {},
        },
      ],
    });
    state.listAdminDsrCases.mockResolvedValueOnce({ items: [] });

    const timeline = await resolveUserTimeline(client as never, {
      instanceId: 'instance-1',
      userId: 'user-1',
    });

    expect(timeline[0]).toMatchObject({
      id: 'iam-2',
      description: 'interactive_login',
    });
    expect(timeline[1]).toMatchObject({
      id: 'governance:gov-2',
      perspective: 'target',
    });
  });

  it('includes IAM events where the user is only the target subject', async () => {
    const { resolveUserTimeline } = await import('./user-timeline-query.js');
    const client = {
      query: vi.fn(async () => ({
        rows: [
          {
            id: 'iam-3',
            event_type: 'user.password_setup_email_sent',
            created_at: '2026-05-15T12:00:00.000Z',
            payload: {
              title: 'Einladungs-E-Mail zum Passwort setzen versendet',
              description: 'Für dieses Konto wurde eine E-Mail zum Setzen des Passworts versendet.',
            },
            account_id: 'admin-1',
            subject_id: 'user-1',
          },
        ],
      })),
    };
    state.listGovernanceCases.mockResolvedValueOnce({ items: [] });
    state.listAdminDsrCases.mockResolvedValueOnce({ items: [] });

    const timeline = await resolveUserTimeline(client as never, {
      instanceId: 'instance-1',
      userId: 'user-1',
    });

    expect(timeline).toEqual([
      expect.objectContaining({
        id: 'iam-3',
        eventType: 'user.password_setup_email_sent',
        title: 'Einladungs-E-Mail zum Passwort setzen versendet',
        description: 'Für dieses Konto wurde eine E-Mail zum Setzen des Passworts versendet.',
        perspective: 'target',
      }),
    ]);
  });
});
