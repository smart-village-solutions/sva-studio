import type { LoginMfaMode } from '@sva/core';
import type { SqlExecutor } from '../iam/repositories/types.js';
import { buildInstanceSelectColumns } from './repository-instance-select.js';
import { mapInstance } from './repository-mappers.js';
import type { InstanceListRow } from './repository-types.js';

// Call inside the existing scoped registry transaction, including run creation and audit.
export const createLoginMfaRepository = (executor: SqlExecutor) => ({
  updateLoginMfaPolicy: async (input: {
    instanceId: string;
    expectedRevision: number;
    mode: LoginMfaMode;
    actorId: string;
  }) => {
    const result = await executor.execute<InstanceListRow>({
      text: `UPDATE iam.instances SET login_mfa_desired_mode = $3, login_mfa_revision = login_mfa_revision + 1, login_mfa_run_id = NULL, updated_by = $4, updated_at = now() WHERE id = $1 AND login_mfa_revision = $2 RETURNING ${buildInstanceSelectColumns()}`,
      values: [input.instanceId, input.expectedRevision, input.mode, input.actorId],
    });
    if (!result.rows[0]) throw new Error('login_mfa_revision_conflict');
    return mapInstance(result.rows[0]);
  },
  bindLoginMfaRun: async (input: { instanceId: string; revision: number; runId: string }) => {
    const result = await executor.execute({
      text: 'UPDATE iam.instances SET login_mfa_run_id = $3 WHERE id = $1 AND login_mfa_revision = $2',
      values: [input.instanceId, input.revision, input.runId],
    });
    if (result.rowCount !== 1) throw new Error('login_mfa_revision_conflict');
  },
  verifyLoginMfaPolicy: async (input: {
    instanceId: string;
    revision: number;
    mode: LoginMfaMode;
    runId?: string;
  }) => {
    const result = await executor.execute({
      text: `UPDATE iam.instances SET login_mfa_applied_mode = $3, login_mfa_applied_revision = $2 WHERE id = $1 AND login_mfa_revision = $2 AND login_mfa_desired_mode = $3 AND (login_mfa_run_id = $4 OR ($4 IS NULL AND login_mfa_run_id IS NULL))`,
      values: [input.instanceId, input.revision, input.mode, input.runId ?? null],
    });
    return result.rowCount === 1;
  },
});
