import {
  listPermissionsInternal,
  listRolesInternal,
} from './roles-handlers.js';
import { createRoleInternal } from './roles-handlers.create.js';
import { deleteRoleInternal } from './roles-handlers.delete.js';
import { updateRoleInternal } from './roles-handlers.update.js';
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
