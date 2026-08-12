import type { FieldError } from 'react-hook-form';
import { getStudioFormFieldProps } from '@sva/studio-ui-react';

export type ContentFieldBindings = ReturnType<typeof getStudioFormFieldProps>;

export const collectSummaryErrors = (fields: readonly ContentFieldBindings[]) =>
  fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

export const translateFieldError = (
  error: FieldError | undefined,
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string
): FieldError | undefined => {
  if (!error || typeof error.message !== 'string') {
    return error;
  }

  return {
    ...error,
    message: pt(`validation.${error.message}`),
  };
};

export const readNestedFieldError = (value: unknown): FieldError | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return 'message' in value || 'type' in value ? (value as FieldError) : undefined;
};

type NewsTranslation = (
  key: string,
  variables?: Readonly<Record<string, string | number>>
) => string;

export const createNewsMediaUsageLabels = (pt: NewsTranslation) => ({
  title: pt('cards.content.media.title'),
  description: pt('cards.content.media.description'),
  empty: pt('cards.content.media.empty'),
  actions: {
    add: pt('messages.mediaPickerTitle'),
    remove: pt('actions.removeImage'),
    moveUp: pt('media.moveUp'),
    moveDown: pt('media.moveDown'),
    refreshMetadata: pt('media.refresh'),
    cancel: pt('actions.cancel'),
    apply: pt('media.apply'),
  },
  fields: {
    url: pt('fields.mediaUrl'),
    altText: pt('fields.mediaUrlDescription'),
    caption: pt('fields.mediaCaption'),
    credit: pt('fields.mediaCopyright'),
    license: pt('messages.mediaPickerLicense'),
  },
  states: {
    linked: pt('media.linked'),
    manual: pt('media.manual'),
    synced: pt('media.synced'),
    pending: pt('media.pending'),
    missing: pt('media.missing'),
    additional: pt('media.additional'),
    unresolved: pt('media.unresolved'),
    failed: pt('media.failed'),
    previewUnavailable: pt('media.previewUnavailable'),
  },
  announcements: { moved: pt('media.moved'), removed: pt('media.removed') },
  refresh: {
    title: pt('media.refreshTitle'),
    description: pt('media.refreshDescription'),
    assetValue: pt('media.assetValue'),
    contentValue: pt('media.contentValue'),
  },
});
