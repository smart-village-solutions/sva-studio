import { formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { Controller, useFormContext, useWatch, type FieldError } from 'react-hook-form';
import { Checkbox, Input, StudioField, StudioFormSummaryErrors, getStudioFormFieldProps } from '@sva/studio-ui-react';

import { NewsDetailCard } from './news.detail-card.js';
import type { NewsContentItem, NewsDetailFormValues } from './news.types.js';

const missingDateValue = '--.--.-- --:--';

type ScheduledPublicationFieldState = Readonly<{
  value: string;
  isInvalid: boolean;
  onChange: (nextValue: string) => string;
}>;

export type NewsDetailSettingsTabProps = Readonly<{
  loadedItem: NewsContentItem | null;
  mode: 'create' | 'edit';
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
  scheduledPublicationField: ScheduledPublicationFieldState;
}>;

type NewsDetailSettingsFormControl = ReturnType<typeof useFormContext<NewsDetailFormValues>>['control'];

const collectSummaryErrors = (
  fields: readonly ReturnType<typeof getStudioFormFieldProps>[]
) => fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

const translateFieldError = (
  error: FieldError | undefined,
  pt: NewsDetailSettingsTabProps['pt']
): FieldError | undefined => {
  if (!error || typeof error.message !== 'string') {
    return error;
  }

  return {
    ...error,
    message: pt(`validation.${error.message}`),
  };
};

const createManualFieldError = (message: string): FieldError => ({
  type: 'manual',
  message,
});

const formatMetadataDate = (value?: string) => {
  if (!value) {
    return missingDateValue;
  }

  return formatDateTimeInEditorTimeZone(value) ?? value;
};

function NewsPushNotificationCard({
  control,
  loadedItem,
  pt,
}: Readonly<{
  control: NewsDetailSettingsFormControl;
  loadedItem: NewsContentItem | null;
  pt: NewsDetailSettingsTabProps['pt'];
}>) {
  return (
    <NewsDetailCard
      title={pt('cards.settings.push.title')}
      description={pt('cards.settings.push.description')}
    >
      {loadedItem?.pushNotificationsSentAt ? (
        <dl className="space-y-1 text-sm">
          <dt className="font-medium text-foreground">{pt('fields.pushNotificationsSentAt')}</dt>
          <dd className="text-muted-foreground">{formatMetadataDate(loadedItem.pushNotificationsSentAt)}</dd>
        </dl>
      ) : (
        <label
          htmlFor="news-push-notification-enabled"
          className="flex items-start gap-3 rounded-xl border border-border/60 p-4 text-sm"
        >
          <Controller
            control={control}
            name="pushNotificationEnabled"
            render={({ field }) => (
              <Checkbox
                id="news-push-notification-enabled"
                aria-labelledby="news-push-notification-label"
                aria-describedby="news-push-notification-hint"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            )}
          />
          <span className="space-y-1">
            <span id="news-push-notification-label" className="block font-medium text-foreground">
              {pt('fields.pushNotification')}
            </span>
            <span id="news-push-notification-hint" className="block text-muted-foreground">
              {pt('cards.settings.push.toggleHint')}
            </span>
          </span>
        </label>
      )}
    </NewsDetailCard>
  );
}

function NewsPublicationModeFieldset({
  control,
  pt,
}: Readonly<{
  control: NewsDetailSettingsFormControl;
  pt: NewsDetailSettingsTabProps['pt'];
}>) {
  return (
    <Controller
      control={control}
      name="publicationMode"
      render={({ field }) => (
        <fieldset className="space-y-3" aria-label={pt('fields.publicationMode')}>
          <legend className="text-sm font-medium text-foreground">{pt('fields.publicationMode')}</legend>

          {(['draft', 'immediate', 'scheduled'] as const).map((option) => (
            <label
              key={option}
              htmlFor={`publication-mode-${option}`}
              className="flex gap-3 rounded-xl border border-border/60 p-4 text-sm"
            >
              <input
                id={`publication-mode-${option}`}
                type="radio"
                name={field.name}
                value={option}
                aria-describedby={`publication-mode-${option}-description`}
                checked={field.value === option}
                onChange={(event) => field.onChange(event.target.value)}
              />
              <div className="space-y-1">
                <span className="block font-medium text-foreground">
                  {pt(`publicationModes.${option}.label`)}
                </span>
                <p id={`publication-mode-${option}-description`} className="text-muted-foreground">
                  {pt(`publicationModes.${option}.description`)}
                </p>
              </div>
            </label>
          ))}
        </fieldset>
      )}
    />
  );
}

function NewsPublicationCard({
  control,
  loadedItem,
  mode,
  pt,
  publicationMode,
  scheduledPublicationBindings,
  scheduledPublicationField,
}: Readonly<{
  control: NewsDetailSettingsFormControl;
  loadedItem: NewsContentItem | null;
  mode: 'create' | 'edit';
  pt: NewsDetailSettingsTabProps['pt'];
  publicationMode: NewsDetailFormValues['publicationMode'];
  scheduledPublicationBindings: ReturnType<typeof getStudioFormFieldProps>;
  scheduledPublicationField: ScheduledPublicationFieldState;
}>) {
  return (
    <NewsDetailCard
      title={pt('cards.settings.publication.title')}
      description={pt('cards.settings.publication.description')}
    >
      <NewsPublicationModeFieldset control={control} pt={pt} />

      {publicationMode === 'scheduled' ? (
        <StudioField
          {...scheduledPublicationBindings}
          label={pt('fields.scheduledPublicationAt')}
          description={pt('cards.settings.publication.scheduleHint')}
          required
        >
          <Controller
            control={control}
            name="scheduledPublicationAt"
            render={({ field }) => (
              <Input
                {...scheduledPublicationBindings.controlProps}
                type="datetime-local"
                required
                value={scheduledPublicationField.value}
                onChange={(event) => field.onChange(scheduledPublicationField.onChange(event.target.value))}
              />
            )}
          />
        </StudioField>
      ) : null}

      {mode === 'edit' ? (
        <dl className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
          <dt className="font-medium text-foreground">{pt('fields.publishedAt')}</dt>
          <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.publishedAt)}</dd>
        </dl>
      ) : null}
    </NewsDetailCard>
  );
}

export function NewsDetailSettingsTab({
  loadedItem,
  mode,
  pt,
  scheduledPublicationField,
}: NewsDetailSettingsTabProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<NewsDetailFormValues>();
  const publicationMode = useWatch({ control, name: 'publicationMode' }) ?? 'draft';

  const scheduledPublicationError = scheduledPublicationField.isInvalid
    ? createManualFieldError(pt('validation.scheduledPublicationAt'))
    : translateFieldError(errors.scheduledPublicationAt, pt);
  const scheduledPublicationBindings = getStudioFormFieldProps({
    id: 'news-scheduled-publication-at',
    error: scheduledPublicationError,
  });
  const summaryErrors = collectSummaryErrors([scheduledPublicationBindings]);

  return (
    <div className="space-y-6">
      <StudioFormSummaryErrors errors={summaryErrors} title={pt('messages.validationSummary')} />
      <NewsPushNotificationCard control={control} loadedItem={loadedItem} pt={pt} />
      <NewsPublicationCard
        control={control}
        loadedItem={loadedItem}
        mode={mode}
        pt={pt}
        publicationMode={publicationMode}
        scheduledPublicationBindings={scheduledPublicationBindings}
        scheduledPublicationField={scheduledPublicationField}
      />
    </div>
  );
}
