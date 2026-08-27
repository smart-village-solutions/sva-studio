import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import type { ResolvedMainserverOwnershipTarget } from './mainserver-content-ownership.js';
import { lockMainserverDataProviderBindingScope } from './mainserver-data-provider-binding-lock.js';

export const withMainserverOwnershipTargetBindingLock = async <T>(input: {
  readonly instanceId: string;
  readonly target: ResolvedMainserverOwnershipTarget;
  readonly execute: () => Promise<T>;
}): Promise<T> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const principalType = input.target.principal.type === 'account' ? 'user' : 'organization';
    await lockMainserverDataProviderBindingScope(client, {
      instanceId: input.instanceId,
      principalType,
      principalId: input.target.principal.id,
      credentialFingerprint: input.target.connection.credentialFingerprint,
      dataProviderId: input.target.dataProviderId,
    });
    const result = await client.query<{ id: string; last_observed_at: string }>(
      `SELECT id::text, last_observed_at::text
       FROM iam.mainserver_data_provider_bindings
       WHERE instance_id = $1
         AND principal_type = $2
         AND principal_id = $3::uuid
         AND credential_fingerprint = $4
         AND data_provider_id = $5
         AND status = 'verified'
       ORDER BY last_observed_at DESC
       LIMIT 2
       FOR UPDATE;`,
      [
        input.instanceId,
        principalType,
        input.target.principal.id,
        input.target.connection.credentialFingerprint,
        input.target.dataProviderId,
      ]
    );
    const binding = result.rows.length === 1 ? result.rows[0] : undefined;
    if (!binding || `${binding.id}:${binding.last_observed_at}` !== input.target.bindingVersion) {
      throw new Error('content_transfer_target_binding_changed');
    }
    return input.execute();
  });
