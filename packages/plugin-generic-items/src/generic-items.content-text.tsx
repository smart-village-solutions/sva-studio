import { Button, Input, RichTextHtmlEditor, StudioField, Textarea } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const ContentBlockBody = ({
  labels,
  index,
  value,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  value: string;
}>) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  const bodyLabelId = `generic-item-content-block-body-label-${index}`;
  return (
    <div className="space-y-1">
      <label
        id={bodyLabelId}
        htmlFor={`generic-item-content-block-body-${index}`}
        className="text-sm font-medium"
      >
        {labels.body}
      </label>
      <RichTextHtmlEditor
        id={`generic-item-content-block-body-${index}`}
        labelId={bodyLabelId}
        value={value}
        onChange={(nextValue) =>
          setValue(`contentBlocks.${index}.body`, nextValue, { shouldDirty: true })
        }
        blockTypeOptions={[
          { value: 'paragraph', label: labels.richTextParagraph },
          { value: 'heading-2', label: labels.richTextHeading2 },
          { value: 'heading-3', label: labels.richTextHeading3 },
          { value: 'blockquote', label: labels.richTextBlockquote },
        ]}
        toolbarLabels={{
          mode: labels.richTextMode,
          visualMode: labels.richTextVisualMode,
          htmlMode: labels.richTextHtmlMode,
          blockType: labels.richTextBlockType,
          bulletList: labels.richTextBulletList,
          orderedList: labels.richTextOrderedList,
          bold: labels.richTextBold,
          italic: labels.richTextItalic,
          underline: labels.richTextUnderline,
          clearFormatting: labels.richTextClearFormatting,
          undo: labels.richTextUndo,
          redo: labels.richTextRedo,
          link: labels.richTextApplyLink,
          linkPrompt: labels.richTextLinkInput,
        }}
      />
    </div>
  );
};

export const GenericItemsContentText = ({
  labels,
}: Readonly<{
  labels: Record<string, string>;
}>) => {
  const { control, setValue } = useFormContext<GenericItemsDetailFormValues>();
  const contentBlocksArray = useFieldArray({ control, name: 'contentBlocks' });
  const contentBlocks = useWatch({ control, name: 'contentBlocks' }) ?? [];
  return (
    <GenericItemsDetailCard title={labels.textTitle} description={labels.textDescription}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{labels.contentBlocks}</p>
            <p className="text-sm text-muted-foreground">{labels.contentBlocksHelp}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              contentBlocksArray.append({ title: '', intro: '', body: '', mediaContents: [] })
            }
          >
            {labels.addContentBlock}
          </Button>
        </div>
        {contentBlocks.map((contentBlock, index) => (
          <div
            key={contentBlocksArray.fields[index]?.id ?? `fallback-content-block-${index}`}
            className="space-y-4 rounded-xl border border-border/60 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{labels.contentBlockItem}</p>
              {contentBlocks.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => contentBlocksArray.remove(index)}
                >
                  {labels.remove}
                </Button>
              ) : null}
            </div>
            <StudioField id={`generic-item-content-block-title-${index}`} label={labels.title}>
              <Input
                id={`generic-item-content-block-title-${index}`}
                value={contentBlock.title}
                onChange={(event) =>
                  setValue(`contentBlocks.${index}.title`, event.target.value, {
                    shouldDirty: true,
                  })
                }
              />
            </StudioField>
            <StudioField id={`generic-item-content-block-intro-${index}`} label={labels.intro}>
              <Textarea
                id={`generic-item-content-block-intro-${index}`}
                value={contentBlock.intro}
                onChange={(event) =>
                  setValue(`contentBlocks.${index}.intro`, event.target.value, {
                    shouldDirty: true,
                  })
                }
              />
            </StudioField>
            <ContentBlockBody labels={labels} index={index} value={contentBlock.body} />
          </div>
        ))}
      </div>
    </GenericItemsDetailCard>
  );
};
