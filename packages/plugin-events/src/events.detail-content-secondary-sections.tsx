import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import {
  Button,
  ContentMediaUsageBlock,
  RichTextHtmlEditor,
  StudioFieldGroup,
  contentMediaUsagesToMainserver,
  mainserverContentMediaToUsages,
  type ContentMediaUsage,
} from '@sva/studio-ui-react';

import {
  createDefaultContact,
  createDefaultPriceInformation,
  createDefaultUrl,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import { EventsDetailCard } from './events.detail-card.js';
import {
  ContentInput,
  indexedId,
  RepeaterItem,
  type EventsContentTranslator as Translator,
} from './events.detail-content-section-fields.js';

type EventsDescriptionMediaSectionsProps = Readonly<{
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

export function EventsDescriptionMediaSections({
  onAddManualMedia,
  onOpenMediaPicker,
  mediaUsages,
  onChangeMediaUsages = () => undefined,
  canSelectMedia = true,
  canUploadMedia = true,
  mediaEditingDisabled = false,
  onLoadAssetSnapshot,
  pt,
}: EventsDescriptionMediaSectionsProps) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const description = useWatch({ control, name: 'content.description' }) ?? '';
  const mediaContents = useWatch({ control, name: 'content.mediaContents' }) ?? [];
  const resolvedMediaUsages = mediaUsages ?? mainserverContentMediaToUsages(mediaContents);
  const descriptionLabelId = 'event-description-label';

  return (
    <>
      <EventsDetailCard
        title={pt('cards.content.descriptions.title')}
        description={pt('cards.content.descriptions.description')}
      >
        <div className="space-y-1">
          <label
            id={descriptionLabelId}
            htmlFor="event-description"
            className="text-sm font-medium"
          >
            {pt('fields.description')}
          </label>
          <RichTextHtmlEditor
            id="event-description"
            labelId={descriptionLabelId}
            value={description}
            onChange={(nextValue) =>
              setValue('content.description', nextValue, { shouldDirty: true })
            }
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

      <EventsDetailCard
        title={pt('cards.content.media.title')}
        description={pt('cards.content.media.description')}
      >
        <fieldset disabled={mediaEditingDisabled} aria-busy={mediaEditingDisabled}>
          <ContentMediaUsageBlock
            usages={resolvedMediaUsages}
            onChange={(usages) => {
              onChangeMediaUsages(usages);
              setValue(
                'content.mediaContents',
                contentMediaUsagesToMainserver(
                  usages
                ) as EventsDetailFormValues['content']['mediaContents'],
                { shouldDirty: true }
              );
            }}
            onAddManual={onAddManualMedia}
            onOpenLibrary={canSelectMedia ? () => onOpenMediaPicker('library') : undefined}
            onOpenUpload={canUploadMedia ? () => onOpenMediaPicker('upload') : undefined}
            onLoadAssetSnapshot={onLoadAssetSnapshot}
            showHeader={false}
            supportedFields={{ altText: true, caption: true, credit: true, license: false }}
            labels={{
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
              refresh: {
                title: pt('media.refreshTitle'),
                description: pt('media.refreshDescription'),
                assetValue: pt('media.assetValue'),
                contentValue: pt('media.contentValue'),
              },
            }}
          />
        </fieldset>
      </EventsDetailCard>
    </>
  );
}

export function EventsContactLinkSections({ pt }: Readonly<{ pt: Translator }>) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const contactsArray = useFieldArray({ control, name: 'content.contacts' });
  const urlsArray = useFieldArray({ control, name: 'content.urls' });
  const contacts = useWatch({ control, name: 'content.contacts' }) ?? [];
  const urls = useWatch({ control, name: 'content.urls' }) ?? [];
  const renderedContacts = contacts.length > 0 ? contacts : [createDefaultContact()];
  const renderedUrls = urls.length > 0 ? urls : [createDefaultUrl()];

  return (
    <>
      <EventsDetailCard
        title={pt('cards.content.contacts.title')}
        description={pt('cards.content.contacts.description')}
        actions={
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => contactsArray.append(createDefaultContact())}
          >
            {pt('actions.addContact')}
          </Button>
        }
      >
        {renderedContacts.map((contact, index) => (
          <RepeaterItem
            key={contactsArray.fields[index]?.id ?? `fallback-contact-${index}`}
            title={pt('cards.content.contacts.itemTitle')}
            removeLabel={pt('actions.remove')}
            onRemove={contacts.length > 1 ? () => contactsArray.remove(index) : undefined}
          >
            <StudioFieldGroup columns={2}>
              <ContentInput
                id={indexedId('event-contact-first-name', index)}
                label={pt('fields.firstName')}
                value={contact.firstName}
                onChange={(value) =>
                  setValue(`content.contacts.${index}.firstName`, value, { shouldDirty: true })
                }
              />
              <ContentInput
                id={indexedId('event-contact-last-name', index)}
                label={pt('fields.lastName')}
                value={contact.lastName}
                onChange={(value) =>
                  setValue(`content.contacts.${index}.lastName`, value, { shouldDirty: true })
                }
              />
            </StudioFieldGroup>
            <StudioFieldGroup columns={2}>
              <ContentInput
                id={indexedId('event-contact-email', index)}
                label={pt('fields.email')}
                value={contact.email}
                onChange={(value) =>
                  setValue(`content.contacts.${index}.email`, value, { shouldDirty: true })
                }
              />
              <ContentInput
                id={indexedId('event-contact-phone', index)}
                label={pt('fields.phone')}
                value={contact.phone}
                onChange={(value) =>
                  setValue(`content.contacts.${index}.phone`, value, { shouldDirty: true })
                }
              />
            </StudioFieldGroup>
          </RepeaterItem>
        ))}
      </EventsDetailCard>

      <EventsDetailCard
        title={pt('cards.content.links.title')}
        description={pt('cards.content.links.description')}
        actions={
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => urlsArray.append(createDefaultUrl())}
          >
            {pt('actions.addLink')}
          </Button>
        }
      >
        {renderedUrls.map((url, index) => (
          <RepeaterItem
            key={urlsArray.fields[index]?.id ?? `fallback-url-${index}`}
            title={pt('cards.content.links.itemTitle')}
            removeLabel={pt('actions.remove')}
            onRemove={urls.length > 1 ? () => urlsArray.remove(index) : undefined}
          >
            <StudioFieldGroup columns={2}>
              <ContentInput
                id={indexedId('event-url', index)}
                label={pt('fields.url')}
                value={url.url}
                onChange={(value) =>
                  setValue(`content.urls.${index}.url`, value, { shouldDirty: true })
                }
              />
              <ContentInput
                id={indexedId('event-url-description', index)}
                label={pt('fields.urlDescription')}
                value={url.description}
                onChange={(value) =>
                  setValue(`content.urls.${index}.description`, value, { shouldDirty: true })
                }
              />
            </StudioFieldGroup>
          </RepeaterItem>
        ))}
      </EventsDetailCard>
    </>
  );
}

export function EventsPriceSection({ pt }: Readonly<{ pt: Translator }>) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const pricesArray = useFieldArray({ control, name: 'content.priceInformations' });
  const prices = useWatch({ control, name: 'content.priceInformations' }) ?? [];
  const renderedPrices = prices.length > 0 ? prices : [createDefaultPriceInformation()];

  return (
    <EventsDetailCard
      title={pt('cards.content.prices.title')}
      description={pt('cards.content.prices.description')}
      actions={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => pricesArray.append(createDefaultPriceInformation())}
        >
          {pt('actions.addPrice')}
        </Button>
      }
    >
      {renderedPrices.map((price, index) => (
        <RepeaterItem
          key={pricesArray.fields[index]?.id ?? `fallback-price-${index}`}
          title={pt('cards.content.prices.itemTitle')}
          removeLabel={pt('actions.remove')}
          onRemove={prices.length > 1 ? () => pricesArray.remove(index) : undefined}
        >
          <StudioFieldGroup columns={2}>
            <ContentInput
              id={indexedId('event-price-category', index)}
              label={pt('fields.priceCategory')}
              value={price.category}
              onChange={(value) =>
                setValue(`content.priceInformations.${index}.category`, value, {
                  shouldDirty: true,
                })
              }
            />
            <ContentInput
              id={indexedId('event-price-amount', index)}
              label={pt('fields.priceAmount')}
              type="number"
              value={price.amount}
              onChange={(value) =>
                setValue(
                  `content.priceInformations.${index}.amount`,
                  value.trim().length > 0 ? Number(value) : undefined,
                  { shouldDirty: true }
                )
              }
            />
          </StudioFieldGroup>
          <ContentInput
            id={indexedId('event-price-description', index)}
            label={pt('fields.priceDescription')}
            value={price.description}
            onChange={(value) =>
              setValue(`content.priceInformations.${index}.description`, value, {
                shouldDirty: true,
              })
            }
          />
        </RepeaterItem>
      ))}
    </EventsDetailCard>
  );
}
