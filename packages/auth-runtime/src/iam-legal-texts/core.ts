import { createLegalTextHttpHandlers } from '@sva/iam-governance/legal-text-http-handlers';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { asApiList, createApiError } from '../iam-account-management/api-helpers.js';
import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { withAuthenticatedUser } from '../middleware.js';
import { createLegalTextResponse, deleteLegalTextResponse, updateLegalTextResponse } from './mutations.js';
import { loadLegalTextListItems, loadPendingLegalTexts } from './repository.js';
import {
  resolveLegalTextsAdminActor,
  withAuthenticatedLegalTextsHandler,
  withLegalTextsRequestContext,
} from './request-context.js';

const logger = createSdkLogger({ component: 'iam-legal-texts', level: 'info' });

const legalTextHttpHandlers = createLegalTextHttpHandlers<AuthenticatedRequestContext>({
  resolveAdminActor: resolveLegalTextsAdminActor,
  getRequestId: () => getWorkspaceContext().requestId,
  asApiList,
  createApiError: (status, code, message, requestId) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId),
  jsonResponse,
  loadLegalTextListItems,
  loadPendingLegalTexts,
  createLegalTextResponse,
  updateLegalTextResponse,
  deleteLegalTextResponse,
  logError: (message, fields) => logger.error(message, fields),
});

export const listLegalTextsInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => legalTextHttpHandlers.listLegalTexts(request, ctx);

export const createLegalTextInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => legalTextHttpHandlers.createLegalText(request, ctx);

export const updateLegalTextInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => legalTextHttpHandlers.updateLegalText(request, ctx);

export const deleteLegalTextInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => legalTextHttpHandlers.deleteLegalText(request, ctx);

export const listLegalTextsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, listLegalTextsInternal);

export const listPendingLegalTextsHandler = async (request: Request): Promise<Response> =>
  withLegalTextsRequestContext(request, async () =>
    withAuthenticatedUser(request, async ({ user }) => legalTextHttpHandlers.listPendingLegalTexts(user))
  );

export const createLegalTextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, createLegalTextInternal);

export const updateLegalTextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, updateLegalTextInternal);

export const deleteLegalTextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, deleteLegalTextInternal);
