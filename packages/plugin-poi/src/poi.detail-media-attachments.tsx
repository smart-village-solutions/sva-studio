import { Button, MediaReferenceField } from '@sva/studio-ui-react';
import { Controller, type FieldArrayWithId, useFormContext } from 'react-hook-form';

import type { PoiDetailFormValues } from './poi.detail-form.js';

export function PoiDetailMediaAttachments({
  fields,
  mediaOptions,
  onAppend,
  onRemove,
  pt,
}: Readonly<{
  fields: readonly FieldArrayWithId<PoiDetailFormValues, 'media.attachments', 'id'>[];
  mediaOptions: readonly { assetId: string; label: string }[];
  onAppend: () => void;
  onRemove: (index: number) => void;
  pt: (key: string) => string;
}>) {
  const { control } = useFormContext<PoiDetailFormValues>();

  return (
    <>
      {fields.map((field, index) => (
        <div key={field.id} className="rounded-xl border border-border/60 p-4">
          <Controller
            name={`media.attachments.${index}.assetId`}
            control={control}
            render={({ field: mediaField }) => (
              <MediaReferenceField
                id={`poi-attachment-id-${index}`}
                label={pt('fields.attachmentAsset')}
                value={mediaField.value || null}
                options={mediaOptions}
                onChange={(assetId) => mediaField.onChange(assetId ?? '')}
                placeholder={pt('fields.mediaPlaceholder')}
                clearLabel={pt('actions.clearMedia')}
              />
            )}
          />
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" onClick={() => onRemove(index)}>
              {pt('actions.remove')}
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={onAppend}>
        {pt('actions.add')}
      </Button>
    </>
  );
}
