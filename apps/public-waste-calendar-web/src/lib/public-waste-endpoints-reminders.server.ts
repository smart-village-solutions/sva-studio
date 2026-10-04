import { type WasteManagementEmailReminderConfig } from '@sva/waste-management-contracts';
import { PublicWasteReminderSignupError } from '../server/public-waste-email-reminders.server.js';
import type {
  PublicWasteReminderSignupRequest,
  PublicWasteReminderSignupResponse,
} from './public-waste-contract.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';
import { INVALID_REQUEST_MESSAGE, jsonResponse } from './public-waste-endpoints-shared.server.js';

const REMINDER_SIGNUP_NOT_READY_MESSAGE =
  'Der E-Mail-Erinnerungsdienst ist derzeit nicht verfügbar.';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isReminderItem = (
  item: unknown
): item is PublicWasteReminderSignupRequest['items'][number] => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return false;
  }

  const next = item as Record<string, unknown>;
  return (
    typeof next.fractionId === 'string' &&
    next.fractionId.length > 0 &&
    typeof next.slotId === 'string' &&
    next.slotId.length > 0
  );
};

const isPublicWasteReminderSignupRequest = (
  value: unknown
): value is PublicWasteReminderSignupRequest => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.email !== 'string' || !EMAIL_PATTERN.test(record.email.trim())) {
    return false;
  }
  if (
    record.consentAccepted !== true ||
    !Array.isArray(record.items) ||
    record.items.length === 0
  ) {
    return false;
  }
  if (
    !record.selection ||
    typeof record.selection !== 'object' ||
    Array.isArray(record.selection)
  ) {
    return false;
  }

  return record.items.every(isReminderItem);
};

export const handlePublicWasteReminderSignupRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadReminderOptions' | 'loadSelectionSummary'>;
  readonly request: Request;
  readonly reminderConfig?: WasteManagementEmailReminderConfig;
  readonly submitReminderSignup?: (input: {
    readonly request: Request;
    readonly payload: PublicWasteReminderSignupRequest;
    readonly reminderConfig: WasteManagementEmailReminderConfig;
    readonly repository: Pick<PublicWasteRepository, 'loadSelectionSummary'>;
  }) => Promise<PublicWasteReminderSignupResponse>;
}): Promise<Response> => {
  try {
    if (!input.reminderConfig?.enabled || !input.reminderConfig.publicSignupEnabled) {
      return new Response(REMINDER_SIGNUP_NOT_READY_MESSAGE, { status: 404 });
    }

    const payload = (await input.request.json()) as unknown;
    if (!isPublicWasteReminderSignupRequest(payload)) {
      return new Response(INVALID_REQUEST_MESSAGE, { status: 400 });
    }

    const allowedFractions = await input.repository.loadReminderOptions({
      selection: payload.selection,
      channel: 'email',
    });
    const allowedFractionMap = new Map(allowedFractions.map((fraction) => [fraction.id, fraction]));
    const hasInvalidItem = payload.items.some((item) => {
      const fraction = allowedFractionMap.get(item.fractionId);
      return !fraction || !fraction.slots.some((slot) => slot.id === item.slotId);
    });

    if (hasInvalidItem) {
      return new Response(INVALID_REQUEST_MESSAGE, { status: 400 });
    }

    if (!input.submitReminderSignup) {
      return new Response(REMINDER_SIGNUP_NOT_READY_MESSAGE, { status: 501 });
    }

    return jsonResponse(
      await input.submitReminderSignup({
        request: input.request,
        payload,
        reminderConfig: input.reminderConfig,
        repository: input.repository,
      })
    );
  } catch (error) {
    if (error instanceof PublicWasteReminderSignupError) {
      return new Response(error.message, {
        status: error.status,
        headers: error.retryAfterSeconds
          ? {
              'retry-after': String(error.retryAfterSeconds),
            }
          : undefined,
      });
    }
    return new Response(INVALID_REQUEST_MESSAGE, { status: 400 });
  }
};
