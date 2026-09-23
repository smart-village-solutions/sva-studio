import { ACCOUNT_INVITATION_TEMPLATE_KEY } from '@sva/core';
import type { AccountInvitationTemplate, ServerAccountInvitationTemplateState } from '@sva/core';
import type { SqlExecutor } from '../iam/repositories/types.js';

import type { InstanceRegistryRepository } from './repository-contract.js';
import { buildInstanceSelectColumns } from './repository-instance-select.js';
import { mapInstance } from './repository-mappers.js';
import { resolveInstanceMutationActorId } from './repository-mutation-values.js';
import { queryRows, statement } from './repository-shared.js';
import type { InstanceListRow } from './repository-types.js';

export const updateAccountInvitationTemplate = async (
  executor: SqlExecutor,
  input: Parameters<InstanceRegistryRepository['updateAccountInvitationTemplate']>[0]
) => {
  const rows = await queryRows<InstanceListRow>(
    executor,
    statement(
      `
UPDATE iam.instances
SET
  account_invitation_template = $3::jsonb,
  updated_by = $4,
  updated_at = NOW()
WHERE id = $1
  AND COALESCE((account_invitation_template ->> 'revision')::integer, 0) = $2
RETURNING
${buildInstanceSelectColumns()};
`,
      [
        input.instanceId,
        input.expectedRevision,
        input.template ? JSON.stringify(input.template) : null,
        resolveInstanceMutationActorId(input.actorId),
      ]
    )
  );
  if (rows[0]) return mapInstance(rows[0]);

  const existing = await queryRows<{ instance_exists: boolean }>(
    executor,
    statement(`SELECT EXISTS (SELECT 1 FROM iam.instances WHERE id = $1) AS instance_exists;`, [
      input.instanceId,
    ])
  );
  if (existing[0]?.instance_exists) {
    throw new Error('account_invitation_template_revision_conflict');
  }
  return null;
};

type ServerAccountInvitationTemplateRow = {
  revision: number;
  template: AccountInvitationTemplate | null;
};

const mapServerTemplateState = (
  row: ServerAccountInvitationTemplateRow
): ServerAccountInvitationTemplateState => ({
  revision: row.revision,
  ...(row.template ? { template: row.template } : {}),
});

export const getServerAccountInvitationTemplate = async (
  executor: SqlExecutor
): Promise<ServerAccountInvitationTemplateState> => {
  const rows = await queryRows<ServerAccountInvitationTemplateRow>(
    executor,
    statement(
      `
SELECT revision, template
FROM iam.server_account_invitation_templates
WHERE template_key = $1;
`,
      [ACCOUNT_INVITATION_TEMPLATE_KEY]
    )
  );
  const row = rows[0];
  if (!row) throw new Error('server_account_invitation_template_missing');
  return mapServerTemplateState(row);
};

export const updateServerAccountInvitationTemplate = async (
  executor: SqlExecutor,
  input: Parameters<InstanceRegistryRepository['updateServerAccountInvitationTemplate']>[0]
): Promise<ServerAccountInvitationTemplateState> => {
  const rows = await queryRows<ServerAccountInvitationTemplateRow>(
    executor,
    statement(
      `
UPDATE iam.server_account_invitation_templates
SET
  revision = revision + 1,
  template = $3::jsonb,
  updated_by = $4,
  updated_at = NOW()
WHERE template_key = $1
  AND revision = $2
RETURNING revision, template;
`,
      [
        ACCOUNT_INVITATION_TEMPLATE_KEY,
        input.expectedRevision,
        input.template ? JSON.stringify(input.template) : null,
        resolveInstanceMutationActorId(input.actorId),
      ]
    )
  );
  const row = rows[0];
  if (!row) throw new Error('account_invitation_template_revision_conflict');
  return mapServerTemplateState(row);
};
