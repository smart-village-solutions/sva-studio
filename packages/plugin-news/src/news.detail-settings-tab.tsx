import { translateNewsFieldError } from './news.detail-page.helpers.js';
import { formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { type NewsWasteMasterDataOverview } from './news.waste-targeting.js';
import { Controller, useFormContext, useWatch, type FieldError } from 'react-hook-form';
import {
  Radio,
  Checkbox,
  Input,
  StudioField,
  StudioFormSummaryErrors,
  getStudioFormFieldProps,
} from '@sva/studio-ui-react';
import { useEffect, type ReactNode } from 'react';
import { StudioDetailCard } from '@sva/studio-ui-react';
import { NewsDetailTargetingSection } from './news.detail-targeting-tab.js';
import type { NewsContentItem, NewsDetailFormValues } from './news.types.js';
import type { WasteTargetingAvailability } from './news.waste-payload.js';
const missingDateValue = '--.--.-- --:--';
type ScheduledPublicationFieldState = Readonly<{
  value: string;
  isInvalid: boolean;
  onChange: (nextValue: string) => string;
}>;
export type NewsDetailSettingsTabProps = Readonly<{
  principal?: ReactNode;
  loadedItem: NewsContentItem | null;
  canSendPushNotification?: boolean;
  mode: 'create' | 'edit';
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
  scheduledPublicationField: ScheduledPublicationFieldState;
  wasteOverview: NewsWasteMasterDataOverview | null;
  wasteTargetingAvailability: WasteTargetingAvailability;
  onLoadWasteOverview: () => Promise<boolean>;
}>;
type NewsDetailSettingsFormControl = ReturnType<
  typeof useFormContext<NewsDetailFormValues>
>['control'];

const collectSummaryErrors = (fields: readonly ReturnType<typeof getStudioFormFieldProps>[]) =>
  fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

const createManualFieldError = (message: string): FieldError => ({
  type: 'manual',
  message,
});

const formatMetadataDate = (value?: string) =>
  value ? (formatDateTimeInEditorTimeZone(value) ?? value) : missingDateValue;

function NewsPushNotificationCard({
  control,
  loadedItem,
  canSendPushNotification,
  publicationMode,
  pt,
  wasteOverview,
  wasteTargetingAvailability,
  onLoadWasteOverview,
}: Readonly<{
  control: NewsDetailSettingsFormControl;
  loadedItem: NewsContentItem | null;
  canSendPushNotification: boolean;
  publicationMode: NewsDetailFormValues['publicationMode'];
  pt: NewsDetailSettingsTabProps['pt'];
  wasteOverview: NewsWasteMasterDataOverview | null;
  wasteTargetingAvailability: WasteTargetingAvailability;
  onLoadWasteOverview: () => Promise<boolean>;
}>) {
  const pushEnabled = useWatch({ control, name: 'pushNotificationEnabled' });
  return (
    <StudioDetailCard
      title={pt('cards.settings.push.title')}
      description={pt('cards.settings.push.description')}
    >
      {loadedItem?.pushNotificationsSentAt ? (
        <dl className="space-y-1 text-sm">
          <dt className="font-medium text-foreground">{pt('fields.pushNotificationsSentAt')}</dt>
          <dd className="text-muted-foreground">
            {formatMetadataDate(loadedItem.pushNotificationsSentAt)}
          </dd>
        </dl>
      ) : canSendPushNotification ? (
        <label
          htmlFor="news-push-notification-enabled"
          className="flex items-start gap-3 rounded-lg border border-border-subtle p-4 text-sm"
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
                disabled={publicationMode !== 'immediate'}
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
              {publicationMode !== 'immediate' ? ` ${pt('create.pushResetHint')}` : ''}
            </span>
          </span>
        </label>
      ) : null}
      {canSendPushNotification &&
      (pushEnabled || Boolean(loadedItem)) &&
      wasteTargetingAvailability !== 'forbidden' ? (
        <NewsDetailTargetingSection
          overview={wasteOverview}
          pt={pt}
          readOnly={Boolean(loadedItem?.pushNotificationsSentAt)}
          availability={wasteTargetingAvailability}
          onLoadOverview={onLoadWasteOverview}
        />
      ) : null}
    </StudioDetailCard>
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
          <legend className="text-sm font-medium text-foreground">
            {pt('fields.publicationMode')}
          </legend>

          {(['draft', 'immediate', 'scheduled'] as const).map((option) => (
            <label
              key={option}
              htmlFor={`publication-mode-${option}`}
              className="flex gap-3 rounded-lg border border-border-subtle p-4 text-sm"
            >
              <Radio
                id={`publication-mode-${option}`}

                name={field.name}
                value={option}
                aria-labelledby={`publication-mode-${option}-label`}
                aria-describedby={`publication-mode-${option}-description`}
                checked={field.value === option}
                onChange={(event) => field.onChange(event.target.value)}
              />
              <span className="block space-y-1">
                <span
                  id={`publication-mode-${option}-label`}
                  className="block font-medium text-foreground"
                >
                  {pt(`publicationModes.${option}.label`)}
                </span>
                <span
                  id={`publication-mode-${option}-description`}
                  className="block text-muted-foreground"
                >
                  {pt(`publicationModes.${option}.description`)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
    />
  );
}

function NewsPublicationCard({
  principal,
  control,
  loadedItem,
  mode,
  pt,
  publicationMode,
  scheduledPublicationBindings,
  scheduledPublicationField,
}: Readonly<{
  principal?: ReactNode;
  control: NewsDetailSettingsFormControl;
  loadedItem: NewsContentItem | null;
  mode: 'create' | 'edit';
  pt: NewsDetailSettingsTabProps['pt'];
  publicationMode: NewsDetailFormValues['publicationMode'];
  scheduledPublicationBindings: ReturnType<typeof getStudioFormFieldProps>;
  scheduledPublicationField: ScheduledPublicationFieldState;
}>) {
  return (
    <StudioDetailCard
      title={pt('cards.settings.publication.title')}
      description={pt('cards.settings.publication.description')}
    >
      {principal}
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
                onChange={(event) =>
                  field.onChange(scheduledPublicationField.onChange(event.target.value))
                }
              />
            )}
          />
        </StudioField>
      ) : null}

      {mode === 'edit' ? (
        <dl className="space-y-1 rounded-lg border border-border-subtle bg-muted p-4 text-sm">
          <dt className="font-medium text-foreground">{pt('fields.publishedAt')}</dt>
          <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.publishedAt)}</dd>
        </dl>
      ) : null}
    </StudioDetailCard>
  );
}

export function NewsDetailSettingsTab({
  principal,
  loadedItem,
  canSendPushNotification = false,
  mode,
  pt,
  scheduledPublicationField,
  wasteOverview,
  wasteTargetingAvailability,
  onLoadWasteOverview,
}: NewsDetailSettingsTabProps) {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<NewsDetailFormValues>();
  const publicationMode = useWatch({ control, name: 'publicationMode' }) ?? 'draft';

  useEffect(() => {
    if (publicationMode !== 'immediate') {
      setValue('pushNotificationEnabled', false, { shouldDirty: true });
    }
  }, [publicationMode, setValue]);

  const scheduledPublicationBindings = getStudioFormFieldProps({
    id: 'news-scheduled-publication-at',
    error: scheduledPublicationField.isInvalid
      ? createManualFieldError(pt('validation.scheduledPublicationAt'))
      : translateNewsFieldError(errors.scheduledPublicationAt, pt),
  });

  const publicationCard = (
    <NewsPublicationCard
      principal={principal}
      control={control}
      loadedItem={loadedItem}
      mode={mode}
      pt={pt}
      publicationMode={publicationMode}
      scheduledPublicationBindings={scheduledPublicationBindings}
      scheduledPublicationField={scheduledPublicationField}
    />
  );
  return (
    <div className="space-y-6">
      <StudioFormSummaryErrors
        errors={collectSummaryErrors([scheduledPublicationBindings])}
        title={pt('messages.validationSummary')}
      />
      {mode === 'create' ? publicationCard : null}

      {(mode === 'edit' || publicationMode === 'immediate') &&
      (canSendPushNotification || loadedItem?.pushNotificationsSentAt) ? (
        <NewsPushNotificationCard
          control={control}
          loadedItem={loadedItem}
          canSendPushNotification={canSendPushNotification}
          publicationMode={publicationMode}
          pt={pt}
          wasteOverview={wasteOverview}
          wasteTargetingAvailability={wasteTargetingAvailability}
          onLoadWasteOverview={onLoadWasteOverview}
        />
      ) : null}
      {mode === 'create' && publicationMode !== 'immediate' ? (
        <p className="text-sm text-muted-foreground">{pt('create.noPushHint')}</p>
      ) : null}
      {mode === 'edit' ? publicationCard : null}
    </div>
  );
}
