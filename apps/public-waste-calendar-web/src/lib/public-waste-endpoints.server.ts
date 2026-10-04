import { type WasteManagementEmailReminderConfig } from '@sva/waste-management-contracts';
import {
  loadNextPublicWasteSelection,
  loadResolvedPublicWasteCalendar,
} from './public-waste-api.js';
import { projectPublicWasteRegions } from './public-waste-regions-api.js';
import {
  readPublicWasteReferenceDate,
  readPublicWasteResolvedSelection,
  readPublicWasteSelectionState,
} from './public-waste-request-parsing.server.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';
import { INVALID_REQUEST_MESSAGE, jsonResponse } from './public-waste-endpoints-shared.server.js';

export { handlePublicWasteReminderSignupRequest } from './public-waste-endpoints-reminders.server.js';
export { handlePublicWastePdfRequest } from './public-waste-endpoints-pdf.server.js';
export { handlePublicWasteIcalRequest } from './public-waste-endpoints-ical.server.js';

export const handlePublicWasteSelectionRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'listSelectionOptions'>;
  readonly request: Request;
}): Promise<Response> => {
  try {
    const url = new URL(input.request.url);
    const payload = await loadNextPublicWasteSelection({
      repository: input.repository,
      input: {
        selection: readPublicWasteSelectionState(url),
      },
    });

    return jsonResponse(payload);
  } catch {
    return jsonResponse({ error: 'invalid_request', message: INVALID_REQUEST_MESSAGE }, 400);
  }
};

export const handlePublicWasteLocationsRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'listPublicLocations'>;
}): Promise<Response> =>
  jsonResponse({
    items: await input.repository.listPublicLocations(),
  });

export const handlePublicWasteRegionsRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'listPublicRegions'>;
}): Promise<Response> =>
  jsonResponse(projectPublicWasteRegions(await input.repository.listPublicRegions()));

export const handlePublicWasteCalendarRequest = async (input: {
  readonly repository: Pick<
    PublicWasteRepository,
    'loadCalendarEntries' | 'loadSelectionSummary' | 'loadReminderOptions'
  >;
  readonly request: Request;
  readonly reminderConfig?: WasteManagementEmailReminderConfig;
}): Promise<Response> => {
  try {
    const url = new URL(input.request.url);
    const selection = readPublicWasteResolvedSelection(url);
    const [payload, selectionSummary, emailReminderFractions, calendarReminderFractions] =
      await Promise.all([
        loadResolvedPublicWasteCalendar({
          repository: input.repository,
          input: {
            selection,
            referenceDate: readPublicWasteReferenceDate(url),
          },
        }),
        input.repository.loadSelectionSummary({ selection }),
        input.reminderConfig?.enabled && input.reminderConfig.publicSignupEnabled
          ? input.repository.loadReminderOptions({ selection, channel: 'email' })
          : Promise.resolve([]),
        input.repository.loadReminderOptions({ selection, channel: 'calendar' }),
      ]);
    const baseIcalUrl = `/api/public-waste/ical?${new URLSearchParams({
      ...(selection.regionId ? { regionId: selection.regionId } : {}),
      cityId: selection.cityId,
      streetId: selection.streetId,
      ...(selection.houseNumberId ? { houseNumberId: selection.houseNumberId } : {}),
      calendarName: selectionSummary,
    }).toString()}`;

    return jsonResponse({
      ...payload,
      selectionSummary,
      ...(calendarReminderFractions.length > 0
        ? {
            calendarReminderOptions: {
              fractions: calendarReminderFractions,
            },
          }
        : {}),
      ...(input.reminderConfig?.enabled &&
      input.reminderConfig.publicSignupEnabled &&
      emailReminderFractions.length > 0
        ? {
            reminderSignup: {
              enabled: true,
              consentLabel: input.reminderConfig.consentLabel,
              privacyPolicyUrl: input.reminderConfig.privacyPolicyUrl,
              fractions: emailReminderFractions,
            },
          }
        : {}),
      icalUrl: baseIcalUrl,
    });
  } catch {
    return jsonResponse({ error: 'invalid_request', message: INVALID_REQUEST_MESSAGE }, 400);
  }
};
