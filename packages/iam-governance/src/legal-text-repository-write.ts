import type { QueryClient } from './query-client.js';
import {
  collectUpdatedFields,
  type CreateLegalTextInput,
  deriveLegalTextId,
  loadExistingLegalTextId,
  loadLegalTextByIdWithClient,
  normalizeTargetIds,
  resolveLegalTextUpdateState,
  type UpdateLegalTextInput,
} from './legal-text-repository-shared.js';
import { hashLegalTextHtml, sanitizeLegalTextHtml } from './legal-text-html.js';
import type { LegalTextRepositoryDeps } from './legal-text-repository.js';

const emitLegalTextCreatedActivityLog = (
  deps: LegalTextRepositoryDeps,
  client: QueryClient,
  input: CreateLegalTextInput,
  legalTextVersionId: string
) =>
  deps.emitActivityLog(client, {
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

const emitLegalTextUpdatedActivityLog = (
  deps: LegalTextRepositoryDeps,
  client: QueryClient,
  input: UpdateLegalTextInput,
  updatedLegalTextVersionId: string,
  updatedFields: readonly string[]
) =>
  deps.emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.actorAccountId,
    eventType: 'iam.legal_text.updated',
    result: 'success',
    payload: { legal_text_version_id: updatedLegalTextVersionId, updated_fields: updatedFields },
    requestId: input.requestId,
    traceId: input.traceId,
  });

const persistLegalTextTargetRoles = async (
  client: QueryClient,
  input: {
    instanceId: string;
    legalTextVersionId: string;
    targetRoleIds: readonly string[];
  }
) => {
  if (input.targetRoleIds.length === 0) {
    return;
  }

  await client.query(
    `
INSERT INTO iam.legal_text_target_roles (
  instance_id,
  legal_text_version_id,
  role_id
)
SELECT
  $1,
  $2::uuid,
  role_id::uuid
FROM unnest($3::text[]) AS role_id
ON CONFLICT (instance_id, legal_text_version_id, role_id) DO NOTHING;
`,
    [input.instanceId, input.legalTextVersionId, input.targetRoleIds]
  );
};

const persistLegalTextTargetGroups = async (
  client: QueryClient,
  input: {
    instanceId: string;
    legalTextVersionId: string;
    targetGroupIds: readonly string[];
  }
) => {
  if (input.targetGroupIds.length === 0) {
    return;
  }

  await client.query(
    `
INSERT INTO iam.legal_text_target_groups (
  instance_id,
  legal_text_version_id,
  group_id
)
SELECT
  $1,
  $2::uuid,
  group_id::uuid
FROM unnest($3::text[]) AS group_id
ON CONFLICT (instance_id, legal_text_version_id, group_id) DO NOTHING;
`,
    [input.instanceId, input.legalTextVersionId, input.targetGroupIds]
  );
};

const replaceLegalTextTargetRoles = async (
  client: QueryClient,
  input: {
    instanceId: string;
    legalTextVersionId: string;
    targetRoleIds: readonly string[];
  }
) => {
  await client.query(
    `
DELETE FROM iam.legal_text_target_roles
WHERE instance_id = $1
  AND legal_text_version_id = $2::uuid;
`,
    [input.instanceId, input.legalTextVersionId]
  );

  await persistLegalTextTargetRoles(client, input);
};

const replaceLegalTextTargetGroups = async (
  client: QueryClient,
  input: {
    instanceId: string;
    legalTextVersionId: string;
    targetGroupIds: readonly string[];
  }
) => {
  await client.query(
    `
DELETE FROM iam.legal_text_target_groups
WHERE instance_id = $1
  AND legal_text_version_id = $2::uuid;
`,
    [input.instanceId, input.legalTextVersionId]
  );

  await persistLegalTextTargetGroups(client, input);
};

export const createLegalTextVersion = (
  deps: LegalTextRepositoryDeps,
  input: CreateLegalTextInput
): Promise<string | undefined> =>
  deps.withInstanceScopedDb(input.instanceId, async (client) => {
    const sanitizedContentHtml = sanitizeLegalTextHtml(input.contentHtml);
    const derivedContentHash = hashLegalTextHtml(sanitizedContentHtml);
    const isActive = input.status === 'valid';
    const targetRoleIds = normalizeTargetIds(input.targetRoleIds) ?? [];
    const targetGroupIds = normalizeTargetIds(input.targetGroupIds) ?? [];
    const legalTextId =
      (await loadExistingLegalTextId(client, input.instanceId, input.name)) ??
      deriveLegalTextId(input.name);
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

    await persistLegalTextTargetRoles(client, {
      instanceId: input.instanceId,
      legalTextVersionId,
      targetRoleIds,
    });
    await persistLegalTextTargetGroups(client, {
      instanceId: input.instanceId,
      legalTextVersionId,
      targetGroupIds,
    });

    await emitLegalTextCreatedActivityLog(deps, client, input, legalTextVersionId);

    return legalTextVersionId;
  });

export const updateLegalTextVersion = (
  deps: LegalTextRepositoryDeps,
  input: UpdateLegalTextInput
): Promise<string | undefined> =>
  deps.withInstanceScopedDb(input.instanceId, async (client) => {
    const current = await loadLegalTextByIdWithClient(
      client,
      input.instanceId,
      input.legalTextVersionId
    );
    if (!current) {
      return undefined;
    }

    const { nextContentHash, nextContentHtml, nextPublishedAt, nextStatus } =
      resolveLegalTextUpdateState(current, input);
    const targetRoleIds = normalizeTargetIds(input.targetRoleIds);
    const targetGroupIds = normalizeTargetIds(input.targetGroupIds);
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

    if (targetRoleIds !== undefined) {
      await replaceLegalTextTargetRoles(client, {
        instanceId: input.instanceId,
        legalTextVersionId: updatedLegalTextVersionId,
        targetRoleIds,
      });
    }
    if (targetGroupIds !== undefined) {
      await replaceLegalTextTargetGroups(client, {
        instanceId: input.instanceId,
        legalTextVersionId: updatedLegalTextVersionId,
        targetGroupIds,
      });
    }

    await emitLegalTextUpdatedActivityLog(
      deps,
      client,
      input,
      updatedLegalTextVersionId,
      collectUpdatedFields(input)
    );

    return updatedLegalTextVersionId;
  });
