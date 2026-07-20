import type { SqlExecutor } from '../iam/repositories/types.js';

import type {
  ConsumeInstanceConfirmationChallengeInput,
  InstanceConfirmationChallengeRecord,
  PrepareInstanceConfirmationChallengeInput,
} from './repository-contract.js';
import type { InstanceConfirmationChallengeRow } from './repository-types.js';

const mapChallenge = (row: InstanceConfirmationChallengeRow): InstanceConfirmationChallengeRecord => ({
  challengeId: row.id,
  instanceId: row.instance_id,
  actorId: row.actor_id,
  actionId: row.action_id,
  ...(row.module_id ? { moduleId: row.module_id } : {}),
  stateFingerprint: row.state_fingerprint,
  expiresAt: row.expires_at,
  ...(row.request_id ? { requestId: row.request_id } : {}),
  createdAt: row.created_at,
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const createConfirmationChallengeRepository = (executor: SqlExecutor) => ({
  async prepareConfirmationChallenge(
    input: PrepareInstanceConfirmationChallengeInput
  ): Promise<InstanceConfirmationChallengeRecord> {
    const result = await executor.execute<InstanceConfirmationChallengeRow>({
      text: `
INSERT INTO iam.instance_confirmation_challenges (
  instance_id, actor_id, action_id, module_id, state_fingerprint, phrase_hash, expires_at, request_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8)
RETURNING id::text, instance_id, actor_id, action_id, module_id, state_fingerprint, phrase_hash,
  expires_at::text, consumed_at::text, request_id, created_at::text
`,
      values: [
        input.instanceId,
        input.actorId,
        input.actionId,
        input.moduleId ?? null,
        input.stateFingerprint,
        input.phraseHash,
        input.expiresAt,
        input.requestId ?? null,
      ],
    });
    const row = result.rows[0];
    if (!row) throw new Error('confirmation_challenge_create_failed');
    return mapChallenge(row);
  },

  async consumeConfirmationChallenge(input: ConsumeInstanceConfirmationChallengeInput): Promise<boolean> {
    if (!uuidPattern.test(input.challengeId)) return false;
    const result = await executor.execute<{ id: string }>({
      text: `
UPDATE iam.instance_confirmation_challenges
SET consumed_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2
  AND actor_id = $3
  AND action_id = $4
  AND module_id IS NOT DISTINCT FROM $5
  AND state_fingerprint = $6
  AND phrase_hash = $7
  AND consumed_at IS NULL
  AND expires_at > NOW()
RETURNING id::text
`,
      values: [
        input.challengeId,
        input.instanceId,
        input.actorId,
        input.actionId,
        input.moduleId ?? null,
        input.stateFingerprint,
        input.phraseHash,
      ],
    });
    return result.rowCount === 1;
  },
});
