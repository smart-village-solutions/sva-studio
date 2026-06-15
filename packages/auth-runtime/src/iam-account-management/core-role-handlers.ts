import {
  createRoleInternal,
  listPermissionsInternal,
  deleteRoleInternal,
  listRolesInternal,
  updateRoleInternal,
} from './roles-handlers.js';
import { reconcilePlaceholderInternal } from './reconcile-handler.js';
import { withAuthenticatedIamHandler } from './core-shared.js';

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
