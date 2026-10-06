import { bulkDeactivateInternal } from './user-bulk-deactivate-handler.js';
import { bulkReprovisionMainserverInternal } from './user-bulk-reprovision-mainserver-handler.js';
import { createUserInternal } from './user-create-handler.js';
import { deactivateUserInternal } from './user-deactivate-handler.js';
import { deleteUserInternal } from './user-delete-handler.js';
import { syncUsersFromKeycloakInternal } from './user-import-sync-handler.js';
import { sendPasswordSetupEmailInternal } from './user-password-setup-email-handler.js';
import {
  getTenantInvitationTemplateInternal,
  updateTenantInvitationTemplateInternal,
} from './tenant-invitation-template-handler.js';
import { reprovisionMainserverUserInternal } from './user-reprovision-mainserver-handler.js';
import { getMyProfileInternal, updateMyProfileInternal } from './profile-handlers.js';
import { reconcilePlaceholderInternal } from './reconcile-handler.js';
import {
  listKeycloakRolesInternal,
  listPermissionsInternal,
  listRolesInternal,
} from './roles-handlers.js';
import { createRoleInternal } from './roles-handlers.create.js';
import { deleteRoleInternal } from './roles-handlers.delete.js';
import { updateRoleInternal } from './roles-handlers.update.js';
import {
  getUserInternal,
  getUserTimelineInternal,
  listUsersInternal,
} from './user-read-handlers.js';
import { updateUserInternal } from './user-update-handler.js';
import {
  getUserKeycloakRolesInternal,
  mutateUserKeycloakRoleInternal,
} from './user-keycloak-role-handlers.js';
import { withAuthenticatedIamHandler } from './core-shared.js';

export const listUsersHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, listUsersInternal, {
    personalBearerRoute: { method: 'GET', path: '/api/v1/iam/users' },
  });

export const getUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, getUserInternal, {
    personalBearerRoute: { method: 'GET', path: '/api/v1/iam/users/$userId' },
  });

export const getUserTimelineHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, getUserTimelineInternal);

export const getUserKeycloakRolesHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, getUserKeycloakRolesInternal);

export const mutateUserKeycloakRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, mutateUserKeycloakRoleInternal);

export const createUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, createUserInternal, {
    personalBearerRoute: { method: 'POST', path: '/api/v1/iam/users' },
  });

export const sendPasswordSetupEmailHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, sendPasswordSetupEmailInternal, {
    personalBearerRoute: { method: 'POST', path: '/api/v1/iam/users/$userId/send-password-setup-email' },
  });

export const getTenantInvitationTemplateHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, getTenantInvitationTemplateInternal);

export const updateTenantInvitationTemplateHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, updateTenantInvitationTemplateInternal);

export const reprovisionMainserverUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, reprovisionMainserverUserInternal);

export const updateUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, updateUserInternal, {
    personalBearerRoute: { method: 'PATCH', path: '/api/v1/iam/users/$userId' },
  });

export const deactivateUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, deactivateUserInternal, {
    personalBearerRoute: { method: 'POST', path: '/api/v1/iam/users/$userId/deactivate' },
  });

export const deleteUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, deleteUserInternal, {
    personalBearerRoute: { method: 'DELETE', path: '/api/v1/iam/users/$userId' },
  });

export const bulkDeactivateUsersHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, bulkDeactivateInternal);

export const bulkReprovisionMainserverUsersHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, bulkReprovisionMainserverInternal);

export const syncUsersFromKeycloakHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, syncUsersFromKeycloakInternal);

export const updateMyProfileHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, updateMyProfileInternal);

export const getMyProfileHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, getMyProfileInternal);

export const listRolesHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, listRolesInternal, {
    personalBearerRoute: { method: 'GET', path: '/api/v1/iam/roles' },
  });

export const listKeycloakRolesHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, listKeycloakRolesInternal);

export const listPermissionsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, listPermissionsInternal);

export const createRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, createRoleInternal, {
    personalBearerRoute: { method: 'POST', path: '/api/v1/iam/roles' },
  });

export const updateRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, updateRoleInternal, {
    personalBearerRoute: { method: 'PATCH', path: '/api/v1/iam/roles/$roleId' },
  });

export const deleteRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, deleteRoleInternal, {
    personalBearerRoute: { method: 'DELETE', path: '/api/v1/iam/roles/$roleId' },
  });

export const reconcileHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, reconcilePlaceholderInternal);
