import { createHash } from 'node:crypto';

import type { IamLegalTextListItem, IamPendingLegalTextItem } from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import { hashLegalTextHtml, sanitizeLegalTextHtml } from './html.js';

export type LegalTextRow = {
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

export type CreateLegalTextInput = {
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

export type UpdateLegalTextInput = {
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

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

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

export const deriveLegalTextId = (name: string): string => {
  const trimmedName = name.trim();
  const base = deriveLegalTextIdBase(trimmedName);
  const hashSuffix = createHash('sha256').update(trimmedName).digest('hex').slice(0, LEGAL_TEXT_ID_HASH_LENGTH);

  return `${base || LEGAL_TEXT_ID_FALLBACK}_${hashSuffix}`;
};

export const loadExistingLegalTextId = async (
  client: InstanceScopedClient,
  instanceId: string,
  name: string
): Promise<string | undefined> => {
  const existingVersion = await client.query<{ legal_text_id: string }>(
    `
SELECT legal_text_id
FROM iam.legal_text_versions
WHERE instance_id = $1
  AND name = $2
ORDER BY updated_at DESC, created_at DESC
LIMIT 1;
`,
    [instanceId, name]
  );

  return existingVersion.rows[0]?.legal_text_id;
};

export const resolveLegalTextUpdateState = (
  current: IamLegalTextListItem,
  input: UpdateLegalTextInput
): {
  nextContentHash: string;
  nextContentHtml: string;
  nextPublishedAt: string | null;
  nextStatus: 'draft' | 'valid' | 'archived';
} => {
  const nextContentHtml =
    input.contentHtml !== undefined ? sanitizeLegalTextHtml(input.contentHtml) : current.contentHtml;
  const nextStatus = input.status ?? current.status;
  const nextPublishedAt = input.publishedAt ?? current.publishedAt ?? null;

  if (nextStatus === 'valid' && !nextPublishedAt) {
    throw new Error('legal_text_published_at_required');
  }

  return {
    nextContentHash: hashLegalTextHtml(nextContentHtml),
    nextContentHtml,
    nextPublishedAt,
    nextStatus,
  };
};

export const collectUpdatedFields = (input: UpdateLegalTextInput): string[] => {
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

export const mapLegalTextListItem = (row: LegalTextRow): IamLegalTextListItem => ({
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

export const mapPendingLegalTextItem = (row: LegalTextRow): IamPendingLegalTextItem => ({
  id: row.id,
  legalTextId: row.legal_text_id ?? row.id,
  name: row.name,
  legalTextVersion: row.legal_text_version,
  locale: row.locale,
  contentHtml: row.content_html,
  ...(row.published_at ? { publishedAt: row.published_at } : {}),
});

export const LEGAL_TEXT_SELECT = `
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
