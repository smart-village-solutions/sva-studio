import { createProfileCommands, type ProfileUpdatePayload } from '@sva/iam-admin';

import { jitProvisionAccountWithClient } from '../jit-provisioning.js';

import {
  emitActivityLog,
  logger,
  resolveActorAccountId,
  withInstanceScopedDb,
} from './shared.js';
import { resolveUserDetail } from './user-detail-query.js';

export type { ProfileUpdatePayload };

export const { loadMyProfileDetail, updateMyProfileDetail } = createProfileCommands({
  emitActivityLog,
  jitProvisionAccountWithClient,
  logger,
  resolveActorAccountId,
  resolveUserDetail,
  withInstanceScopedDb,
});
