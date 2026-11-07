import type { QueryClient } from './db.js';
import { readInstanceRegistryPluginTenantLifecycleRegistry } from './iam-instance-registry/plugin-activation-policy-snapshot.js';
import { enqueuePluginTenantLifecycleReconcile } from './plugin-operations/runner-queue.js';

/** Persist the existing lifecycle task in the same transaction as managed competence. */
export const enqueueSsfAuthorizationReconcileWithClient = async (
  client: QueryClient,
  instanceId: string
): Promise<void> => {
  const definition = readInstanceRegistryPluginTenantLifecycleRegistry().get('ssf');
  if (!definition?.operations.some(({ operation }) => operation === 'reconcile')) return;
  const active = await client.query<{ eligible: boolean }>(
    `SELECT EXISTS (
    SELECT 1 FROM iam.instances instance JOIN iam.instance_modules module ON module.instance_id = instance.id
    WHERE instance.id = $1 AND instance.status = 'active' AND module.module_id = 'ssf' AND module.effective_active = true
  ) AS eligible`,
    [instanceId]
  );
  if (active.rows[0]?.eligible !== true) return;
  await enqueuePluginTenantLifecycleReconcile(client, {
    instanceId,
    pluginId: 'ssf',
    runAt: new Date(),
  });
};
