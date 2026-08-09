import { Input } from './input.js';
import {
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerMetadataField,
  type StudioMediaPickerOverlayLabels,
} from './studio-media-picker-overlay.shared.js';
import { Textarea } from './textarea.js';

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
              onChange={(event) => onMetadataChange(key, event.target.value)}
            />
          </div>
        );
      })}
  </div>
);
