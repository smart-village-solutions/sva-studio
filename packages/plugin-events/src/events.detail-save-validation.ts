import type { Dispatch, SetStateAction } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { contentMediaUsagesToMainserver, type ContentMediaUsage } from '@sva/studio-ui-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  mapEventsDetailFormValuesToInput,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import { hasEventOrganizerContent } from './events.detail-form-structured-serializers.js';
import { hasInvalidFormGeoLocation, validateEventForm } from './events.validation.js';
import type { EventsDetailTabId } from './events.detail-tabs.js';
import type { EventsStatusMessage } from './events.detail-save.js';

export const validateEventsDetailSubmission = ({
  values,
  mediaUsages,
  methods,
  pt,
  setStatus,
  setActiveTab,
  setPendingFocusId,
}: Readonly<{
  values: EventsDetailFormValues;
  mediaUsages: readonly ContentMediaUsage[];
  methods: UseFormReturn<EventsDetailFormValues>;
  pt: ReturnType<typeof usePluginTranslation>;
  setStatus: Dispatch<SetStateAction<EventsStatusMessage | null>>;
  setActiveTab: Dispatch<SetStateAction<EventsDetailTabId>>;
  setPendingFocusId: Dispatch<SetStateAction<string | null>>;
}>): boolean => {
  const valuesWithMedia = {
    ...values,
    content: {
      ...values.content,
      mediaContents: contentMediaUsagesToMainserver(
        mediaUsages.filter((usage) => !usage.localDraft)
      ) as EventsDetailFormValues['content']['mediaContents'],
    },
  };
  const payload = mapEventsDetailFormValuesToInput(valuesWithMedia);
  const invalidAddressIndex = valuesWithMedia.content.addresses.findIndex((address) =>
    hasInvalidFormGeoLocation(address.geoLocation)
  );
  const invalidOrganizerGeoLocation = hasInvalidFormGeoLocation(
    valuesWithMedia.content.organizer.address?.geoLocation
  );
  const organizerNameMissing =
    hasEventOrganizerContent(valuesWithMedia.content.organizer) &&
    (valuesWithMedia.content.organizer.name ?? '').trim().length === 0;
  const validationErrors = [
    ...new Set([
      ...validateEventForm(payload),
      ...(invalidAddressIndex >= 0 || invalidOrganizerGeoLocation ? ['geoLocation'] : []),
      ...(organizerNameMissing ? ['organizerName'] : []),
    ]),
  ];

  if (validationErrors.length > 0) {
    setStatus({ kind: 'error', text: pt('messages.validationError') });
    focusInvalidEventField({
      validationErrors,
      invalidAddressIndex,
      invalidOrganizerGeoLocation,
      methods,
      setActiveTab,
      setPendingFocusId,
    });
    return false;
  }

  return true;
};

const focusInvalidEventField = ({
  validationErrors,
  invalidAddressIndex,
  invalidOrganizerGeoLocation,
  methods,
  setActiveTab,
  setPendingFocusId,
}: Readonly<{
  validationErrors: readonly string[];
  invalidAddressIndex: number;
  invalidOrganizerGeoLocation: boolean;
  methods: UseFormReturn<EventsDetailFormValues>;
  setActiveTab: Dispatch<SetStateAction<EventsDetailTabId>>;
  setPendingFocusId: Dispatch<SetStateAction<string | null>>;
}>) => {
  if (validationErrors.includes('dates')) {
    methods.setFocus('content.dates.0.dateStart');
    setActiveTab('content');
  } else if (validationErrors.includes('geoLocation')) {
    if (invalidAddressIndex >= 0) {
      methods.setError(`content.addresses.${invalidAddressIndex}.geoLocation.latitude`, {
        type: 'manual',
        message: 'geoLocation',
      });
      methods.setError(`content.addresses.${invalidAddressIndex}.geoLocation.longitude`, {
        type: 'manual',
        message: 'geoLocation',
      });
      setPendingFocusId(
        invalidAddressIndex === 0
          ? 'event-address-latitude'
          : `event-address-latitude-${invalidAddressIndex}`
      );
    }
    if (invalidOrganizerGeoLocation) {
      methods.setError('content.organizer.address.geoLocation.latitude', {
        type: 'manual',
        message: 'geoLocation',
      });
      methods.setError('content.organizer.address.geoLocation.longitude', {
        type: 'manual',
        message: 'geoLocation',
      });
      setPendingFocusId('event-organizer-latitude');
    }
    setActiveTab('content');
  } else if (validationErrors.includes('categories')) {
    setActiveTab('basis');
  } else if (validationErrors.includes('title')) {
    methods.setFocus('title');
    setActiveTab('basis');
  } else if (validationErrors.includes('organizerName')) {
    methods.setError('content.organizer.name', {
      type: 'manual',
      message: 'organizerName',
    });
    setActiveTab('content');
    setPendingFocusId('event-organizer-name');
  } else if (validationErrors.includes('urls')) {
    methods.setFocus('content.urls.0.url');
    setActiveTab('content');
  }
};

export const createEventsDeviationFieldLabels = (
  pt: ReturnType<typeof usePluginTranslation>
): Readonly<Record<string, string>> => ({
  title: pt('fields.title'),
  description: pt('fields.description'),
  categories: pt('fields.categories'),
  category: pt('fields.categoryName'),
  dates: pt('fields.dateStart'),
  listDate: pt('fields.dateStart'),
  sortDate: pt('fields.dateStart'),
  repeat: pt('fields.repeat'),
  repeatDuration: pt('fields.repeat'),
  recurring: pt('fields.repeat'),
  recurringType: pt('fields.recurringType'),
  recurringInterval: pt('fields.recurringInterval'),
  recurringWeekdays: pt('fields.recurringWeekdays'),
  addresses: pt('fields.street'),
  location: pt('fields.addressAddition'),
  contacts: pt('fields.contact'),
  urls: pt('fields.url'),
  mediaContents: pt('fields.mediaContents'),
  organizer: pt('fields.organizerName'),
  priceInformations: pt('fields.priceAmount'),
  accessibilityInformation: pt('fields.accessibilityDescription'),
  externalId: pt('fields.externalId'),
  keywords: pt('fields.keywords'),
  tags: pt('fields.tags'),
  visible: pt('fields.visible'),
  createdAt: pt('fields.createdAt'),
  updatedAt: pt('fields.updatedAt'),
});
