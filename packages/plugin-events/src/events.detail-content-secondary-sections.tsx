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

const createEventsMediaLabels = (pt: Translator) => ({
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
    url: pt('fields.mediaSourceUrl'),
    altText: pt('fields.mediaSourceDescription'),
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
  urlFeedback: {
    upgradedToHttps: pt('media.urlUpgradedToHttps'),
    insecureHttp: pt('media.urlInsecureHttp'),
    httpsUnavailable: pt('media.urlHttpsUnavailable'),
    invalid: pt('media.urlInvalid'),
  },
  refresh: {
    title: pt('media.refreshTitle'),
    description: pt('media.refreshDescription'),
    assetValue: pt('media.assetValue'),
    contentValue: pt('media.contentValue'),
  },
});

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
          labels={createEventsMediaLabels(props.pt)}
        />
      </fieldset>
    </EventsDetailCard>
  );
}
