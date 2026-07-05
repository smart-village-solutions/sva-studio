import { bulkDeactivateInternal } from './user-bulk-deactivate-handler.js';
import { createUserInternal } from './user-create-handler.js';
import { deactivateUserInternal } from './user-deactivate-handler.js';
import { deleteUserInternal } from './user-delete-handler.js';
import { syncUsersFromKeycloakInternal } from './user-import-sync-handler.js';
import { sendPasswordSetupEmailInternal } from './user-password-setup-email-handler.js';
import { getMyProfileInternal, updateMyProfileInternal } from './profile-handlers.js';
import { reconcilePlaceholderInternal } from './reconcile-handler.js';
import { listPermissionsInternal, listRolesInternal } from './roles-handlers.js';
import { createRoleInternal } from './roles-handlers.create.js';
import { deleteRoleInternal } from './roles-handlers.delete.js';
import { updateRoleInternal } from './roles-handlers.update.js';
import { getUserInternal, getUserTimelineInternal, listUsersInternal } from './user-read-handlers.js';
import { updateUserInternal } from './user-update-handler.js';
import { withAuthenticatedIamHandler } from './core-shared.js';

export const listUsersHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, listUsersInternal);

export const getUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, getUserInternal);

export const getUserTimelineHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, getUserTimelineInternal);

export const createUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, createUserInternal);

export const sendPasswordSetupEmailHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, sendPasswordSetupEmailInternal);

export const updateUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, updateUserInternal);

export const deactivateUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, deactivateUserInternal);

export const deleteUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, deleteUserInternal);

export const bulkDeactivateUsersHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, bulkDeactivateInternal);

export const syncUsersFromKeycloakHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, syncUsersFromKeycloakInternal);

export const updateMyProfileHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, updateMyProfileInternal);

export const getMyProfileHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, getMyProfileInternal);

export const listRolesHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, listRolesInternal);

export const listPermissionsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, listPermissionsInternal);

export const createRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, createRoleInternal);

export const updateRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, updateRoleInternal);

export const deleteRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, deleteRoleInternal);

export const reconcileHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, reconcilePlaceholderInternal);
