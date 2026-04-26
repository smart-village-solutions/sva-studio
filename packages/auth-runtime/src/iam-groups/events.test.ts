import { describe, expect, it, vi } from 'vitest';

import { parseInvalidationEvent } from '../iam-authorization-cache-events.js';
import { publishGroupEvent } from './events.js';

const createClient = () => ({
  query: vi.fn(async () => ({ rows: [], rowCount: 1 })),
});

const readPublishedPayload = (client: ReturnType<typeof createClient>): Record<string, unknown> => {
  const params = client.query.mock.calls[0]?.[1] as [string, string] | undefined;
  if (!params) {
    throw new Error('pg_notify was not called');
  }
  return JSON.parse(params[1]) as Record<string, unknown>;
};

describe('group event publishing', () => {
  it('publishes compact group deletion payloads when pg_notify would exceed its safe size', async () => {
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

    const payload = readPublishedPayload(client);

    expect(Buffer.byteLength(JSON.stringify(payload), 'utf8')).toBeLessThanOrEqual(7_500);
    expect(payload).toMatchObject({
      event: 'GroupDeleted',
      groupId: 'group-1',
      affectedAccountIds: [],
      affectedAccountCount: affectedAccountIds.length,
      affectedKeycloakSubjectCount: affectedKeycloakSubjects.length,
      compacted: true,
    });
    expect(parseInvalidationEvent(JSON.stringify(payload))).toMatchObject({
      event: {
        type: 'group_deleted',
        affectedAccountIds: [],
      },
    });
  });

  it('keeps targeted group deletion payloads when they fit pg_notify limits', async () => {
    const client = createClient();

    await publishGroupEvent(client, {
      event: 'GroupDeleted',
      instanceId: 'instance-1',
      groupId: 'group-1',
      affectedAccountIds: ['account-1'],
      affectedKeycloakSubjects: ['subject-1'],
      eventId: 'event-1',
    });

    const payload = readPublishedPayload(client);
    expect(payload).toMatchObject({
      event: 'GroupDeleted',
      affectedAccountIds: ['account-1'],
      affectedKeycloakSubjects: ['subject-1'],
    });
    expect(payload).not.toHaveProperty('compacted');
  });
});
