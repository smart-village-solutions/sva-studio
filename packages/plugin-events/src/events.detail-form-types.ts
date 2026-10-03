import type {
  EventAccessibilityInformation,
  EventAddress,
  EventContact,
  EventFormInput,
  EventMediaContent,
  EventOrganizer,
  EventPriceInformation,
} from './events.types.js';

export type EventsFormGeoLocationValue = Readonly<{
  latitude: string;
  longitude: string;
}>;

export type EventAddressFormValue = Omit<EventAddress, 'geoLocation'> &
  Readonly<{
    geoLocation?: EventsFormGeoLocationValue;
  }>;

export type EventOrganizerFormValue = Omit<EventOrganizer, 'address'> &
  Readonly<{
    address?: EventAddressFormValue;
  }>;

export type EventMediaContentFormValue = Omit<EventMediaContent, 'height' | 'sourceUrl' | 'width'> &
  Readonly<{
    height: string;
    width: string;
    sourceUrl: { url: string; description: string };
  }>;

export type EventsDetailFormValues = Readonly<{
  title: string;
  basis: {
    categories: string[];
    pointOfInterestId: string;
    repeat: boolean;
    recurring: string;
    recurringType: string;
    recurringInterval: string;
    recurringWeekdays: readonly string[];
  };
  content: {
    description: string;
    dates: EventFormInput['dates'];
    addresses: readonly EventAddressFormValue[];
    urls: EventFormInput['urls'];
    mediaContents: readonly EventMediaContentFormValue[];
    contacts: readonly EventContact[];
    organizer: EventOrganizerFormValue;
    priceInformations: readonly EventPriceInformation[];
    accessibilityInformation: EventAccessibilityInformation;
  };
  settings: {
    visible: boolean;
    externalId: string;
    keywords: string;
    tags: string;
  };
}>;
