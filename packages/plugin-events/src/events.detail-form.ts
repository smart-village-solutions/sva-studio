import type { EventContentItem, EventFormInput } from './events.types.js';

export type EventsDetailFormValues = Readonly<{
  title: string;
  basis: {
    categoryName: string;
  };
  content: {
    description: string;
    dates: EventFormInput['dates'];
    addresses: EventFormInput['addresses'];
    contact: NonNullable<EventFormInput['contact']>;
    urls: EventFormInput['urls'];
    pointOfInterestId: string;
    repeat: boolean;
    recurring: string;
    recurringType: string;
    recurringInterval: string;
    recurringWeekdays: readonly string[];
  };
  settings: {
    headerImageAssetId: string;
  };
}>;

const createDefaultDate = () => ({ dateStart: '', dateEnd: '', timeStart: '', timeEnd: '' });
const createDefaultAddress = () => ({ street: '', zip: '', city: '' });
const createDefaultContact = () => ({ firstName: '', lastName: '', phone: '', email: '' });
const createDefaultUrl = () => ({ url: '', description: '' });

export const createDefaultEventsDetailFormValues = (): EventsDetailFormValues => ({
  title: '',
  basis: {
    categoryName: '',
  },
  content: {
    description: '',
    dates: [createDefaultDate()],
    addresses: [createDefaultAddress()],
    contact: createDefaultContact(),
    urls: [createDefaultUrl()],
    pointOfInterestId: '',
    repeat: false,
    recurring: '',
    recurringType: '',
    recurringInterval: '',
    recurringWeekdays: [],
  },
  settings: {
    headerImageAssetId: '',
  },
});

export const mapEventItemToDetailFormValues = (item: EventContentItem): EventsDetailFormValues => ({
  title: item.title,
  basis: {
    categoryName: item.categoryName ?? '',
  },
  content: {
    description: item.description ?? '',
    dates: item.dates?.length ? item.dates : [createDefaultDate()],
    addresses: item.addresses?.length ? item.addresses : [createDefaultAddress()],
    contact: item.contact ?? item.contacts?.[0] ?? createDefaultContact(),
    urls: item.urls?.length ? item.urls : [createDefaultUrl()],
    pointOfInterestId: item.pointOfInterestId ?? '',
    repeat: item.repeat ?? false,
    recurring: item.recurring ?? '',
    recurringType: item.recurringType ?? '',
    recurringInterval: item.recurringInterval ?? '',
    recurringWeekdays: item.recurringWeekdays ?? [],
  },
  settings: {
    headerImageAssetId: '',
  },
});

const compactString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export const mapEventsDetailFormValuesToInput = (values: EventsDetailFormValues): EventFormInput => {
  const firstContact = values.content.contact;

  return {
    title: values.title.trim(),
    ...(compactString(values.content.description) ? { description: compactString(values.content.description) } : {}),
    ...(compactString(values.basis.categoryName) ? { categoryName: compactString(values.basis.categoryName) } : {}),
    dates: (values.content.dates ?? [])
      .map((entry) => ({
        ...(compactString(entry?.dateStart) ? { dateStart: entry?.dateStart } : {}),
        ...(compactString(entry?.dateEnd) ? { dateEnd: entry?.dateEnd } : {}),
        ...(compactString(entry?.timeStart) ? { timeStart: entry?.timeStart } : {}),
        ...(compactString(entry?.timeEnd) ? { timeEnd: entry?.timeEnd } : {}),
        ...(compactString(entry?.timeDescription) ? { timeDescription: compactString(entry?.timeDescription) } : {}),
      }))
      .filter((entry) => Object.keys(entry).length > 0),
    addresses: (values.content.addresses ?? [])
      .map((entry) => ({
        ...(compactString(entry?.street) ? { street: compactString(entry?.street) } : {}),
        ...(compactString(entry?.zip) ? { zip: compactString(entry?.zip) } : {}),
        ...(compactString(entry?.city) ? { city: compactString(entry?.city) } : {}),
      }))
      .filter((entry) => Object.keys(entry).length > 0),
    ...(compactString(firstContact.firstName) ||
    compactString(firstContact.lastName) ||
    compactString(firstContact.phone) ||
    compactString(firstContact.email)
      ? { contact: firstContact }
      : {}),
    urls: (values.content.urls ?? [])
      .map((entry) => ({
        ...(compactString(entry?.url) ? { url: compactString(entry?.url) as string } : {}),
        ...(compactString(entry?.description) ? { description: compactString(entry?.description) } : {}),
      }))
      .filter((entry): entry is { url: string; description?: string } => Boolean(entry.url)),
    ...(compactString(values.content.pointOfInterestId)
      ? { pointOfInterestId: compactString(values.content.pointOfInterestId) }
      : {}),
    repeat: values.content.repeat,
    ...(compactString(values.content.recurring) ? { recurring: compactString(values.content.recurring) } : {}),
    ...(compactString(values.content.recurringType)
      ? { recurringType: compactString(values.content.recurringType) }
      : {}),
    ...(compactString(values.content.recurringInterval)
      ? { recurringInterval: compactString(values.content.recurringInterval) }
      : {}),
    recurringWeekdays: (values.content.recurringWeekdays ?? []).map((entry) => entry.trim()).filter(Boolean),
  };
};
