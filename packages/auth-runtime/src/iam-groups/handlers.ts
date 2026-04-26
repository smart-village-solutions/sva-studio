import { randomUUID } from 'node:crypto';

import { createGroupMutationHandlers, createGroupReadHandlers } from '@sva/iam-admin';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { jsonResponse } from '../db.js';
import { isUuid } from '../shared/input-readers.js';
import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  readPage,
  readPathSegment,
} from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import {
  emitActivityLog,
  requireRoles,
  resolveActorInfo,
  withInstanceScopedDb,
} from '../iam-account-management/shared.js';
import { publishGroupEvent } from './events.js';

const logger = createSdkLogger({ component: 'iam-groups', level: 'info' });

const groupReadHandlers = createGroupReadHandlers({
  asApiItem,
  asApiList,
  createApiError,
  getWorkspaceContext,
  isUuid,
  jsonResponse,
  logger,
  readPage,
  readPathSegment,
  requireRoles,
  resolveActorInfo,
  withInstanceScopedDb,
});

const groupMutationHandlers = createGroupMutationHandlers({
  asApiItem,
  createApiError,
  emitActivityLog,
  getWorkspaceContext,
  isUuid,
  jsonResponse,
  logger,
  parseRequestBody,
  publishGroupEvent,
  randomUUID,
  readPathSegment,
  requireRoles,
  resolveActorInfo,
  validateCsrf,
  withInstanceScopedDb,
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const { getGroupInternal, listGroupsInternal } = groupReadHandlers;
export const {
  assignGroupMembershipInternal,
  assignGroupRoleInternal,
  createGroupInternal,
  deleteGroupInternal,
  removeGroupMembershipInternal,
  removeGroupRoleInternal,
  updateGroupInternal,
} = groupMutationHandlers;
