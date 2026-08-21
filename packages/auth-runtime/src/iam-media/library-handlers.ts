import type { AuthenticatedRequestContext } from '../middleware.js';
import { deleteMedia, updateMedia } from './asset-mutation-handlers.js';
import { getMedia, getMediaDelivery, getMediaUsage } from './asset-read-handlers.js';
import { registerBucketMedia } from './asset-registration-handler.js';
import type { MediaHttpHandlerDeps } from './http-support.js';
import { listMedia } from './library-list-handler.js';

export const createMediaLibraryHandlers = (deps: MediaHttpHandlerDeps) => ({
  listMedia: (request: Request, ctx: AuthenticatedRequestContext) =>
    listMedia(deps, request, ctx),
  getMedia: (request: Request, ctx: AuthenticatedRequestContext) =>
    getMedia(deps, request, ctx),
  getMediaUsage: (request: Request, ctx: AuthenticatedRequestContext) =>
    getMediaUsage(deps, request, ctx),
  registerBucketMedia: (request: Request, ctx: AuthenticatedRequestContext) =>
    registerBucketMedia(deps, request, ctx),
  updateMedia: (request: Request, ctx: AuthenticatedRequestContext) =>
    updateMedia(deps, request, ctx),
  getMediaDelivery: (request: Request, ctx: AuthenticatedRequestContext) =>
    getMediaDelivery(deps, request, ctx),
  deleteMedia: (request: Request, ctx: AuthenticatedRequestContext) =>
    deleteMedia(deps, request, ctx),
});
