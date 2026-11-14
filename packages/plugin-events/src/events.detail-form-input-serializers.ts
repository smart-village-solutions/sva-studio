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

/**
 * Whether a price carries source values without editor fields. `groupPrice: false` is the
 * Mainserver default and alone carries no information.
 */
export const hasPriceSourceValues = (entry: EventPriceInformation): boolean =>
  entry.groupPrice === true ||
  PRICE_PASSTHROUGH_NUMBERS.some((key) => compactFiniteNumber(entry[key]) !== undefined);

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

// A row is kept while it has visible values or source values. Clearing the visible fields removes
// a plain row; a row with source values is removed explicitly in the editor.
export const serializeEventPrices = (prices: readonly EventPriceInformation[] | undefined | null) =>
  (prices ?? []).flatMap((entry) => {
    const visible = serializeVisiblePrice(entry);
    return Object.keys(visible).length > 0 || hasPriceSourceValues(entry)
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

/**
 * The Mainserver reads weekdays as offsets from Monday (`'0'` Monday to `'6'` Sunday) and converts
 * them with `to_i`, so the editor keeps them as unique, numerically sorted offset strings.
 */
export const normalizeWeekdayOffsets = (weekdays: readonly string[] | undefined): string[] =>
  [...new Set((weekdays ?? []).map((entry) => entry.trim()).filter(Boolean))].sort(
    (left, right) => Number(left) - Number(right)
  );

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
  recurringWeekdays: normalizeWeekdayOffsets(basis.recurringWeekdays),
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
