import { Controller, useFormContext, type FieldError } from 'react-hook-form';
import { getStudioFormFieldProps, StudioFormSummaryErrors } from '@sva/studio-ui-react';
import { Button, Checkbox, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import type { NewsDetailFormValues } from './news.types.js';

export type NewsDetailSettingsTabProps = Readonly<{
  onSave: () => void;
  saveLabel: string;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}>;

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

export function NewsDetailSettingsTab({ onSave, saveLabel, pt }: NewsDetailSettingsTabProps) {
  const {
    control,
    formState: { errors },
    register,
  } = useFormContext<NewsDetailFormValues>();

  const externalIdField = getStudioFormFieldProps({
    id: 'news-external-id',
    error: translateFieldError(errors.externalId, pt),
  });
  const newsTypeField = getStudioFormFieldProps({
    id: 'news-type',
    error: translateFieldError(errors.newsType, pt),
  });
  const charactersField = getStudioFormFieldProps({
    id: 'news-characters',
    error: translateFieldError(errors.charactersToBeShown, pt),
  });
  const summaryErrors = collectSummaryErrors([externalIdField, newsTypeField, charactersField]);

  return (
    <div className="space-y-6">
      <StudioFormSummaryErrors errors={summaryErrors} title={pt('messages.validationSummary')} />

      <StudioFieldGroup columns={2}>
        <StudioField {...externalIdField} label={pt('fields.externalId')}>
          <Input {...externalIdField.controlProps} {...register('externalId')} />
        </StudioField>
        <StudioField {...newsTypeField} label={pt('fields.newsType')}>
          <Input {...newsTypeField.controlProps} {...register('newsType')} />
        </StudioField>
      </StudioFieldGroup>

      <div className="grid gap-4 md:grid-cols-3">
        <StudioField {...charactersField} label={pt('fields.charactersToBeShown')}>
          <Input {...charactersField.controlProps} type="number" min={0} {...register('charactersToBeShown')} />
        </StudioField>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Controller
            control={control}
            name="fullVersion"
            render={({ field }) => (
              <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />
            )}
          />
          {pt('fields.fullVersion')}
        </label>
        <div />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
