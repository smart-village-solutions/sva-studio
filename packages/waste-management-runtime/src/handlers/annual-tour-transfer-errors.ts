import {
  wasteAnnualTourTransferLimits,
  WasteAnnualTourTransferError,
  type WasteAnnualTourTransferPreview,
} from '@sva/waste-management-contracts';
import { createApiError } from '@sva/server-runtime';

const validationErrorResponse = (
  error: WasteAnnualTourTransferError,
  requestId: string | undefined
): Response => {
  if (error.code === 'batch_limit_exceeded') {
    return createApiError(
      413,
      error.code,
      `Der Jahreswechsel überschreitet die Grenze von ${wasteAnnualTourTransferLimits.tours.toLocaleString('de-DE')} Touren oder ${wasteAnnualTourTransferLimits.relationships.toLocaleString('de-DE')} kopierrelevanten Beziehungen.`,
      requestId
    );
  }
  const message =
    error.code === 'first_target_date_invalid'
      ? 'Der erste reguläre Termin muss zu einer Tour gehören und im Folgejahr liegen.'
      : error.code === 'invalid_source_year'
        ? 'Als Quelljahr sind nur das aktuelle und das vorherige Kalenderjahr zulässig.'
        : error.replacement
          ? `Das Ersatzdatum muss im Kalenderjahr ${error.replacement.expectedYear} liegen.`
          : 'Das Ersatzdatum ist für die aktuelle Planung nicht gültig.';
  return createApiError(
    400,
    error.code === 'first_target_date_invalid' ? 'invalid_request' : error.code,
    message,
    requestId
  );
};

const updatedPreviewFromError = (
  message: string,
  prefix: string
): WasteAnnualTourTransferPreview | undefined => {
  try {
    return JSON.parse(message.slice(prefix.length)) as WasteAnnualTourTransferPreview;
  } catch {
    return undefined;
  }
};

export const toAnnualTourTransferDomainErrorResponse = (
  error: unknown,
  requestId: string | undefined
): Response | null => {
  if (error instanceof WasteAnnualTourTransferError) {
    return validationErrorResponse(error, requestId);
  }
  if (!(error instanceof Error)) return null;
  if (error.message.startsWith('preview_stale:')) {
    const updatedPreview = updatedPreviewFromError(error.message, 'preview_stale:');
    return createApiError(
      409,
      'preview_stale',
      'Die Tourplanung hat sich geändert. Bitte prüfen und bestätigen Sie die aktualisierte Vorschau.',
      requestId,
      updatedPreview ? { updatedPreview } : undefined
    );
  }
  if (error.message.startsWith('target_identity_conflict:')) {
    const updatedPreview = updatedPreviewFromError(error.message, 'target_identity_conflict:');
    return createApiError(
      409,
      'target_identity_conflict',
      'Ein vorhandenes Folgejahr-Ergebnis weicht von der bestätigten Planung ab.',
      requestId,
      updatedPreview ? { updatedPreview } : undefined
    );
  }
  if (error.message === 'unacknowledged_target_conflict') {
    return createApiError(
      409,
      'target_conflict_unacknowledged',
      'Eine mögliche parallele Planung muss vor der Übernahme ausdrücklich bestätigt werden.',
      requestId
    );
  }
  if (error.message === 'invalid_transfer_selection') {
    return createApiError(
      400,
      'invalid_request',
      'Die Auswahl enthält eine nicht übernehmbare Tour.',
      requestId
    );
  }
  return null;
};
