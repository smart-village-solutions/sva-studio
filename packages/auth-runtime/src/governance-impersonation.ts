import { createGovernanceWorkflowExecutor } from '@sva/iam-governance';
import { createSdkLogger } from '@sva/server-runtime';

import { withInstanceDb } from './db.js';
import { buildLogContext } from './log-context.js';
import { isUuid } from './shared/input-readers.js';

const logger = createSdkLogger({ component: 'iam-governance', level: 'info' });

const governanceWorkflowExecutor = createGovernanceWorkflowExecutor({
  isUuid,
  logInfo: (message, fields) => logger.info(message, fields),
  logWarn: (message, fields) => logger.warn(message, fields),
  buildLogContext: (instanceId?: string) => buildLogContext(instanceId, { includeTraceId: true }),
});

export const resolveImpersonationSubject = async (input: {
  instanceId: string;
  actorKeycloakSubject: string;
  targetKeycloakSubject: string;
}): Promise<{ ok: true } | { ok: false; reasonCode: string }> =>
  governanceWorkflowExecutor.resolveImpersonationSubject({
    ...input,
    withInstanceScopedDb: withInstanceDb,
  });
