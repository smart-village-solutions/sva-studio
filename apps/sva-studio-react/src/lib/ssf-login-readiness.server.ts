import { readConfiguredPluginTenantAccess } from '@sva/auth-runtime/server';
import {
  hasReadySsfAuthorizationProjectionSubjects,
  readReadySsfAuthorizationRevision,
  resolveSsfDatabasePool,
} from '@sva/plugin-ssf/runtime';

import { ensurePluginActivationPoliciesConfigured } from './plugin-activation-policy-bootstrap.server.js';
import { readStudioSsfLoginBaselineReadiness } from './ssf-authorization-projection-runtime.server.js';

/** Read-only live verification shared by directory publication and runtime access. */
export const readStudioSsfLoginReadiness = async (
  instanceId: string,
  expectedRevision?: string
): Promise<boolean> => {
  await ensurePluginActivationPoliciesConfigured();
  const access = await readConfiguredPluginTenantAccess(instanceId, 'ssf');
  if (!access.allowed || access.reason !== 'ready') return false;
  const pool = resolveSsfDatabasePool();
  if (!pool) return false;
  const revision = await readReadySsfAuthorizationRevision(pool, instanceId);
  if (!revision || (expectedRevision !== undefined && revision !== expectedRevision)) return false;
  if (!(await readStudioSsfLoginBaselineReadiness(instanceId))) return false;
  // Reconciliation may have started while the baseline and clients were being read.
  return (await readReadySsfAuthorizationRevision(pool, instanceId)) === revision;
};

/** Directory eligibility adds a persisted subject check without querying Keycloak. */
export const readStudioSsfAdminLoginReadiness = async (instanceId: string): Promise<boolean> => {
  if (!(await readStudioSsfLoginReadiness(instanceId))) return false;
  const pool = resolveSsfDatabasePool();
  return pool ? hasReadySsfAuthorizationProjectionSubjects(pool, instanceId) : false;
};
