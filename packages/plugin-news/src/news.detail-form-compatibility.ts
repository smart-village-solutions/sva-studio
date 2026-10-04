import { createNewsEditorFormValues } from './news.editor-model.js';
import { syncPublicationModeFromPublishedAt } from './news.detail-form-schema.js';
import {
  createEmptyCompatibilityTouched,
  createEmptyLegacySnapshot,
  defaultContentBlock,
  emptyWebUrl,
  type CompatibilityFormValues,
  type MutableLegacyCompatibilitySnapshot,
} from './news.detail-form-compatibility-types.js';
import type {
  NewsContentBlockFormValue,
  NewsContentItem,
  NewsDetailCompatibilityField,
  NewsDetailEditorialFormValues,
  NewsDetailFormValues,
} from './news.types.js';

export const ensureLegacySnapshot = (
  values: NewsDetailEditorialFormValues
): MutableLegacyCompatibilitySnapshot => {
  if (!values.__legacySnapshot) {
    values.__legacySnapshot = createEmptyLegacySnapshot();
  }

  return values.__legacySnapshot as MutableLegacyCompatibilitySnapshot;
};

export const ensureCompatibilityTouched = (values: NewsDetailEditorialFormValues) => {
  if (!values.__compatibilityTouched) {
    values.__compatibilityTouched = createEmptyCompatibilityTouched();
  }

  return values.__compatibilityTouched;
};

const toCompatibilityContentBlocks = (
  values: NewsDetailEditorialFormValues
): NewsContentBlockFormValue[] => [
  {
    title: values.title,
    intro: values.contentIntro,
    body: values.contentBody,
    mediaContents: values.contentMedia,
  },
];

const buildCompatibilityContentBlocks = (
  values: NewsDetailEditorialFormValues
): NewsContentBlockFormValue[] => {
  const { legacyContentBlocks = [] } = ensureLegacySnapshot(values);
  const [, ...remainingBlocks] = legacyContentBlocks;

  return [toCompatibilityContentBlocks(values)[0], ...remainingBlocks];
};

const defineCompatibilityAlias = <TValue>(
  values: CompatibilityFormValues,
  editorialValues: NewsDetailEditorialFormValues,
  key: NewsDetailCompatibilityField,
  getValue: () => TValue,
  setValue: (nextValue: TValue) => void
) => {
  if (Object.prototype.hasOwnProperty.call(values, key)) {
    return;
  }

  Object.defineProperty(values, key, {
    configurable: true,
    enumerable: true,
    get: getValue,
    set: (nextValue: TValue) => {
      ensureCompatibilityTouched(editorialValues)[key] = true;
      setValue(nextValue);
    },
  });
};

const defineCompatibilityMetadataAliases = (
  compatibilityValues: CompatibilityFormValues,
  values: NewsDetailEditorialFormValues
) => {
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'keywords',
    () => ensureLegacySnapshot(values).keywords ?? '',
    (nextValue) => {
      ensureLegacySnapshot(values).keywords = nextValue;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'externalId',
    () => ensureLegacySnapshot(values).externalId ?? '',
    (nextValue) => {
      ensureLegacySnapshot(values).externalId = nextValue;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'newsType',
    () => ensureLegacySnapshot(values).newsType ?? '',
    (nextValue) => {
      ensureLegacySnapshot(values).newsType = nextValue;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'charactersToBeShown',
    () => {
      const currentValue = ensureLegacySnapshot(values).charactersToBeShown;
      return currentValue === undefined ? '' : String(currentValue);
    },
    (nextValue) => {
      ensureLegacySnapshot(values).charactersToBeShown = nextValue;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'fullVersion',
    () => ensureLegacySnapshot(values).fullVersion ?? false,
    (nextValue) => {
      ensureLegacySnapshot(values).fullVersion = nextValue;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'showPublishDate',
    () => ensureLegacySnapshot(values).showPublishDate ?? true,
    (nextValue) => {
      ensureLegacySnapshot(values).showPublishDate = nextValue;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'pushNotification',
    () => values.pushNotificationEnabled,
    (nextValue) => {
      values.pushNotificationEnabled = nextValue;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'pointOfInterestId',
    () => ensureLegacySnapshot(values).pointOfInterestId ?? '',
    (nextValue) => {
      ensureLegacySnapshot(values).pointOfInterestId = nextValue;
    }
  );
};

const defineCompatibilityContentAliases = (
  compatibilityValues: CompatibilityFormValues,
  values: NewsDetailEditorialFormValues
) => {
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'address',
    () =>
      ensureLegacySnapshot(values).address ?? {
        street: '',
        zip: '',
        city: '',
      },
    (nextValue) => {
      ensureLegacySnapshot(values).address = nextValue ?? {};
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'contentBlocks',
    () => buildCompatibilityContentBlocks(values),
    (nextValue) => {
      const firstBlock = nextValue?.[0] ?? defaultContentBlock();
      ensureLegacySnapshot(values).legacyContentBlocks = nextValue;
      values.title = firstBlock.title || values.title;
      values.contentIntro = firstBlock.intro;
      values.contentBody = firstBlock.body;
      values.contentMedia = firstBlock.mediaContents;
    }
  );
};

const defineCompatibilityPublicationAliases = (
  compatibilityValues: CompatibilityFormValues,
  values: NewsDetailEditorialFormValues
) => {
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'publishedAt',
    () => {
      const snapshot = ensureLegacySnapshot(values);
      if (values.publicationMode === 'scheduled') {
        return values.scheduledPublicationAt;
      }

      return snapshot.publishedAt ?? '';
    },
    (nextValue) => {
      ensureLegacySnapshot(values).publishedAt = nextValue;
      syncPublicationModeFromPublishedAt(values, nextValue);
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'publicationDate',
    () => ensureLegacySnapshot(values).publicationDate ?? '',
    (nextValue) => {
      ensureLegacySnapshot(values).publicationDate = nextValue;
    }
  );
};

const attachLegacyCompatibilityAliases = (
  values: NewsDetailEditorialFormValues
): NewsDetailFormValues => {
  const compatibilityValues = values as CompatibilityFormValues;

  defineCompatibilityMetadataAliases(compatibilityValues, values);
  defineCompatibilityContentAliases(compatibilityValues, values);
  defineCompatibilityPublicationAliases(compatibilityValues, values);

  return compatibilityValues;
};
export const createDefaultNewsDetailFormValues = (): NewsDetailFormValues =>
  attachLegacyCompatibilityAliases({
    title: '',
    author: '',
    categories: [],
    contentIntro: '',
    contentBody: '',
    contentMedia: [],
    sourceUrl: emptyWebUrl(),
    sourceUrlDescription: '',
    pushNotificationEnabled: false,
    wasteLocationKeys: [],
    publicationMode: 'draft',
    scheduledPublicationAt: '',
    __legacySnapshot: createEmptyLegacySnapshot(),
    __compatibilityTouched: createEmptyCompatibilityTouched(),
  });

export const mapNewsItemToDetailFormValues = (item: NewsContentItem): NewsDetailFormValues =>
  attachLegacyCompatibilityAliases(createNewsEditorFormValues(item));
