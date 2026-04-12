import type { IamLegalTextListItem, IamPendingLegalTextItem } from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import { hashLegalTextHtml, sanitizeLegalTextHtml } from './html.js';
import {
  DeleteLegalTextInput,
  emitLegalTextCreatedActivityLog,
  emitLegalTextDeletedActivityLog,
  emitLegalTextUpdatedActivityLog,
  LegalTextDeleteConflictError,
} from './repository-activity.js';
import {
  LEGAL_TEXT_SELECT,
  collectUpdatedFields,
  type CreateLegalTextInput,
  deriveLegalTextId,
  type LegalTextRow,
  loadExistingLegalTextId,
  mapLegalTextListItem,
  mapPendingLegalTextItem,
  type PendingLegalTextRow,
  resolveLegalTextUpdateState,
  type UpdateLegalTextInput,
} from './repository-shared.js';

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

export { LegalTextDeleteConflictError } from './repository-activity.js';

const isForeignKeyConflict = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  typeof (error as { code?: unknown }).code === 'string' &&
  (error as { code: string }).code === '23503';

const loadLegalTextByIdWithClient = async (
  client: InstanceScopedClient,
  instanceId: string,
  legalTextVersionId: string
): Promise<IamLegalTextListItem | undefined> => {
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
};

export const loadLegalTextListItems = async (instanceId: string): Promise<readonly IamLegalTextListItem[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<LegalTextRow>(
      `${LEGAL_TEXT_SELECT}
WHERE version.instance_id = $1
GROUP BY version.id
ORDER BY version.name ASC, version.locale ASC, version.published_at DESC NULLS LAST, version.created_at DESC;
`,
      [instanceId]
    );

    return result.rows.map(mapLegalTextListItem);
  });

export const loadLegalTextById = async (instanceId: string, legalTextVersionId: string): Promise<IamLegalTextListItem | undefined> =>
  withInstanceScopedDb(instanceId, (client) => loadLegalTextByIdWithClient(client, instanceId, legalTextVersionId));

export const loadPendingLegalTexts = async (instanceId: string, keycloakSubject: string): Promise<readonly IamPendingLegalTextItem[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<PendingLegalTextRow>(
      `
SELECT
  version.id,
  version.legal_text_id,
  version.name,
  version.legal_text_version,
  version.locale,
  version.content_html,
  version.published_at::text
FROM iam.legal_text_versions version
WHERE version.instance_id = $1
  AND version.status = 'valid'
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
  });

export const createLegalTextVersion = async (input: CreateLegalTextInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const sanitizedContentHtml = sanitizeLegalTextHtml(input.contentHtml);
    const derivedContentHash = hashLegalTextHtml(sanitizedContentHtml);
    const isActive = input.status === 'valid';
    const legalTextId = (await loadExistingLegalTextId(client, input.instanceId, input.name)) ?? deriveLegalTextId(input.name);
    const insert = await client.query<{ id: string }>(
      `
WITH generated AS (
  SELECT gen_random_uuid() AS id
)
INSERT INTO iam.legal_text_versions (
  id,
  instance_id,
  legal_text_id,
  name,
  legal_text_version,
  locale,
  content_html,
  status,
  content_hash,
  is_active,
  published_at
)
SELECT
  generated.id,
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8,
  $9,
  COALESCE($10::timestamptz, CASE WHEN $7 = 'valid' THEN NOW() ELSE NULL END)
FROM generated
ON CONFLICT (instance_id, legal_text_id, legal_text_version, locale) DO NOTHING
RETURNING id;
`,
      [
        input.instanceId,
        legalTextId,
        input.name,
        input.legalTextVersion,
        input.locale,
        sanitizedContentHtml,
        input.status,
        derivedContentHash,
        isActive,
        input.publishedAt ?? null,
      ]
    );

    const legalTextVersionId = insert.rows[0]?.id;
    if (legalTextVersionId === undefined) {
      return undefined;
    }

    await emitLegalTextCreatedActivityLog(client, input, legalTextVersionId);

    return legalTextVersionId;
  });

export const updateLegalTextVersion = async (input: UpdateLegalTextInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const current = await loadLegalTextByIdWithClient(client, input.instanceId, input.legalTextVersionId);
    if (!current) {
      return undefined;
    }

    const { nextContentHash, nextContentHtml, nextPublishedAt, nextStatus } =
      resolveLegalTextUpdateState(current, input);
    const updateResult = await client.query<{ id: string }>(
      `
UPDATE iam.legal_text_versions
SET
  name = COALESCE($3, name),
  legal_text_version = COALESCE($4, legal_text_version),
  locale = COALESCE($5, locale),
  content_html = $6,
  status = $7,
  content_hash = $8,
  is_active = $9,
  published_at = $10::timestamptz,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid
RETURNING id;
`,
      [
        input.instanceId,
        input.legalTextVersionId,
        input.name ?? null,
        input.legalTextVersion ?? null,
        input.locale ?? null,
        nextContentHtml,
        nextStatus,
        nextContentHash,
        nextStatus === 'valid',
        nextPublishedAt,
      ]
    );

    const updatedLegalTextVersionId = updateResult.rows[0]?.id;
    if (updatedLegalTextVersionId === undefined) {
      return undefined;
    }

    await emitLegalTextUpdatedActivityLog(client, input, updatedLegalTextVersionId, collectUpdatedFields(input));

    return updatedLegalTextVersionId;
  });

export const deleteLegalTextVersion = async (input: DeleteLegalTextInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
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

    await emitLegalTextDeletedActivityLog(client, input, deletedLegalTextVersionId);

    return deletedLegalTextVersionId;
  });
