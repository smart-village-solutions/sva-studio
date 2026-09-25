import { createSsfRuntimePluginServiceAccess } from '@sva/auth-runtime/server';
import {
  readReadySsfAuthorizationRevision,
  readSsfTenant,
  resolveSsfDatabasePool,
} from '@sva/plugin-ssf/runtime';

import { readStudioSsfLoginReadiness } from './ssf-login-readiness.server.js';

export const createStudioSsfRuntimeServiceAccess = () =>
  createSsfRuntimePluginServiceAccess({
    readLoginReadiness: readStudioSsfLoginReadiness,
    readDatabaseReadiness: async (instanceId) => {
      const pool = resolveSsfDatabasePool();
      return pool ? (await readSsfTenant(pool, instanceId)) !== null : false;
    },
    readAuthorizationRevision: async (instanceId) => {
      const pool = resolveSsfDatabasePool();
      return pool ? readReadySsfAuthorizationRevision(pool, instanceId) : null;
    },
  });
