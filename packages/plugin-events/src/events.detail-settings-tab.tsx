import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Checkbox, Input, MediaReferenceField, StudioField, Textarea } from '@sva/studio-ui-react';

import type { EventsDetailFormValues } from './events.detail-form.js';
import { EventsDetailCard } from './events.detail-card.js';

export function EventsDetailSettingsTab({
  mediaOptions,
  pt,
}: Readonly<{
  mediaOptions: readonly { assetId: string; label: string }[];
  pt: (key: string) => string;
}>) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const pushNotification = useWatch({ control, name: 'settings.pushNotification' }) ?? false;
  const visible = useWatch({ control, name: 'settings.visible' }) ?? true;
  const externalId = useWatch({ control, name: 'settings.externalId' }) ?? '';
  const keywords = useWatch({ control, name: 'settings.keywords' }) ?? '';
  const tags = useWatch({ control, name: 'settings.tags' }) ?? '';

  return (
    <div className="space-y-6">
      <EventsDetailCard title={pt('cards.settings.media.title')} description={pt('cards.settings.media.description')}>
        <Controller
          name="settings.headerImageAssetId"
          control={control}
          render={({ field }) => (
            <MediaReferenceField
              id="event-header-image"
              label={pt('fields.headerImage')}
              value={field.value || null}
              options={mediaOptions}
              onChange={(assetId) => field.onChange(assetId ?? '')}
              placeholder={pt('fields.mediaPlaceholder')}
              clearLabel={pt('actions.clearMedia')}
            />
          )}
        />
      </EventsDetailCard>

      <EventsDetailCard
        title={pt('cards.settings.publication.title')}
        description={pt('cards.settings.publication.description')}
      >
        <StudioField id="event-visible" label={pt('fields.visible')}>
          <Checkbox
            id="event-visible"
            checked={visible}
            onChange={(event) => setValue('settings.visible', event.target.checked, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="event-push-notification" label={pt('fields.pushNotification')}>
          <Checkbox
            id="event-push-notification"
            checked={pushNotification}
            onChange={(event) => setValue('settings.pushNotification', event.target.checked, { shouldDirty: true })}
          />
        </StudioField>
      </EventsDetailCard>

      <EventsDetailCard
        title={pt('cards.settings.technical.title')}
        description={pt('cards.settings.technical.description')}
      >
        <StudioField id="event-external-id" label={pt('fields.externalId')}>
          <Input
            id="event-external-id"
            value={externalId}
            onChange={(event) => setValue('settings.externalId', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="event-keywords" label={pt('fields.keywords')}>
          <Input
            id="event-keywords"
            value={keywords}
            onChange={(event) => setValue('settings.keywords', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="event-tags" label={pt('fields.tags')}>
          <Textarea
            id="event-tags"
            rows={2}
            value={tags}
            onChange={(event) => setValue('settings.tags', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
      </EventsDetailCard>
    </div>
  );
}
