import type { SqlStatement } from '../iam/repositories/types.js';
import type { MediaAssetListFilter } from './model-types.js';

export const buildAssetFilterClauses = (filter: Omit<MediaAssetListFilter, 'limit' | 'offset'>) => {
  const clauses = ['instance_id = $1', "lifecycle_status = 'active'"];
  const values: unknown[] = [filter.instanceId];

  if (filter.search?.trim()) {
    values.push(`%${filter.search.trim().toLowerCase()}%`);
    clauses.push(`(
      lower(coalesce(metadata->>'title', '')) LIKE $${values.length}
      OR lower(coalesce(metadata->>'altText', '')) LIKE $${values.length}
      OR lower(mime_type) LIKE $${values.length}
      OR lower(storage_key) LIKE $${values.length}
    )`);
  }

  if (filter.visibility?.trim()) {
    values.push(filter.visibility.trim());
    clauses.push(`visibility = $${values.length}`);
  }

  if (filter.afterStorageKey !== undefined) {
    values.push(filter.afterStorageKey);
    clauses.push(`storage_key COLLATE "C" > $${values.length}`);
  }

  return { clauses, values };
};

export const listAssetsStatement = (filter: MediaAssetListFilter): SqlStatement => {
  const { clauses, values } = buildAssetFilterClauses(filter);

  values.push(filter.limit ?? 25);
  const limitPlaceholder = `$${values.length}`;
  values.push(filter.offset ?? 0);
  const offsetPlaceholder = `$${values.length}`;

  return {
    text: `
SELECT
  id,
  instance_id,
  storage_key,
  media_type,
  mime_type,
  byte_size,
  visibility,
  upload_status,
  processing_status,
  lifecycle_status,
  provisional_operation_id,
  provisional_owner_subject,
  provisional_draft_id,
  provisional_expires_at,
  metadata,
  technical,
  created_at,
  updated_at
FROM iam.media_assets
WHERE ${clauses.join('\n  AND ')}
ORDER BY ${
      filter.order === 'storageKeyAsc'
        ? 'storage_key COLLATE "C" ASC'
        : 'updated_at DESC NULLS LAST, created_at DESC NULLS LAST'
    }
LIMIT ${limitPlaceholder}
OFFSET ${offsetPlaceholder};
`,
    values: values as SqlStatement['values'],
  };
};

export const countAssetsStatement = (
  filter: Omit<MediaAssetListFilter, 'limit' | 'offset'>
): SqlStatement => {
  const { clauses, values } = buildAssetFilterClauses(filter);

  return {
    text: `
SELECT COUNT(*)::int AS total
FROM iam.media_assets
WHERE ${clauses.join('\n  AND ')};
`,
    values: values as SqlStatement['values'],
  };
};
