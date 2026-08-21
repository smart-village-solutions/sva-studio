import type { AuthenticatedRequestContext } from '../middleware.js';
import type { MediaHttpHandlerDeps } from './http-support.js';
import { createContentSaveOperation } from './content-save-start-handler.js';
import { abandonContentSaveOperation } from './content-save-abandon-handler.js';
import {
  commitContentSaveOperation,
  markContentSaveOperationContentSaved,
  markContentSaveOperationOutcomeUnknown,
  markContentSaveOperationSavingContent,
  replaceContentSaveOperationReferences,
} from './content-save-command-handlers.js';

type HandlerImplementation = (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
) => Promise<Response>;

const bind =
  (deps: MediaHttpHandlerDeps, handler: HandlerImplementation) =>
  (request: Request, ctx: AuthenticatedRequestContext) =>
    handler(deps, request, ctx);

export const createMediaContentSaveHandlers = (deps: MediaHttpHandlerDeps) => ({
  createContentSaveOperation: bind(deps, createContentSaveOperation),
  replaceContentSaveOperationReferences: bind(deps, replaceContentSaveOperationReferences),
  markContentSaveOperationContentSaved: bind(deps, markContentSaveOperationContentSaved),
  markContentSaveOperationSavingContent: bind(deps, markContentSaveOperationSavingContent),
  markContentSaveOperationOutcomeUnknown: bind(deps, markContentSaveOperationOutcomeUnknown),
  commitContentSaveOperation: bind(deps, commitContentSaveOperation),
  abandonContentSaveOperation: bind(deps, abandonContentSaveOperation),
});
