import { performance } from 'node:perf_hooks';

import {
  withBenchmarkInstanceDb,
  type AuthorizeBenchmarkPayload,
} from './iam-authorize-performance.ts';
import type { BrowserContext } from './iam-authorize-performance-session.js';

export type Pool = {
  connect: () => Promise<PoolClient>;
  end: () => Promise<void>;
};

type PoolClient = {
  query: <T>(
    text: string,
    values?: readonly unknown[]
  ) => Promise<{ rowCount: number | null; rows: T[] }>;
  release: () => void;
};

type AuthorizeApiPayload = AuthorizeBenchmarkPayload;

type AuthorizeApiResponse = {
  allowed?: boolean;
  cacheStatus?: string;
  error?: string;
  reason?: string;
  requestId?: string;
  snapshotVersion?: string | null;
  traceId?: string;
};
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

export const invokeAuthorize = async (input: {
  readonly baseUrl: string;
  readonly context: BrowserContext;
  readonly payload: AuthorizeApiPayload;
}): Promise<{
  readonly cacheStatus?: string;
  readonly durationMs: number;
  readonly response: AuthorizeApiResponse;
}> => {
  const startedAt = performance.now();
  const apiResponse = await input.context.request.post(
    new URL('/iam/authorize', input.baseUrl).toString(),
    {
      data: input.payload,
      failOnStatusCode: false,
      headers: JSON_HEADERS,
    }
  );
  const durationMs = performance.now() - startedAt;

  const response = (await apiResponse.json()) as AuthorizeApiResponse;
  if (apiResponse.status() !== 200) {
    throw new Error(
      `/iam/authorize antwortete mit HTTP ${apiResponse.status()} (${response.error ?? 'unknown_error'}).`
    );
  }
  if (typeof response.allowed !== 'boolean') {
    throw new Error('/iam/authorize lieferte keine fachliche Allow-/Deny-Entscheidung.');
  }

  return { cacheStatus: response.cacheStatus, durationMs, response };
};

export const emitUserScopeInvalidation = async (input: {
  readonly keycloakSubject: string;
  readonly instanceId: string;
  readonly pool: Pool;
  readonly scenarioRunId: string;
  readonly sampleIndex: number;
}): Promise<void> => {
  await withBenchmarkInstanceDb(input.pool, input.instanceId, async (client) => {
    await client.query(
      `
WITH bumped AS (
  INSERT INTO iam.permission_cache_user_revisions (
    instance_id,
    keycloak_subject,
    revision,
    updated_at
  )
  VALUES ($1, $2, 2, NOW())
  ON CONFLICT (instance_id, keycloak_subject) DO UPDATE
    SET revision = iam.permission_cache_user_revisions.revision + 1,
        updated_at = NOW()
  RETURNING revision
), notified AS (
  SELECT pg_notify(
    'iam_permission_snapshot_invalidation',
    json_build_object(
      'eventId', $3,
      'event', 'PermissionRevisionChanged',
      'instanceId', $1,
      'keycloakSubject', $2,
      'revisionScope', 'user',
      'newRevision', revision,
      'trigger', 'pg_notify'
    )::text
  )
  FROM bumped
)
SELECT revision
FROM bumped
CROSS JOIN notified
`,
      [
        input.instanceId,
        input.keycloakSubject,
        `bench-${input.scenarioRunId}-invalidate-${input.sampleIndex}`,
      ]
    );
  });
};
