import { randomUUID } from 'node:crypto';

import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.js';
import { emitAuthAuditEvent } from '../audit-events.js';
import { createUnavailableMediaStoragePort } from './storage-port.js';
import { withMediaService } from './repository.js';
import { createConfiguredMediaStoragePortForInstance } from './storage-s3.js';
import { authorizeMediaPrimitiveForUser } from './server-authorization.js';
import { scheduleMediaContentSaveRecovery } from './content-save-recovery.js';
import { createMediaContentSaveHandlers } from './content-save-handlers.js';
import { createMediaReferenceHandlers } from './reference-handlers.js';
import { createMediaUploadHandlers } from './upload-handlers.js';
import { createMediaLibraryHandlers } from './library-handlers.js';
import type { MediaHttpHandlerDeps } from './http-support.js';

export const createMediaHttpHandlers = (deps: MediaHttpHandlerDeps) => ({
  ...createMediaLibraryHandlers(deps),
  ...createMediaUploadHandlers(deps),
  ...createMediaContentSaveHandlers(deps),
  ...createMediaReferenceHandlers(deps),
});

const mediaHttpHandlers = createMediaHttpHandlers({
  withMediaService,
  storagePort: createUnavailableMediaStoragePort(),
  resolveStoragePort: async (instanceId) =>
    await createConfiguredMediaStoragePortForInstance(instanceId),
  authorizeAction: authorizeMediaPrimitiveForUser,
  createId: () => randomUUID(),
  now: () => new Date().toISOString(),
  emitAuditEvent: emitAuthAuditEvent,
  scheduleContentSaveRecovery: scheduleMediaContentSaveRecovery,
});

const withMediaRequest = async (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> => withAuthenticatedUser(request, async (ctx) => handler(request, ctx));

export const listMediaHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.listMedia);

export const getMediaHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.getMedia);

export const getMediaUsageHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.getMediaUsage);

export const initializeMediaUploadHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.initializeUpload);

export const registerBucketMediaHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.registerBucketMedia);

export const updateMediaHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.updateMedia);

export const completeMediaUploadHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.completeUpload);

export const createMediaContentSaveOperationHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.createContentSaveOperation);

export const replaceMediaContentSaveOperationReferencesHandler = async (
  request: Request
): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.replaceContentSaveOperationReferences);

export const markMediaContentSaveOperationContentSavedHandler = async (
  request: Request
): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.markContentSaveOperationContentSaved);

export const markMediaContentSaveOperationSavingContentHandler = async (
  request: Request
): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.markContentSaveOperationSavingContent);

export const markMediaContentSaveOperationOutcomeUnknownHandler = async (
  request: Request
): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.markContentSaveOperationOutcomeUnknown);

export const commitMediaContentSaveOperationHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.commitContentSaveOperation);

export const abandonMediaContentSaveOperationHandler = async (
  request: Request
): Promise<Response> => withMediaRequest(request, mediaHttpHandlers.abandonContentSaveOperation);

export const replaceMediaReferencesHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.replaceReferences);

export const listMediaReferencesHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.listReferences);

export const getMediaDeliveryHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.getMediaDelivery);

export const deleteMediaHandler = async (request: Request): Promise<Response> =>
  withMediaRequest(request, mediaHttpHandlers.deleteMedia);
