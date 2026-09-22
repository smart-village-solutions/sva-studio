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
