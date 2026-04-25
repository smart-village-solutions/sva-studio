import type { Pool, PoolClient } from 'pg';

import type { QueryClient } from './db.js';

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export type InstanceIdResolutionResult =
  | {
      readonly ok: true;
      readonly instanceId: string;
      readonly fromInstanceKey: boolean;
      readonly created: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: 'missing_instance' | 'invalid_instance' | 'database_unavailable';
    };

export type ResolveInstanceIdInput = {
  readonly resolvePool: () => Pool | null;
  readonly candidate?: string;
  readonly createIfMissingFromKey?: boolean;
  readonly displayNameForCreate?: string;
};

export const resolveInstanceId = async (input: ResolveInstanceIdInput): Promise<InstanceIdResolutionResult> => {
  const rawValue = readString(input.candidate);
  if (!rawValue) {
    return { ok: false, reason: 'missing_instance' };
  }

  const pool = input.resolvePool();
  if (!pool) {
    return { ok: true, instanceId: rawValue, fromInstanceKey: false, created: false };
  }

  const client = (await pool.connect()) as PoolClient & QueryClient;
  try {
    const existing = await client.query<{ id: string }>(
      `
SELECT id
FROM iam.instances
WHERE id = $1
LIMIT 1;
`,
      [rawValue]
    );
    const existingId = existing.rows[0]?.id;
    if (existingId) {
      return { ok: true, instanceId: existingId, fromInstanceKey: false, created: false };
    }

    if (!input.createIfMissingFromKey) {
      return { ok: false, reason: 'invalid_instance' };
    }

    const insert = await client.query<{ id: string }>(
      `
INSERT INTO iam.instances (id, display_name)
VALUES ($1, $2)
ON CONFLICT (id) DO UPDATE
SET
  display_name = COALESCE(NULLIF(iam.instances.display_name, ''), EXCLUDED.display_name),
  updated_at = NOW()
RETURNING id;
`,
      [rawValue, input.displayNameForCreate ?? rawValue]
    );
    const createdId = insert.rows[0]?.id;
    if (!createdId) {
      return { ok: false, reason: 'invalid_instance' };
    }
    return { ok: true, instanceId: createdId, fromInstanceKey: false, created: true };
  } catch {
    return { ok: false, reason: 'database_unavailable' };
  } finally {
    client.release();
  }
};
