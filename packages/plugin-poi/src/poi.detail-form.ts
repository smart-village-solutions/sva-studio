import type { PoiContentItem, PoiFormInput } from './poi.types.js';

export type PoiDetailFormValues = Readonly<{
  name: string;
  basis: {
    categoryName: string;
    active: boolean;
  };
  content: {
    description: string;
    mobileDescription: string;
    addresses: PoiFormInput['addresses'];
    contact: NonNullable<PoiFormInput['contact']>;
    openingHours: PoiFormInput['openingHours'];
    webUrls: PoiFormInput['webUrls'];
    payloadText: string;
  };
  settings: {
    teaserImageAssetId: string;
  };
}>;

const createDefaultAddress = () => ({ street: '', zip: '', city: '' });
const createDefaultContact = () => ({ firstName: '', lastName: '', phone: '', email: '' });
const createDefaultOpeningHour = () => ({ weekday: '', timeFrom: '', timeTo: '', open: true, description: '' });
const createDefaultWebUrl = () => ({ url: '', description: '' });

export const createDefaultPoiDetailFormValues = (): PoiDetailFormValues => ({
  name: '',
  basis: {
    categoryName: '',
    active: true,
  },
  content: {
    description: '',
    mobileDescription: '',
    addresses: [createDefaultAddress()],
    contact: createDefaultContact(),
    openingHours: [createDefaultOpeningHour()],
    webUrls: [createDefaultWebUrl()],
    payloadText: '{}',
  },
  settings: {
    teaserImageAssetId: '',
  },
});

export const mapPoiItemToDetailFormValues = (item: PoiContentItem): PoiDetailFormValues => ({
  name: item.name,
  basis: {
    categoryName: item.categoryName ?? '',
    active: item.active !== false,
  },
  content: {
    description: item.description ?? '',
    mobileDescription: item.mobileDescription ?? '',
    addresses: item.addresses?.length ? item.addresses : [createDefaultAddress()],
    contact: item.contact ?? createDefaultContact(),
    openingHours: item.openingHours?.length ? item.openingHours : [createDefaultOpeningHour()],
    webUrls: item.webUrls?.length ? item.webUrls : [createDefaultWebUrl()],
    payloadText: JSON.stringify(item.payload ?? {}, null, 2),
  },
  settings: {
    teaserImageAssetId: '',
  },
});

export const parsePoiPayloadText = (payloadText: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(payloadText) as unknown;
    return parsed !== null && typeof parsed === 'object' && Array.isArray(parsed) === false
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const compactString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export const mapPoiDetailFormValuesToInput = (
  values: PoiDetailFormValues,
  payload: Record<string, unknown>
): PoiFormInput => {
  const firstContact = values.content.contact;

  return {
    name: values.name.trim(),
    ...(compactString(values.content.description) ? { description: compactString(values.content.description) } : {}),
    ...(compactString(values.content.mobileDescription)
      ? { mobileDescription: compactString(values.content.mobileDescription) }
      : {}),
    active: values.basis.active,
    ...(compactString(values.basis.categoryName) ? { categoryName: compactString(values.basis.categoryName) } : {}),
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
    openingHours: (values.content.openingHours ?? [])
      .map((entry) => ({
        ...(compactString(entry?.weekday) ? { weekday: compactString(entry?.weekday) } : {}),
        ...(compactString(entry?.timeFrom) ? { timeFrom: compactString(entry?.timeFrom) } : {}),
        ...(compactString(entry?.timeTo) ? { timeTo: compactString(entry?.timeTo) } : {}),
        ...(entry?.open !== undefined ? { open: entry.open } : {}),
        ...(compactString(entry?.description) ? { description: compactString(entry?.description) } : {}),
      }))
      .filter((entry) => Object.keys(entry).length > 0),
    webUrls: (values.content.webUrls ?? [])
      .map((entry) => ({
        ...(compactString(entry?.url) ? { url: compactString(entry?.url) as string } : {}),
        ...(compactString(entry?.description) ? { description: compactString(entry?.description) } : {}),
      }))
      .filter((entry): entry is { url: string; description?: string } => Boolean(entry.url)),
    ...(Object.keys(payload).length > 0 ? { payload } : {}),
  };
};
