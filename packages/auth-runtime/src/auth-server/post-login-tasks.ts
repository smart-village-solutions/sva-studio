import { createSdkLogger } from '@sva/server-runtime';

import { withInstanceDb } from '../db.js';
import { jitProvisionAccount } from '../jit-provisioning.js';
import { notifyPermissionInvalidation } from '../iam-account-management/shared-activity.js';
import { buildLogContext } from '../log-context.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

export const runPostLoginTasks = async (instanceId: string | undefined, keycloakSubject: string) => {
  try {
    await jitProvisionAccount({ instanceId, keycloakSubject });
  } catch (error) {
    logger.error('JIT provisioning failed after callback', {
      operation: 'jit_provision',
      user_id: keycloakSubject,
      instance_id: instanceId,
      error: error instanceof Error ? error.message : String(error),
      ...buildLogContext(instanceId),
    });
  }

  if (!instanceId) {
    return;
  }

  try {
    await withInstanceDb(instanceId, (client) =>
      notifyPermissionInvalidation(client, {
        instanceId,
        keycloakSubject,
        trigger: 'user_login',
      })
    );
  } catch (error) {
    logger.error('Permission snapshot invalidation failed after callback', {
      operation: 'permission_invalidation',
      user_id: keycloakSubject,
      instance_id: instanceId,
      error: error instanceof Error ? error.message : String(error),
      ...buildLogContext(instanceId),
    });
  }
};
