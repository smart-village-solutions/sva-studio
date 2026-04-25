import type { IamUserTimelineEvent } from '@sva/core';
import { listAdminDsrCases, listGovernanceCases } from '@sva/iam-governance';

import type { QueryClient } from '../db.js';
import { readString } from '../shared/input-readers.js';

type ActivityLogRow = {
  id: string;
  event_type: string;
  created_at: string;
  payload: Record<string, unknown> | null;
  account_id: string | null;
};

const readPerspective = (input: { actorMatch: boolean; targetMatch: boolean }) => {
  if (input.actorMatch && input.targetMatch) {
    return 'actor_and_target' as const;
  }
  if (input.targetMatch) {
    return 'target' as const;
  }
  return 'actor' as const;
};

export const resolveUserTimeline = async (
  client: QueryClient,
  input: { instanceId: string; userId: string }
): Promise<readonly IamUserTimelineEvent[]> => {
  const activityLogs = await client.query<ActivityLogRow>(
    `
SELECT id, event_type, created_at::text, payload, account_id::text
FROM iam.activity_logs
WHERE instance_id = $1
  AND account_id = $2::uuid
ORDER BY created_at DESC
LIMIT 100;
`,
    [input.instanceId, input.userId]
  );
  const governanceCases = await listGovernanceCases(client, {
    instanceId: input.instanceId,
    relatedAccountId: input.userId,
    page: 1,
    pageSize: 100,
  });
  const dsrCases = await listAdminDsrCases(client, {
    instanceId: input.instanceId,
    relatedAccountId: input.userId,
    page: 1,
    pageSize: 100,
  });

  const timeline: IamUserTimelineEvent[] = [
    ...activityLogs.rows.map((row) => ({
      id: row.id,
      category: 'iam' as const,
      eventType: row.event_type,
      title: row.event_type,
      description: readString(row.payload?.description) ?? readString(row.payload?.action) ?? row.event_type,
      occurredAt: row.created_at,
      perspective: 'actor' as const,
      metadata: row.payload ?? {},
    })),
    ...governanceCases.items.map((item) => ({
      id: `governance:${item.id}`,
      category: 'governance' as const,
      eventType: item.type,
      title: item.title,
      description: item.summary,
      occurredAt: item.createdAt,
      perspective: readPerspective({
        actorMatch: item.actorAccountId === input.userId,
        targetMatch: item.targetAccountId === input.userId,
      }),
      relatedEntityId: item.id,
      metadata: {
        status: item.status,
        ...item.metadata,
      },
    })),
    ...dsrCases.items.map((item) => ({
      id: `dsr:${item.type}:${item.id}`,
      category: 'dsr' as const,
      eventType: item.type,
      title: item.title,
      description: item.summary,
      occurredAt: item.createdAt,
      perspective: readPerspective({
        actorMatch: item.actorAccountId === input.userId || item.requesterAccountId === input.userId,
        targetMatch: item.targetAccountId === input.userId,
      }),
      relatedEntityId: item.id,
      metadata: {
        canonicalStatus: item.canonicalStatus,
        rawStatus: item.rawStatus,
        ...item.metadata,
      },
    })),
  ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

  return timeline;
};
