import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Select,
  StudioDetailCard,
  StudioField,
  RichTextHtmlEditor,
} from '@sva/studio-ui-react';
import { JobMediaFields } from './jobs.form-media.js';
import { jobFieldId, type JobFormProps } from './jobs.form.js';
import { Contacts } from './jobs.contact-fields.js';
import { CompanyFields } from './jobs.company-fields.js';
export { jobFieldId } from './jobs.form.js';
export { JobBasisFields } from './jobs.basis-fields.js';

function DescriptionFields({ draft, change, errors, disabled }: JobFormProps) {
  const pt = usePluginTranslation('jobs');
  const toolbarLabels = {
    mode: pt('richText.mode'),
    visualMode: pt('richText.visualMode'),
    htmlMode: pt('richText.htmlMode'),
    blockType: pt('richText.blockType'),
    bulletList: pt('richText.bulletList'),
    orderedList: pt('richText.orderedList'),
    bold: pt('richText.bold'),
    italic: pt('richText.italic'),
    underline: pt('richText.underline'),
    clearFormatting: pt('richText.clearFormatting'),
    undo: pt('richText.undo'),
    redo: pt('richText.redo'),
    link: pt('richText.applyLink'),
    linkPrompt: pt('richText.linkInput'),
  };
  return (
    <StudioDetailCard title={pt('fields.description')} description={pt('editor.optional')}>
      {draft.contentBlocks.map((block, index) => (
        <RichTextHtmlEditor
          key={block.sourceIndex ?? `new-${index}`}
          disabled={disabled}
          id={jobFieldId(`contentBlocks.${index}.body`)}
          value={block.body}
          ariaInvalid={errors.includes(`contentBlocks.${index}.body`)}
          onChange={(body) =>
            change(
              'contentBlocks',
              draft.contentBlocks.map((item, position) =>
                index === position ? { ...item, body } : item
              )
            )
          }
          blockTypeOptions={[
            { value: 'paragraph', label: pt('richText.paragraph') },
            { value: 'heading-2', label: pt('richText.heading2') },
            { value: 'heading-3', label: pt('richText.heading3') },
          ]}
          toolbarLabels={toolbarLabels}
          labelId="job-description-label"
        />
      ))}
      <span id="job-description-label" className="sr-only">
        {pt('fields.description')}
      </span>
      {!draft.contentBlocks.length ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => change('contentBlocks', [{ body: '' }])}
        >
          {pt('actions.add')}
        </Button>
      ) : null}
    </StudioDetailCard>
  );
}

export function JobContentFields(props: JobFormProps) {
  const pt = usePluginTranslation('jobs');
  return (
    <div className="space-y-6">
      <DescriptionFields {...props} />
      <CompanyFields {...props} />
      <Contacts {...props} />
      <details id="job-mediaContents">
        <summary id="job-mediaContents-summary">
          {pt('fields.media')} ({props.draft.mediaContents.length})
        </summary>
        <p className="my-3 text-sm text-muted-foreground">{pt('messages.mediaPrimary')}</p>
        {props.draft.mediaContents.map((item, index) => (
          <StudioField
            key={item.sourceIndex ?? index}
            id={`job-media-type-${index}`}
            label={pt('fields.mediaType')}
          >
            <Select
              id={`job-media-type-${index}`}
              value={item.contentType}
              onChange={(event) =>
                props.change(
                  'mediaContents',
                  props.draft.mediaContents.map((entry, position) =>
                    position === index
                      ? {
                          ...entry,
                          contentType: event.currentTarget.value as typeof entry.contentType,
                        }
                      : entry
                  )
                )
              }
            >
              {(['image', 'audio', 'video', 'logo', 'attachement'] as const).map((type) => (
                <option key={type} value={type}>
                  {pt(`mediaTypes.${type}`)}
                </option>
              ))}
            </Select>
          </StudioField>
        ))}
        <JobMediaFields {...props} />
      </details>
    </div>
  );
}
