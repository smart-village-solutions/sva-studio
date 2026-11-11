import type {
  EventAccessibilityInformation,
  EventContact,
  EventPriceInformation,
} from './events.types.js';
import {
  compactEventString,
  serializeEventWebUrls,
} from './events.detail-form-serialization-common.js';
import { compactFiniteNumber } from './events.detail-form-structured-serializers.js';

type SerializableBasis = Readonly<{
  categories?: readonly string[];
  pointOfInterestId?: string | null;
  repeat: boolean;
  recurring?: string | null;
  recurringType?: string | null;
  recurringInterval?: string | null;
  recurringWeekdays?: readonly string[];
}>;

type SerializableSettings = Readonly<{
  visible: boolean;
  externalId?: string | null;
  keywords?: string | null;
  tags?: string | null;
}>;

export const serializeEventContacts = (contacts: readonly EventContact[] | undefined | null) =>
  (contacts ?? [])
    .map((entry) => ({
      ...(compactEventString(entry.firstName)
        ? { firstName: compactEventString(entry.firstName) }
        : {}),
      ...(compactEventString(entry.lastName)
        ? { lastName: compactEventString(entry.lastName) }
        : {}),
      ...(compactEventString(entry.phone) ? { phone: compactEventString(entry.phone) } : {}),
      ...(compactEventString(entry.fax) ? { fax: compactEventString(entry.fax) } : {}),
      ...(compactEventString(entry.email) ? { email: compactEventString(entry.email) } : {}),
      ...(serializeEventWebUrls(entry.webUrls).length > 0
        ? { webUrls: serializeEventWebUrls(entry.webUrls) }
        : {}),
    }))
    .filter((entry) => Object.keys(entry).length > 0);

const PRICE_PASSTHROUGH_NUMBERS = [
  'ageFrom',
  'ageTo',
  'minAdultCount',
  'maxAdultCount',
  'minChildrenCount',
  'maxChildrenCount',
] as const;

// Price attributes without editor fields come from the loaded event and are sent back unchanged.
const serializePricePassthrough = (entry: EventPriceInformation) => ({
  ...(typeof entry.groupPrice === 'boolean' ? { groupPrice: entry.groupPrice } : {}),
  ...Object.fromEntries(
    PRICE_PASSTHROUGH_NUMBERS.map((key) => [key, compactFiniteNumber(entry[key])] as const).filter(
      ([, value]) => value !== undefined
    )
  ),
});

const serializeVisiblePrice = (entry: EventPriceInformation) => ({
  ...(compactEventString(entry.name) ? { name: compactEventString(entry.name) } : {}),
  ...(entry.amount !== undefined && Number.isFinite(entry.amount) ? { amount: entry.amount } : {}),
  ...(compactEventString(entry.description)
    ? { description: compactEventString(entry.description) }
    : {}),
  ...(compactEventString(entry.category) ? { category: compactEventString(entry.category) } : {}),
});

// Whether a row is kept depends on the visible fields only; an emptied row is removed even if it
// still carries passthrough attributes.
export const serializeEventPrices = (prices: readonly EventPriceInformation[] | undefined | null) =>
  (prices ?? []).flatMap((entry) => {
    const visible = serializeVisiblePrice(entry);
    return Object.keys(visible).length > 0
      ? [{ ...visible, ...serializePricePassthrough(entry) }]
      : [];
  });

/**
 * The editor always sends both values so it can set and clear them: an empty limit becomes
 * `null`, any other input stays a number so validation can reject non-integers. Values the
 * form does not hold are omitted, which keeps the stored Mainserver values.
 */
export const serializeEventParticipation = (
  content: Readonly<{ registrationRequired?: boolean; maximumAttendees?: string }>
) => {
  const limit = compactEventString(content.maximumAttendees);
  return {
    ...(typeof content.registrationRequired === 'boolean'
      ? { registrationRequired: content.registrationRequired }
      : {}),
    ...(typeof content.maximumAttendees === 'string'
      ? { maximumAttendees: limit === undefined ? null : Number(limit) }
      : {}),
  };
};

export const serializeEventAccessibility = (value: EventAccessibilityInformation) => ({
  ...(compactEventString(value.description)
    ? { description: compactEventString(value.description) }
    : {}),
  ...(compactEventString(value.types) ? { types: compactEventString(value.types) } : {}),
  ...(serializeEventWebUrls(value.urls).length > 0
    ? { urls: serializeEventWebUrls(value.urls) }
    : {}),
});

const serializeEventCategories = (categories: readonly string[] | undefined) =>
  (categories ?? []).length > 0
    ? {
        categoryName: categories?.[0]?.trim(),
        categories: Array.from(
          new Set((categories ?? []).map((entry) => entry.trim()).filter(Boolean))
        ).map((name) => ({
          name,
        })),
      }
    : undefined;

export const serializeEventBasis = (basis: SerializableBasis) => ({
  ...(serializeEventCategories(basis.categories) ?? {}),
  ...(compactEventString(basis.pointOfInterestId)
    ? { pointOfInterestId: compactEventString(basis.pointOfInterestId) }
    : {}),
  repeat: basis.repeat,
  ...(compactEventString(basis.recurring)
    ? { recurring: compactEventString(basis.recurring) }
    : {}),
  ...(compactEventString(basis.recurringType)
    ? { recurringType: compactEventString(basis.recurringType) }
    : {}),
  ...(compactEventString(basis.recurringInterval)
    ? { recurringInterval: compactEventString(basis.recurringInterval) }
    : {}),
  recurringWeekdays: (basis.recurringWeekdays ?? []).map((entry) => entry.trim()).filter(Boolean),
});

export const serializeEventSettings = (settings: SerializableSettings) => ({
  ...(compactEventString(settings.externalId)
    ? { externalId: compactEventString(settings.externalId) }
    : {}),
  ...(compactEventString(settings.keywords)
    ? { keywords: compactEventString(settings.keywords) }
    : {}),
  ...(compactEventString(settings.tags)
    ? {
        tags: settings.tags
          ?.split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      }
    : {}),
  visible: settings.visible,
});
