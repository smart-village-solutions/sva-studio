import { describe, expect, it, vi } from 'vitest';

import { publishGroupEvent } from './events.js';

const createClient = () => ({
  query: vi.fn(async () => ({ rows: [{ revision: '2' }], rowCount: 1 })),
});

describe('group event publishing', () => {
  it('falls back to an instance revision for group deletion with a broad affected set', async () => {
    const client = createClient();
    const affectedAccountIds = Array.from({ length: 1_200 }, (_, index) => `account-${index}`);
    const affectedKeycloakSubjects = Array.from({ length: 1_200 }, (_, index) => `subject-${index}`);

    await publishGroupEvent(client, {
      event: 'GroupDeleted',
      instanceId: 'instance-1',
      groupId: 'group-1',
      affectedAccountIds,
      affectedKeycloakSubjects,
      eventId: 'event-1',
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO iam.permission_cache_instance_revisions'),
      ['instance-1']
    );
  });

  it('bumps only the targeted user revision for a known membership subject', async () => {
    const client = createClient();

    await publishGroupEvent(client, {
      event: 'GroupMembershipChanged',
      instanceId: 'instance-1',
      groupId: 'group-1',
      accountId: 'account-1',
      keycloakSubject: 'subject-1',
      changeType: 'added',
      eventId: 'event-1',
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO iam.permission_cache_user_revisions'),
      ['instance-1', 'subject-1']
    );
  });
});
