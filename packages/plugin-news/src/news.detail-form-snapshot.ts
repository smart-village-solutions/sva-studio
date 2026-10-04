import { syncPublicationModeFromPublishedAt } from './news.detail-form-schema.js';
import {
  ensureLegacySnapshot,
  ensureCompatibilityTouched,
} from './news.detail-form-compatibility.js';
import type {
  CompatibilityFormValues,
  MutableLegacyCompatibilitySnapshot,
} from './news.detail-form-compatibility-types.js';
import type { NewsDetailEditorialFormValues, NewsDetailFormValues } from './news.types.js';

type StringCompatibilitySnapshotField =
  'keywords' | 'externalId' | 'newsType' | 'charactersToBeShown' | 'pointOfInterestId';

type BooleanCompatibilitySnapshotField = 'fullVersion' | 'showPublishDate';

const METADATA_STRING_COMPATIBILITY_FIELDS = [
  'keywords',
  'externalId',
  'newsType',
  'charactersToBeShown',
] as const satisfies readonly StringCompatibilitySnapshotField[];

const POINT_OF_INTEREST_COMPATIBILITY_FIELD = [
  'pointOfInterestId',
] as const satisfies readonly StringCompatibilitySnapshotField[];

const BOOLEAN_COMPATIBILITY_FIELDS = [
  'fullVersion',
  'showPublishDate',
] as const satisfies readonly BooleanCompatibilitySnapshotField[];

const syncStringCompatibilityFields = (
  compatibilityValues: CompatibilityFormValues,
  snapshot: MutableLegacyCompatibilitySnapshot,
  touched: NonNullable<NewsDetailEditorialFormValues['__compatibilityTouched']>,
  fields: readonly StringCompatibilitySnapshotField[]
) => {
  for (const field of fields) {
    const nextValue = compatibilityValues[field];
    if (touched[field] && typeof nextValue === 'string') {
      snapshot[field] = nextValue;
    }
  }
};

const syncBooleanCompatibilityFields = (
  compatibilityValues: CompatibilityFormValues,
  snapshot: MutableLegacyCompatibilitySnapshot,
  touched: NonNullable<NewsDetailEditorialFormValues['__compatibilityTouched']>
) => {
  for (const field of BOOLEAN_COMPATIBILITY_FIELDS) {
    const nextValue = compatibilityValues[field];
    if (touched[field] && typeof nextValue === 'boolean') {
      snapshot[field] = nextValue;
    }
  }
};

const syncPushNotificationCompatibilityValue = (
  values: NewsDetailFormValues,
  compatibilityValues: CompatibilityFormValues,
  touched: NonNullable<NewsDetailEditorialFormValues['__compatibilityTouched']>
) => {
  if (touched.pushNotification && typeof compatibilityValues.pushNotification === 'boolean') {
    values.pushNotificationEnabled = compatibilityValues.pushNotification;
  }
};

const syncPublishedAtCompatibilityValue = (
  values: NewsDetailFormValues,
  compatibilityValues: CompatibilityFormValues,
  snapshot: MutableLegacyCompatibilitySnapshot,
  touched: NonNullable<NewsDetailEditorialFormValues['__compatibilityTouched']>
) => {
  if (touched.publishedAt && typeof compatibilityValues.publishedAt === 'string') {
    snapshot.publishedAt = compatibilityValues.publishedAt;
    if (values.publicationMode === 'draft' && values.scheduledPublicationAt.trim().length === 0) {
      syncPublicationModeFromPublishedAt(values, compatibilityValues.publishedAt);
    }
  }
};

const syncPublicationDateCompatibilityValue = (
  compatibilityValues: CompatibilityFormValues,
  snapshot: MutableLegacyCompatibilitySnapshot,
  touched: NonNullable<NewsDetailEditorialFormValues['__compatibilityTouched']>
) => {
  if (touched.publicationDate && typeof compatibilityValues.publicationDate === 'string') {
    snapshot.publicationDate = compatibilityValues.publicationDate;
  }
};

const syncAddressCompatibilityValue = (
  compatibilityValues: CompatibilityFormValues,
  snapshot: MutableLegacyCompatibilitySnapshot,
  touched: NonNullable<NewsDetailEditorialFormValues['__compatibilityTouched']>
) => {
  if (
    touched.address &&
    compatibilityValues.address &&
    typeof compatibilityValues.address === 'object'
  ) {
    snapshot.address = compatibilityValues.address;
  }
};

const syncContentBlocksCompatibilityValue = (
  compatibilityValues: CompatibilityFormValues,
  snapshot: MutableLegacyCompatibilitySnapshot,
  touched: NonNullable<NewsDetailEditorialFormValues['__compatibilityTouched']>
) => {
  if (touched.contentBlocks && Array.isArray(compatibilityValues.contentBlocks)) {
    snapshot.legacyContentBlocks = compatibilityValues.contentBlocks;
  }
};

export const syncSnapshotFromCompatibilityValues = (values: NewsDetailFormValues) => {
  const compatibilityValues = values as CompatibilityFormValues;
  const snapshot = ensureLegacySnapshot(values);
  const touched = ensureCompatibilityTouched(values);

  syncStringCompatibilityFields(
    compatibilityValues,
    snapshot,
    touched,
    METADATA_STRING_COMPATIBILITY_FIELDS
  );
  syncBooleanCompatibilityFields(compatibilityValues, snapshot, touched);
  syncPushNotificationCompatibilityValue(values, compatibilityValues, touched);
  syncPublishedAtCompatibilityValue(values, compatibilityValues, snapshot, touched);
  syncPublicationDateCompatibilityValue(compatibilityValues, snapshot, touched);
  syncAddressCompatibilityValue(compatibilityValues, snapshot, touched);
  syncStringCompatibilityFields(
    compatibilityValues,
    snapshot,
    touched,
    POINT_OF_INTEREST_COMPATIBILITY_FIELD
  );
  syncContentBlocksCompatibilityValue(compatibilityValues, snapshot, touched);
};
