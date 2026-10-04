import { asApiItem, createApiError, parseRequestBody } from '@sva/server-runtime';
import { wasteManagementOperationsContract } from '@sva/waste-management-contracts';
import { authorizeWasteManagementAction, getAuthorizedWasteManagementInstanceId } from './auth.js';
import { validateCsrf } from './host-controls.js';
import { wasteManagementOperationSchemas } from '../http-operation-schemas.js';
import { getRequestId, requireDeps } from './utils.js';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';

const { previewLocationTourPickupDateImportSchema } = wasteManagementOperationSchemas;

const requirePreview = (deps: WasteManagementHandlerDeps) => {
  if (!deps.previewWasteLocationTourPickupDateImport) {
    throw new Error('missing_preview_waste_location_tour_pickup_date_import');
  }
  return deps.previewWasteLocationTourPickupDateImport;
};

const isPreviewInputError = (message: string): boolean =>
  message.startsWith('unsupported_blob_ref:') ||
  message.startsWith('invalid_blob_ref:') ||
  message.startsWith('unsupported_import_source_format:') ||
  message.startsWith('ambiguous_regionless_city_match:');

const toPreviewErrorResponse = (error: unknown, requestId: string | undefined): Response => {
  const message =
    error instanceof Error ? error.message : 'Die Importvorschau konnte nicht erstellt werden.';
  if (isPreviewInputError(message)) {
    if (message.startsWith('ambiguous_regionless_city_match:')) {
      const cityName = message.slice('ambiguous_regionless_city_match:'.length) || 'unbekannt';
      return createApiError(
        400,
        'invalid_request',
        `Die Region muss angegeben werden, weil der Stadtname mehrdeutig ist: ${cityName}.`,
        requestId
      );
    }
    return createApiError(400, 'invalid_request', message, requestId);
  }

  return createApiError(
    503,
    'database_unavailable',
    'Die Importvorschau konnte nicht erstellt werden.',
    requestId
  );
};

export const wasteManagementImportSourceHandlers = {
  uploadWasteManagementImportSourceInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(
      ctx,
      'waste-management.import.execute',
      deps,
      requestId
    );
    if (authError) return authError;
    const csrfError = validateCsrf(deps, request, requestId);
    if (csrfError) return csrfError;

    const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim() ?? '';
    if (!wasteManagementOperationsContract.isImportSourceFormat(contentType)) {
      return createApiError(400, 'invalid_request', 'Unbekanntes Waste-Importformat.', requestId);
    }
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (
      Number.isFinite(contentLength) &&
      contentLength > wasteManagementOperationsContract.importUploadMaxBytes
    ) {
      return createApiError(413, 'invalid_request', 'Importdatei ist zu groß.', requestId);
    }
    const body = new Uint8Array(await request.arrayBuffer());
    if (body.byteLength === 0) {
      return createApiError(400, 'invalid_request', 'Importdatei ist leer.', requestId);
    }
    if (body.byteLength > wasteManagementOperationsContract.importUploadMaxBytes) {
      return createApiError(413, 'invalid_request', 'Importdatei ist zu groß.', requestId);
    }
    const instanceId = getAuthorizedWasteManagementInstanceId(ctx);
    const blobRef = await requireDeps(
      deps.storeWasteImportSource,
      'storeWasteImportSource'
    )({
      instanceId,
      body,
      contentType,
    });
    return new Response(
      JSON.stringify(asApiItem({ blobRef, sizeBytes: body.byteLength }, requestId)),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
  previewWasteManagementLocationTourPickupDateImportInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(
      ctx,
      'waste-management.import.execute',
      deps,
      requestId
    );
    if (authError) {
      return authError;
    }

    const csrfError = validateCsrf(deps, request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const instanceId = getAuthorizedWasteManagementInstanceId(ctx);
    const parsed = await parseRequestBody(request, previewLocationTourPickupDateImportSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const preview = await requirePreview(deps)({
        instanceId,
        sourceFormat: parsed.data.sourceFormat,
        blobRef: parsed.data.blobRef,
        delimiterOverride: parsed.data.delimiterOverride,
      });
      return new Response(JSON.stringify(asApiItem(preview, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return toPreviewErrorResponse(error, requestId);
    }
  },
};
