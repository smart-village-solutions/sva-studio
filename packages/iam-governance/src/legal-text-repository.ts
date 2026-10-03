import type { IamLegalTextListItem, IamPendingLegalTextItem } from '@sva/core';

import type { QueryClient } from './query-client.js';
import {
  LEGAL_TEXT_SELECT,
  type CreateLegalTextInput,
  type LegalTextRow,
  mapLegalTextListItem,
  mapPendingLegalTextItem,
  type PendingLegalTextRow,
  type UpdateLegalTextInput,
} from './legal-text-repository-shared.js';
import { createLegalTextVersion, updateLegalTextVersion } from './legal-text-repository-write.js';

export type DeleteLegalTextInput = {
  instanceId: string;
  actorAccountId: string;
  requestId?: string;
  traceId?: string;
  legalTextVersionId: string;
};

export type LegalTextActivityLogInput = {
  instanceId: string;
  accountId: string;
  eventType: string;
  result: 'success' | 'failure';
  payload: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
};

export type LegalTextRepositoryDeps = {
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
  readonly emitActivityLog: (
    client: QueryClient,
    input: LegalTextActivityLogInput
  ) => Promise<void> | void;
};

export class LegalTextDeleteConflictError extends Error {
  constructor() {
    super('legal_text_acceptances_exist');
    this.name = 'LegalTextDeleteConflictError';
  }
}

const isForeignKeyConflict = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  typeof (error as { code?: unknown }).code === 'string' &&
  (error as { code: string }).code === '23503';

const emitLegalTextDeletedActivityLog = (
  deps: LegalTextRepositoryDeps,
  client: QueryClient,
  input: DeleteLegalTextInput,
  deletedLegalTextVersionId: string
) =>
  deps.emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.actorAccountId,
    eventType: 'iam.legal_text.deleted',
    result: 'success',
    payload: { legal_text_version_id: deletedLegalTextVersionId },
    requestId: input.requestId,
    traceId: input.traceId,
  });

const loadLegalTextByIdWithClient = async (
  client: QueryClient,
  instanceId: string,
  legalTextVersionId: string
): Promise<IamLegalTextListItem | undefined> => {
  const result = await client.query<LegalTextRow>(
    `${LEGAL_TEXT_SELECT}
WHERE version.instance_id = $1
  AND version.id = $2::uuid
GROUP BY version.id, role_targets.role_ids, group_targets.group_ids
LIMIT 1;
`,
    [instanceId, legalTextVersionId]
  );

  const row = result.rows[0];
  return row ? mapLegalTextListItem(row) : undefined;
};

export const createLegalTextRepository = (deps: LegalTextRepositoryDeps) => ({
  loadLegalTextListItems: (instanceId: string): Promise<readonly IamLegalTextListItem[]> =>
    deps.withInstanceScopedDb(instanceId, async (client) => {
      const result = await client.query<LegalTextRow>(
        `${LEGAL_TEXT_SELECT}
WHERE version.instance_id = $1
GROUP BY version.id, role_targets.role_ids, group_targets.group_ids
ORDER BY version.name ASC, version.locale ASC, version.published_at DESC NULLS LAST, version.created_at DESC;
`,
        [instanceId]
      );

      return result.rows.map(mapLegalTextListItem);
    }),

  loadLegalTextById: (
    instanceId: string,
    legalTextVersionId: string
  ): Promise<IamLegalTextListItem | undefined> =>
    deps.withInstanceScopedDb(instanceId, (client) =>
      loadLegalTextByIdWithClient(client, instanceId, legalTextVersionId)
    ),

  loadPendingLegalTexts: (
    instanceId: string,
    keycloakSubject: string
  ): Promise<readonly IamPendingLegalTextItem[]> =>
    deps.withInstanceScopedDb(instanceId, async (client) => {
      const result = await client.query<PendingLegalTextRow>(
        `
SELECT
  version.id,
  version.legal_text_id,
  version.name,
  version.legal_text_version,
  version.locale,
  version.content_html,
  version.published_at::text,
  COALESCE(role_targets.role_ids, ARRAY[]::text[]) AS target_role_ids,
  COALESCE(group_targets.group_ids, ARRAY[]::text[]) AS target_group_ids
FROM iam.legal_text_versions version
LEFT JOIN LATERAL (
  SELECT array_agg(target.role_id::text ORDER BY target.role_id::text) AS role_ids
  FROM iam.legal_text_target_roles target
  WHERE target.instance_id = version.instance_id
    AND target.legal_text_version_id = version.id
) role_targets ON true
LEFT JOIN LATERAL (
  SELECT array_agg(target.group_id::text ORDER BY target.group_id::text) AS group_ids
  FROM iam.legal_text_target_groups target
  WHERE target.instance_id = version.instance_id
    AND target.legal_text_version_id = version.id
) group_targets ON true
WHERE version.instance_id = $1
  AND version.status = 'valid'
  AND (
    (
      COALESCE(array_length(role_targets.role_ids, 1), 0) = 0
      AND COALESCE(array_length(group_targets.group_ids, 1), 0) = 0
    )
    OR EXISTS (
      SELECT 1
      FROM iam.accounts account
      LEFT JOIN iam.account_roles account_role
        ON account_role.instance_id = version.instance_id
       AND account_role.account_id = account.id
       AND account_role.valid_from <= NOW()
       AND (account_role.valid_to IS NULL OR account_role.valid_to > NOW())
      LEFT JOIN iam.account_groups account_group
        ON account_group.instance_id = version.instance_id
       AND account_group.account_id = account.id
       AND (account_group.valid_from IS NULL OR account_group.valid_from <= NOW())
       AND (account_group.valid_until IS NULL OR account_group.valid_until > NOW())
      LEFT JOIN iam.groups group_target
        ON group_target.instance_id = account_group.instance_id
       AND group_target.id = account_group.group_id
       AND group_target.is_active IS TRUE
      WHERE account.instance_id = version.instance_id
        AND account.keycloak_subject = $2
        AND (
          account_role.role_id::text = ANY(COALESCE(role_targets.role_ids, ARRAY[]::text[]))
          OR group_target.id::text = ANY(COALESCE(group_targets.group_ids, ARRAY[]::text[]))
        )
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM iam.legal_text_acceptances acceptance
    JOIN iam.accounts account
      ON account.id = acceptance.account_id
    WHERE acceptance.instance_id = version.instance_id
      AND acceptance.legal_text_version_id = version.id
      AND acceptance.revoked_at IS NULL
      AND account.keycloak_subject = $2
  )
ORDER BY version.published_at DESC NULLS LAST, version.created_at DESC;
`,
        [instanceId, keycloakSubject]
      );

      return result.rows.map(mapPendingLegalTextItem);
    }),

  createLegalTextVersion: (input: CreateLegalTextInput): Promise<string | undefined> =>
    createLegalTextVersion(deps, input),

  updateLegalTextVersion: (input: UpdateLegalTextInput): Promise<string | undefined> =>
    updateLegalTextVersion(deps, input, loadLegalTextByIdWithClient),

  deleteLegalTextVersion: (input: DeleteLegalTextInput): Promise<string | undefined> =>
    deps.withInstanceScopedDb(input.instanceId, async (client) => {
      let deleted;
      try {
        deleted = await client.query<{ id: string }>(
          `
DELETE FROM iam.legal_text_versions version
WHERE version.instance_id = $1
  AND version.id = $2::uuid
  AND NOT EXISTS (
    SELECT 1
    FROM iam.legal_text_acceptances acceptance
    WHERE acceptance.instance_id = version.instance_id
      AND acceptance.legal_text_version_id = version.id
  )
RETURNING version.id;
`,
          [input.instanceId, input.legalTextVersionId]
        );
      } catch (error) {
        if (isForeignKeyConflict(error)) {
          throw new LegalTextDeleteConflictError();
        }
        throw error;
      }

      const deletedLegalTextVersionId = deleted.rows[0]?.id;
      if (deletedLegalTextVersionId === undefined) {
        const acceptances = await client.query<{ has_acceptances: boolean }>(
          `
SELECT EXISTS (
  SELECT 1
  FROM iam.legal_text_acceptances
  WHERE instance_id = $1
    AND legal_text_version_id = $2::uuid
) AS has_acceptances;
`,
          [input.instanceId, input.legalTextVersionId]
        );
        if (acceptances.rows[0]?.has_acceptances) {
          throw new LegalTextDeleteConflictError();
        }
        return undefined;
      }

      await emitLegalTextDeletedActivityLog(deps, client, input, deletedLegalTextVersionId);

      return deletedLegalTextVersionId;
    }),
});
