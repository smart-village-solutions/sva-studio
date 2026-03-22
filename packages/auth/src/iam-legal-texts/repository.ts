import { createHash } from 'node:crypto';

import type { IamLegalTextListItem, IamPendingLegalTextItem } from '@sva/core';

import { emitActivityLog, withInstanceScopedDb } from '../iam-account-management/shared.js';
import { hashLegalTextHtml, sanitizeLegalTextHtml } from './html.js';

type LegalTextRow = {
  id: string;
  legal_text_id?: string;
  name: string;
  legal_text_version: string;
  locale: string;
  content_html: string;
  status: 'draft' | 'valid' | 'archived';
  published_at: string | null;
  created_at: string;
  updated_at: string;
  acceptance_count: number;
  active_acceptance_count: number;
  last_accepted_at: string | null;
};

type CreateLegalTextInput = {
  instanceId: string;
  actorAccountId: string;
  requestId?: string;
  traceId?: string;
  name: string;
  legalTextVersion: string;
  locale: string;
  contentHtml: string;
  status: 'draft' | 'valid' | 'archived';
  publishedAt?: string;
};

type UpdateLegalTextInput = {
  instanceId: string;
  actorAccountId: string;
  requestId?: string;
  traceId?: string;
  legalTextVersionId: string;
  name?: string;
  legalTextVersion?: string;
  locale?: string;
  contentHtml?: string;
  status?: 'draft' | 'valid' | 'archived';
  publishedAt?: string;
};

const LEGAL_TEXT_ID_FALLBACK = 'legal_text';
const LEGAL_TEXT_ID_HASH_LENGTH = 12;
const LEGAL_TEXT_ID_MAX_BASE_LENGTH = 48;

const isAsciiLetterOrDigit = (character: string): boolean => {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) {
    return false;
  }

  return (
    (codePoint >= 48 && codePoint <= 57) ||
    (codePoint >= 65 && codePoint <= 90) ||
    (codePoint >= 97 && codePoint <= 122)
  );
};

const deriveLegalTextIdBase = (value: string): string => {
  let result = '';
  let previousWasSeparator = false;

  for (const character of value.trim().toLowerCase()) {
    if (isAsciiLetterOrDigit(character)) {
      if (result.length >= LEGAL_TEXT_ID_MAX_BASE_LENGTH) {
        break;
      }
      result += character;
      previousWasSeparator = false;
      continue;
    }

    if (!previousWasSeparator && result.length > 0 && result.length < LEGAL_TEXT_ID_MAX_BASE_LENGTH) {
      result += '_';
      previousWasSeparator = true;
    }
  }

  return previousWasSeparator ? result.slice(0, -1) : result;
};

const deriveLegalTextId = (name: string): string => {
  const trimmedName = name.trim();
  const base = deriveLegalTextIdBase(trimmedName);
  const hashSuffix = createHash('sha256').update(trimmedName).digest('hex').slice(0, LEGAL_TEXT_ID_HASH_LENGTH);

  return `${base || LEGAL_TEXT_ID_FALLBACK}_${hashSuffix}`;
};

const collectUpdatedFields = (input: UpdateLegalTextInput): string[] => {
  const updatedFields: string[] = [];

  if (input.name !== undefined) {
    updatedFields.push('name');
  }
  if (input.legalTextVersion !== undefined) {
    updatedFields.push('legalTextVersion');
  }
  if (input.locale !== undefined) {
    updatedFields.push('locale');
  }
  if (input.contentHtml !== undefined) {
    updatedFields.push('contentHtml');
  }
  if (input.status !== undefined) {
    updatedFields.push('status');
  }
  if (input.publishedAt !== undefined) {
    updatedFields.push('publishedAt');
  }

  return updatedFields;
};

const mapLegalTextListItem = (row: LegalTextRow): IamLegalTextListItem => ({
  id: row.id,
  name: row.name,
  legalTextVersion: row.legal_text_version,
  locale: row.locale,
  contentHtml: row.content_html,
  status: row.status,
  ...(row.published_at ? { publishedAt: row.published_at } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  acceptanceCount: row.acceptance_count,
  activeAcceptanceCount: row.active_acceptance_count,
  ...(row.last_accepted_at ? { lastAcceptedAt: row.last_accepted_at } : {}),
});

const mapPendingLegalTextItem = (row: LegalTextRow): IamPendingLegalTextItem => ({
  id: row.id,
  legalTextId: row.legal_text_id ?? row.id,
  name: row.name,
  legalTextVersion: row.legal_text_version,
  locale: row.locale,
  contentHtml: row.content_html,
  ...(row.published_at ? { publishedAt: row.published_at } : {}),
});

const LEGAL_TEXT_SELECT = `
SELECT
  version.id,
  version.name,
  version.legal_text_version,
  version.locale,
  version.content_html,
  version.status,
  version.published_at::text,
  version.created_at::text,
  version.updated_at::text,
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
ORDER BY version.name ASC, version.locale ASC, version.published_at DESC NULLS LAST, version.created_at DESC;
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

export const loadPendingLegalTexts = async (
  instanceId: string,
  keycloakSubject: string
): Promise<readonly IamPendingLegalTextItem[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<LegalTextRow>(
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
  AND version.is_active = true
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
    const existingVersion = await client.query<{ legal_text_id: string }>(
      `
SELECT legal_text_id
FROM iam.legal_text_versions
WHERE instance_id = $1
  AND name = $2
ORDER BY updated_at DESC, created_at DESC
LIMIT 1;
`,
      [input.instanceId, input.name]
    );
    const legalTextId = existingVersion.rows[0]?.legal_text_id ?? deriveLegalTextId(input.name);
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
        name: input.name,
        legal_text_version: input.legalTextVersion,
        locale: input.locale,
        status: input.status,
      },
      requestId: input.requestId,
      traceId: input.traceId,
    });

    return legalTextVersionId;
  });

export const updateLegalTextVersion = async (input: UpdateLegalTextInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const current = await loadLegalTextById(input.instanceId, input.legalTextVersionId);
    if (!current) {
      return undefined;
    }

    const nextContentHtml =
      input.contentHtml !== undefined ? sanitizeLegalTextHtml(input.contentHtml) : current.contentHtml;
    const nextStatus = input.status ?? current.status;
    const nextPublishedAt = input.publishedAt ?? current.publishedAt ?? null;
    if (nextStatus === 'valid' && !nextPublishedAt) {
      throw new Error('legal_text_published_at_required');
    }
    const nextContentHash = hashLegalTextHtml(nextContentHtml);
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

    await emitActivityLog(client, {
      instanceId: input.instanceId,
      accountId: input.actorAccountId,
      eventType: 'iam.legal_text.updated',
      result: 'success',
      payload: {
        legal_text_version_id: updatedLegalTextVersionId,
        updated_fields: collectUpdatedFields(input),
      },
      requestId: input.requestId,
      traceId: input.traceId,
    });

    return updatedLegalTextVersionId;
  });
