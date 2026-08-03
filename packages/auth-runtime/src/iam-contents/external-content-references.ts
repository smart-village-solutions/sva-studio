import type { ContentJsonValue, IamContentAuthorDisplayMode, IamContentStatus } from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';

import { loadContentById, updateContent } from './repository.js';
import { insertContentHistory } from './repository-shared.js';
import {
  emitContentCreatedActivity,
  insertContentRow,
  updateContentRevisionRefs,
  validatePublicationWindow,
} from './repository-write-helpers.js';
import type { CreateContentInput } from './repository-types.js';

export type ExternalContentReconciliationStatus =
  | 'pending'
  | 'bound'
  | 'reconciliation_required'
  | 'failed';

export type ExternalContentReference = Readonly<{
  id: string;
  instanceId: string;
  contentId: string;
  sourceSystem: string;
  sourceEntityType: string;
  sourceEntityId?: string;
  operationExternalId: string;
  reconciliationStatus: ExternalContentReconciliationStatus;
  lastErrorCode?: string;
}>;

type ExternalContentReferenceRow = {
  readonly id: string;
  readonly instance_id: string;
  readonly content_id: string;
  readonly source_system: string;
  readonly source_entity_type: string;
  readonly source_entity_id: string | null;
  readonly operation_external_id: string;
  readonly reconciliation_status: ExternalContentReconciliationStatus;
  readonly last_error_code: string | null;
};

const mapReference = (row: ExternalContentReferenceRow): ExternalContentReference => ({
  id: row.id,
  instanceId: row.instance_id,
  contentId: row.content_id,
  sourceSystem: row.source_system,
  sourceEntityType: row.source_entity_type,
  ...(row.source_entity_id ? { sourceEntityId: row.source_entity_id } : {}),
  operationExternalId: row.operation_external_id,
  reconciliationStatus: row.reconciliation_status,
  ...(row.last_error_code ? { lastErrorCode: row.last_error_code } : {}),
});

const referenceSelect = `
SELECT
  id::text,
  instance_id,
  content_id::text,
  source_system,
  source_entity_type,
  source_entity_id,
  operation_external_id,
  reconciliation_status,
  last_error_code
FROM iam.external_content_references
`;

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

const insertExternalContentReference = async (
  client: InstanceScopedClient,
  input: {
    readonly instanceId: string;
    readonly contentId: string;
    readonly sourceSystem: string;
    readonly sourceEntityType: string;
    readonly operationExternalId: string;
  }
): Promise<ExternalContentReference> => {
  const result = await client.query<ExternalContentReferenceRow>(
    `
INSERT INTO iam.external_content_references (
  instance_id,
  content_id,
  source_system,
  source_entity_type,
  operation_external_id,
  reconciliation_status
)
VALUES ($1, $2::uuid, $3, $4, $5, 'pending')
RETURNING
  id::text,
  instance_id,
  content_id::text,
  source_system,
  source_entity_type,
  source_entity_id,
  operation_external_id,
  reconciliation_status,
  last_error_code;
`,
    [
      input.instanceId,
      input.contentId,
      input.sourceSystem,
      input.sourceEntityType,
      input.operationExternalId,
    ]
  );
  const row = result.rows[0];
  if (!row) throw new Error('external_content_reference_create_failed');
  return mapReference(row);
};

export const createExternalContentReference = async (input: {
  readonly instanceId: string;
  readonly contentId: string;
  readonly sourceSystem: string;
  readonly sourceEntityType: string;
  readonly operationExternalId: string;
}): Promise<ExternalContentReference> =>
  withInstanceScopedDb(input.instanceId, (client) =>
    insertExternalContentReference(client, input)
  );

export const loadExternalContentReferenceByContentId = async (input: {
  readonly instanceId: string;
  readonly contentId: string;
  readonly sourceSystem: string;
  readonly sourceEntityType: string;
}): Promise<ExternalContentReference | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<ExternalContentReferenceRow>(
      `${referenceSelect}
WHERE instance_id = $1
  AND content_id = $2::uuid
  AND source_system = $3
  AND source_entity_type = $4
LIMIT 1;`,
      [input.instanceId, input.contentId, input.sourceSystem, input.sourceEntityType]
    );
    return result.rows[0] ? mapReference(result.rows[0]) : undefined;
  });

export const loadExternalContentReferenceByOperation = async (input: {
  readonly instanceId: string;
  readonly sourceSystem: string;
  readonly sourceEntityType: string;
  readonly operationExternalId: string;
}): Promise<ExternalContentReference | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<ExternalContentReferenceRow>(
      `${referenceSelect}
WHERE instance_id = $1
  AND source_system = $2
  AND source_entity_type = $3
  AND operation_external_id = $4
LIMIT 1;`,
      [input.instanceId, input.sourceSystem, input.sourceEntityType, input.operationExternalId]
    );
    return result.rows[0] ? mapReference(result.rows[0]) : undefined;
  });

export const listExternalContentReferences = async (input: {
  readonly instanceId: string;
  readonly sourceSystem: string;
  readonly sourceEntityType: string;
}): Promise<readonly ExternalContentReference[]> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<ExternalContentReferenceRow>(
      `${referenceSelect}
WHERE instance_id = $1
  AND source_system = $2
  AND source_entity_type = $3
ORDER BY created_at ASC, id ASC;`,
      [input.instanceId, input.sourceSystem, input.sourceEntityType]
    );
    return result.rows.map(mapReference);
  });

export const bindExternalContentReference = async (input: {
  readonly instanceId: string;
  readonly referenceId: string;
  readonly sourceEntityId: string;
}): Promise<ExternalContentReference> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<ExternalContentReferenceRow>(
      `
UPDATE iam.external_content_references
SET
  source_entity_id = $3,
  reconciliation_status = 'bound',
  last_error_code = NULL,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid
RETURNING
  id::text,
  instance_id,
  content_id::text,
  source_system,
  source_entity_type,
  source_entity_id,
  operation_external_id,
  reconciliation_status,
  last_error_code;
`,
      [input.instanceId, input.referenceId, input.sourceEntityId]
    );
    const row = result.rows[0];
    if (!row) throw new Error('external_content_reference_not_found');
    return mapReference(row);
  });

export const updateExternalContentReconciliationStatus = async (input: {
  readonly instanceId: string;
  readonly referenceId: string;
  readonly status: ExternalContentReconciliationStatus;
  readonly errorCode?: string;
}): Promise<void> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query(
      `
UPDATE iam.external_content_references
SET
  reconciliation_status = $3,
  last_error_code = $4,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid;
`,
      [input.instanceId, input.referenceId, input.status, input.errorCode ?? null]
    );
  });

export const withExternalContentMutationLock = async <T>(input: {
  readonly instanceId: string;
  readonly referenceId: string;
  readonly execute: () => Promise<T>;
}): Promise<T> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      input.instanceId,
      input.referenceId,
    ]);
    return input.execute();
  });

export const prepareExternalContent = async (input: CreateContentInput & {
  readonly sourceSystem: string;
  readonly sourceEntityType: string;
  readonly operationExternalId: string;
}): Promise<{ readonly contentId: string; readonly reference: ExternalContentReference }> => {
  return withInstanceScopedDb(input.instanceId, async (client) => {
    validatePublicationWindow(input);
    const contentId = await insertContentRow(client, input);
    const historyId = await insertContentHistory(client, {
      instanceId: input.instanceId,
      contentId,
      actorAccountId: input.actorAccountId,
      actorDisplayName: input.actorDisplayName,
      action: 'created',
      changedFields: [
        'contentType',
        'title',
        'payload',
        'status',
        ...(input.publishedAt ? ['publishedAt'] : []),
      ],
      nextStatus: input.status,
      summary: 'Inhalt erstellt',
      snapshot: input.payload,
    });
    await updateContentRevisionRefs(client, input.instanceId, contentId, historyId);
    await emitContentCreatedActivity(client, input, contentId);
    const reference = await insertExternalContentReference(client, {
      ...input,
      contentId,
    });
    return { contentId, reference };
  });
};

export const updateExternalContentCore = async (input: {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly actorDisplayName: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly contentId: string;
  readonly title: string;
  readonly payload: ContentJsonValue;
  readonly status: IamContentStatus;
  readonly publishedAt?: string;
  readonly authorDisplayMode: IamContentAuthorDisplayMode;
  readonly authorDisplayName: string;
}): Promise<void> => {
  const updated = await updateContent(input);
  if (!updated) throw new Error('external_content_core_not_found');
};

export const loadExternalContentCore = loadContentById;
