import { useFormContext, useWatch } from 'react-hook-form';
import {
  ContentMediaUsageBlock,
  RichTextHtmlEditor,
  contentMediaUsagesToMainserver,
  mainserverContentMediaToUsages,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';

import type { EventsDetailFormValues } from './events.detail-form.js';
import { EventsDetailCard } from './events.detail-card.js';
import type { EventsContentTranslator as Translator } from './events.detail-content-section-fields.js';

const dirty = { shouldDirty: true } as const;

export function EventsDescriptionSection({ pt }: Readonly<{ pt: Translator }>) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const description = useWatch({ control, name: 'content.description' }) ?? '';
  return (
    <EventsDetailCard
      title={pt('cards.content.descriptions.title')}
      description={pt('cards.content.descriptions.description')}
    >
      <div className="space-y-1">
        <label
          id="event-description-label"
          htmlFor="event-description"
          className="text-sm font-medium"
        >
          {pt('fields.description')}
        </label>
        <RichTextHtmlEditor
          id="event-description"
          labelId="event-description-label"
          value={description}
          onChange={(value) => setValue('content.description', value, dirty)}
          blockTypeOptions={[
            { value: 'paragraph', label: pt('richText.paragraph') },
            { value: 'heading-2', label: pt('richText.heading2') },
            { value: 'heading-3', label: pt('richText.heading3') },
            { value: 'heading-4', label: pt('richText.heading4') },
            { value: 'blockquote', label: pt('richText.blockquote') },
          ]}
          toolbarLabels={{
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
          }}
        />
      </div>
    </EventsDetailCard>
  );
}

export type EventsMediaSectionProps = Readonly<{
  onAddManualMedia: () => string;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  mediaUsages?: readonly ContentMediaUsage[];
  onChangeMediaUsages?: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia?: boolean;
  canUploadMedia?: boolean;
  mediaEditingDisabled?: boolean;
  onLoadAssetSnapshot?: React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot'];
  pt: Translator;
}>;

export function EventsMediaSection(props: EventsMediaSectionProps) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const mediaContents = useWatch({ control, name: 'content.mediaContents' }) ?? [];
  const usages = props.mediaUsages ?? mainserverContentMediaToUsages(mediaContents);
  const onChange = props.onChangeMediaUsages ?? (() => undefined);
  return (
    <EventsDetailCard
      title={props.pt('cards.content.media.title')}
      description={props.pt('cards.content.media.description')}
    >
      <fieldset disabled={props.mediaEditingDisabled} aria-busy={props.mediaEditingDisabled}>
        <ContentMediaUsageBlock
          usages={usages}
          onChange={(nextUsages) => {
            onChange(nextUsages);
            setValue(
              'content.mediaContents',
              contentMediaUsagesToMainserver(
                nextUsages
              ) as EventsDetailFormValues['content']['mediaContents'],
              dirty
            );
          }}
          onAddManual={props.onAddManualMedia}
          onOpenLibrary={
            props.canSelectMedia === false ? undefined : () => props.onOpenMediaPicker('library')
          }
          onOpenUpload={
            props.canUploadMedia === false ? undefined : () => props.onOpenMediaPicker('upload')
          }
          onLoadAssetSnapshot={props.onLoadAssetSnapshot}
          showHeader={false}
          supportedFields={{ altText: true, caption: true, credit: true, license: false }}
          labels={{
            title: props.pt('cards.content.media.title'),
            description: props.pt('cards.content.media.description'),
            empty: props.pt('cards.content.media.empty'),
            actions: {
              add: props.pt('messages.mediaPickerTitle'),
              remove: props.pt('actions.removeImage'),
              moveUp: props.pt('media.moveUp'),
              moveDown: props.pt('media.moveDown'),
              refreshMetadata: props.pt('media.refresh'),
              cancel: props.pt('actions.cancel'),
              apply: props.pt('media.apply'),
            },
            fields: {
              url: props.pt('fields.mediaSourceUrl'),
              altText: props.pt('fields.mediaSourceDescription'),
              caption: props.pt('fields.mediaCaption'),
              credit: props.pt('fields.mediaCopyright'),
              license: props.pt('messages.mediaPickerLicense'),
            },
            states: {
              linked: props.pt('media.linked'),
              manual: props.pt('media.manual'),
              synced: props.pt('media.synced'),
              pending: props.pt('media.pending'),
              missing: props.pt('media.missing'),
              additional: props.pt('media.additional'),
              unresolved: props.pt('media.unresolved'),
              failed: props.pt('media.failed'),
              previewUnavailable: props.pt('media.previewUnavailable'),
            },
            announcements: { moved: props.pt('media.moved'), removed: props.pt('media.removed') },
            refresh: {
              title: props.pt('media.refreshTitle'),
              description: props.pt('media.refreshDescription'),
              assetValue: props.pt('media.assetValue'),
              contentValue: props.pt('media.contentValue'),
            },
          }}
        />
      </fieldset>
    </EventsDetailCard>
  );
}
