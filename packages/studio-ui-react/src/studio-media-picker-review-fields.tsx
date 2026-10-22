import * as React from 'react';
import { Textarea } from './textarea.js';
import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import { mediaMetadataLimits } from '@sva/media';
import { Input } from './input.js';
import {
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerMetadataField,
  type StudioMediaPickerOverlayLabels,
} from './studio-media-picker-overlay.shared.js';

const metadataFieldDefinitions: readonly Readonly<{
  key: StudioMediaPickerMetadataField;
  id: string;
  multiline?: boolean;
}>[] = [
  { key: 'title', id: 'studio-media-review-title' },
  { key: 'altText', id: 'studio-media-review-alt-text' },
  { key: 'description', id: 'studio-media-review-description', multiline: true },
  { key: 'copyright', id: 'studio-media-review-copyright' },
  { key: 'license', id: 'studio-media-review-license' },
];

export const defaultStudioMediaPickerMetadataFields = metadataFieldDefinitions.map(
  ({ key }) => key
);

export const StudioMediaPickerReviewFields = ({
  isMetadataEditable,
  labels,
  metadataDraft,
  onMetadataChange,
  visibleMetadataFields,
}: Readonly<{
  isMetadataEditable: boolean;
  labels: Pick<StudioMediaPickerOverlayLabels, 'fields'>;
  metadataDraft: StudioMediaPickerMetadataDraft;
  onMetadataChange: (key: StudioMediaPickerMetadataField, value: string) => void;
  visibleMetadataFields: readonly StudioMediaPickerMetadataField[];
}>) => (
  <div className="space-y-4">
    {metadataFieldDefinitions
      .filter(({ key }) => visibleMetadataFields.includes(key))
      .map(({ id, key, multiline }) => {
        const Field = multiline ? Textarea : Input;
        return (
          <div className="space-y-2" key={key}>
            <label className="text-sm font-medium text-foreground" htmlFor={id}>
              {labels.fields[key]}
            </label>
            <Field
              disabled={!isMetadataEditable}
              id={id}
              value={metadataDraft[key]}
              maxLength={mediaMetadataLimits[key]}
              onChange={(event) => onMetadataChange(key, event.target.value)}
            />
          </div>
        );
      })}
  </div>
);

export const CentralMetadataFields = ({
  draft,
  tags,
  canEdit,
  isSaving,
  onChange,
  onTagsChange,
}: Readonly<{
  draft: StudioMediaPickerMetadataDraft;
  tags: string;
  canEdit: boolean;
  isSaving: boolean;
  onChange: (key: StudioMediaPickerMetadataField, value: string) => void;
  onTagsChange: (value: string) => void;
}>) => {
  const t = useContentMediaTranslation();
  const tagsId = React.useId();
  return (
    <>
      <StudioMediaPickerReviewFields
        isMetadataEditable={canEdit && !isSaving}
        labels={{
          fields: {
            title: t('fields.title'),
            altText: t('fields.altText'),
            description: t('fields.description'),
            copyright: t('fields.copyright'),
            license: t('fields.license'),
          },
        }}
        metadataDraft={draft}
        onMetadataChange={onChange}
        visibleMetadataFields={defaultStudioMediaPickerMetadataFields}
      />
      <div className="space-y-2">
        <label htmlFor={tagsId} className="text-sm font-medium">
          {t('fields.tags')}
        </label>
        <Textarea
          id={tagsId}
          value={tags}
          disabled={!canEdit || isSaving}
          aria-describedby={`${tagsId}-hint`}
          onChange={(event) => onTagsChange(event.target.value)}
        />
        <p id={`${tagsId}-hint`} className="text-sm text-muted-foreground">
          {t('fields.tagsHint')}
        </p>
      </div>
    </>
  );
};
