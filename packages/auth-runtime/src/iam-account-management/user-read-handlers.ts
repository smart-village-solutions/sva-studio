import { createUserReadHandlers } from '@sva/iam-admin';

import { jsonResponse } from '../db.js';
import { readString } from '../shared/input-readers.js';

import { asApiItem, asApiList, createApiError, readPage } from './api-helpers.js';
import { listPlatformUsersInternal } from './platform-iam-handlers.js';
import { consumeRateLimit } from './rate-limit.js';
import { resolveTenantKeycloakUsersWithPagination } from './tenant-keycloak-users.js';
import {
  createDatabaseApiError,
  logUserProjectionDegraded,
  readValidatedUserId,
  resolveUserReadAccess,
} from './user-read-shared.js';
import {
  logger,
  withInstanceScopedDb,
} from './shared.js';
import { resolveUserDetail } from './user-detail-query.js';
import {
  applyCanonicalUserDetailProjection,
  applyCanonicalUserListProjection,
  resolveKeycloakRoleNames,
  resolveProjectedMainserverCredentialState,
} from './user-projection.js';
import { resolveUserTimeline } from './user-timeline-query.js';

export const {
  getUserInternal,
  getUserTimelineInternal,
  listUsersInternal,
} = createUserReadHandlers({
  applyCanonicalUserDetailProjection,
  applyCanonicalUserListProjection,
  asApiItem,
  asApiList,
  consumeRateLimit,
  createApiError,
  createDatabaseApiError,
  jsonResponse,
  listPlatformUsersInternal,
  logUserProjectionDegraded,
  logger,
  readPage,
  readString,
  readValidatedUserId,
  resolveKeycloakRoleNames,
  resolveProjectedMainserverCredentialState,
  resolveTenantKeycloakUsersWithPagination,
  resolveUserDetail,
  resolveUserReadAccess,
  resolveUserTimeline,
  withInstanceScopedDb,
});
