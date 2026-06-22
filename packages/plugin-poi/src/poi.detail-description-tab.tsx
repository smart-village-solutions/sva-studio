import { Input, RichTextHtmlEditor, StudioField } from '@sva/studio-ui-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';

export function PoiDetailDescriptionTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const { control, setValue } = useFormContext<PoiDetailFormValues>();
  const name = useWatch({ control, name: 'name' }) ?? '';
  const description = useWatch({ control, name: 'content.description' }) ?? '';
  const descriptionLabelId = 'poi-description-label';
  const blockTypeOptions = [
    { value: 'paragraph' as const, label: pt('richText.paragraph') },
    { value: 'heading-2' as const, label: pt('richText.heading2') },
    { value: 'heading-3' as const, label: pt('richText.heading3') },
    { value: 'heading-4' as const, label: pt('richText.heading4') },
    { value: 'blockquote' as const, label: pt('richText.blockquote') },
  ];

  return (
    <PoiDetailSectionCard title={pt('cards.description.text.title')} description={pt('cards.description.text.description')}>
      <StudioField id="poi-content-name" label={pt('fields.name')}>
        <Input id="poi-content-name" value={name} readOnly />
      </StudioField>
      <div className="space-y-1">
        <label id={descriptionLabelId} htmlFor="poi-description" className="text-sm font-medium">
          {pt('fields.description')}
        </label>
        <RichTextHtmlEditor
          id="poi-description"
          labelId={descriptionLabelId}
          value={description}
          onChange={(nextValue) => setValue('content.description', nextValue, { shouldDirty: true })}
          blockTypeOptions={blockTypeOptions}
          toolbarLabels={{
            blockType: pt('richText.blockType'),
            bulletList: pt('richText.bulletList'),
            orderedList: pt('richText.orderedList'),
            bold: pt('richText.bold'),
            italic: pt('richText.italic'),
            undo: pt('richText.undo'),
            redo: pt('richText.redo'),
            link: pt('richText.applyLink'),
            linkPrompt: pt('richText.linkInput'),
          }}
        />
      </div>
    </PoiDetailSectionCard>
  );
}
