import type { IamLegalTextListItem } from '@sva/core';

import { emitActivityLog, withInstanceScopedDb } from '../iam-account-management/shared.js';

type LegalTextRow = {
  id: string;
  legal_text_id: string;
  legal_text_version: string;
  locale: string;
  content_hash: string;
  is_active: boolean;
  published_at: string;
  created_at: string;
  acceptance_count: number;
  active_acceptance_count: number;
  last_accepted_at: string | null;
};

type CreateLegalTextInput = {
  instanceId: string;
  actorAccountId: string;
  requestId?: string;
  traceId?: string;
  legalTextId: string;
  legalTextVersion: string;
  locale: string;
  contentHash: string;
  isActive: boolean;
  publishedAt?: string;
};

type UpdateLegalTextInput = {
  instanceId: string;
  actorAccountId: string;
  requestId?: string;
  traceId?: string;
  legalTextVersionId: string;
  contentHash?: string;
  isActive?: boolean;
  publishedAt?: string;
};

const mapLegalTextListItem = (row: LegalTextRow): IamLegalTextListItem => ({
  id: row.id,
  legalTextId: row.legal_text_id,
  legalTextVersion: row.legal_text_version,
  locale: row.locale,
  contentHash: row.content_hash,
  isActive: row.is_active,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  acceptanceCount: row.acceptance_count,
  activeAcceptanceCount: row.active_acceptance_count,
  ...(row.last_accepted_at ? { lastAcceptedAt: row.last_accepted_at } : {}),
});

const LEGAL_TEXT_SELECT = `
SELECT
  version.id,
  version.legal_text_id,
  version.legal_text_version,
  version.locale,
  version.content_hash,
  version.is_active,
  version.published_at::text,
  version.created_at::text,
  COUNT(acceptance.id)::int AS acceptance_count,
  COUNT(acceptance.id) FILTER (
    WHERE acceptance.id IS NOT NULL
      AND acceptance.revoked_at IS NULL
  )::int AS active_acceptance_count,
  MAX(acceptance.accepted_at)::text AS last_accepted_at
FROM iam.legal_text_versions version
LEFT JOIN iam.legal_text_acceptances acceptance
  ON acceptance.instance_id = version.instance_id
 AND acceptance.legal_text_version_id = version.id
`;

export const loadLegalTextListItems = async (instanceId: string): Promise<readonly IamLegalTextListItem[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<LegalTextRow>(
      `${LEGAL_TEXT_SELECT}
WHERE version.instance_id = $1
GROUP BY version.id
ORDER BY version.legal_text_id ASC, version.locale ASC, version.published_at DESC, version.created_at DESC;
`,
      [instanceId]
    );

    return result.rows.map(mapLegalTextListItem);
  });

export const loadLegalTextById = async (
  instanceId: string,
  legalTextVersionId: string
): Promise<IamLegalTextListItem | undefined> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<LegalTextRow>(
      `${LEGAL_TEXT_SELECT}
WHERE version.instance_id = $1
  AND version.id = $2::uuid
GROUP BY version.id
LIMIT 1;
`,
      [instanceId, legalTextVersionId]
    );

    const row = result.rows[0];
    return row ? mapLegalTextListItem(row) : undefined;
  });

export const createLegalTextVersion = async (input: CreateLegalTextInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const insert = await client.query<{ id: string }>(
      `
INSERT INTO iam.legal_text_versions (
  instance_id,
  legal_text_id,
  legal_text_version,
  locale,
  content_hash,
  is_active,
  published_at
)
VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
ON CONFLICT (instance_id, legal_text_id, legal_text_version, locale) DO NOTHING
RETURNING id;
`,
      [
        input.instanceId,
        input.legalTextId,
        input.legalTextVersion,
        input.locale,
        input.contentHash,
        input.isActive,
        input.publishedAt ?? null,
      ]
    );

    const legalTextVersionId = insert.rows[0]?.id;
    if (!legalTextVersionId) {
      return undefined;
    }

    await emitActivityLog(client, {
      instanceId: input.instanceId,
      accountId: input.actorAccountId,
      eventType: 'iam.legal_text.created',
      result: 'success',
      payload: {
        legal_text_version_id: legalTextVersionId,
        legal_text_id: input.legalTextId,
        legal_text_version: input.legalTextVersion,
        locale: input.locale,
        is_active: input.isActive,
      },
      requestId: input.requestId,
      traceId: input.traceId,
    });

    return legalTextVersionId;
  });

export const updateLegalTextVersion = async (input: UpdateLegalTextInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const updateResult = await client.query<{ id: string }>(
      `
UPDATE iam.legal_text_versions
SET
  content_hash = COALESCE($3, content_hash),
  is_active = COALESCE($4, is_active),
  published_at = COALESCE($5::timestamptz, published_at)
WHERE instance_id = $1
  AND id = $2::uuid
RETURNING id;
`,
      [
        input.instanceId,
        input.legalTextVersionId,
        input.contentHash ?? null,
        input.isActive ?? null,
        input.publishedAt ?? null,
      ]
    );

    const updatedLegalTextVersionId = updateResult.rows[0]?.id;
    if (!updatedLegalTextVersionId) {
      return undefined;
    }

    await emitActivityLog(client, {
      instanceId: input.instanceId,
      accountId: input.actorAccountId,
      eventType: 'iam.legal_text.updated',
      result: 'success',
      payload: {
        legal_text_version_id: updatedLegalTextVersionId,
        updated_fields: Object.keys({
          ...(input.contentHash !== undefined ? { contentHash: true } : {}),
          ...(input.isActive !== undefined ? { isActive: true } : {}),
          ...(input.publishedAt !== undefined ? { publishedAt: true } : {}),
        }),
      },
      requestId: input.requestId,
      traceId: input.traceId,
    });

    return updatedLegalTextVersionId;
  });
