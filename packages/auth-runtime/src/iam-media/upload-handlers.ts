import type { AuthenticatedRequestContext } from '../middleware.js';
import type { MediaHttpHandlerDeps } from './http-support.js';
import { completeUpload } from './upload-completion-handler.js';
import { initializeUpload } from './upload-initialization-handler.js';

export const createMediaUploadHandlers = (deps: MediaHttpHandlerDeps) => ({
  initializeUpload: (request: Request, ctx: AuthenticatedRequestContext) =>
    initializeUpload(deps, request, ctx),
  completeUpload: (request: Request, ctx: AuthenticatedRequestContext) =>
    completeUpload(deps, request, ctx),
});
