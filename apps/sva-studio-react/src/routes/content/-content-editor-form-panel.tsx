import {
  getStudioFormFieldProps,
  StudioField,
  StudioFieldGroup,
  StudioFormSummaryErrors,
  type StudioFormFieldError,
} from '@sva/studio-ui-react';
import type React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { t } from '../../i18n';
import type { ContentFormState } from './-content-editor-form';

type ContentEditorFormPanelProps = {
  readonly form: UseFormReturn<ContentFormState>;
  readonly formId: string;
  readonly actionsDisabled: boolean;
  readonly onSubmit: React.FormEventHandler<HTMLFormElement>;
};

const collectSummaryErrors = (
  fields: readonly ReturnType<typeof getStudioFormFieldProps>[]
): readonly StudioFormFieldError[] =>
  fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

export const ContentEditorFormPanel = ({
  form,
  formId,
  actionsDisabled,
  onSubmit,
}: ContentEditorFormPanelProps) => {
  const {
    register,
    watch,
    formState: { errors },
  } = form;
  const statusValue = watch('status');
  const titleField = getStudioFormFieldProps({ id: 'content-title', error: errors.title });
  const contentTypeField = getStudioFormFieldProps({
    id: 'content-type',
    error: errors.contentType,
  });
  const statusField = getStudioFormFieldProps({ id: 'content-status', error: errors.status });
  const publishedAtField = getStudioFormFieldProps({
    id: 'content-published-at',
    error: errors.publishedAt,
  });
  const payloadField = getStudioFormFieldProps({
    id: 'content-payload',
    error: errors.payloadText,
  });
  const summaryErrors = collectSummaryErrors([
    titleField,
    contentTypeField,
    statusField,
    publishedAtField,
    payloadField,
  ]);

  return (
    <form id={formId} className="space-y-4" onSubmit={onSubmit} noValidate>
      <StudioFormSummaryErrors
        errors={summaryErrors}
        title={t('account.messages.validationSummary')}
      />
      <StudioFieldGroup columns={2}>
        <StudioField
          {...titleField}
          label={t('content.fields.title')}
          required
          className="md:col-span-2"
        >
          <Input {...register('title')} disabled={actionsDisabled} />
        </StudioField>
        <StudioField {...contentTypeField} label={t('content.fields.contentType')}>
          <Input {...register('contentType')} readOnly />
        </StudioField>
        <StudioField {...statusField} label={t('content.fields.status')}>
          <Select {...register('status')} disabled={actionsDisabled}>
            <option value="draft">{t('content.status.draft')}</option>
            <option value="in_review">{t('content.status.inReview')}</option>
            <option value="approved">{t('content.status.approved')}</option>
            <option value="published">{t('content.status.published')}</option>
            <option value="archived">{t('content.status.archived')}</option>
          </Select>
        </StudioField>
        <StudioField
          {...publishedAtField}
          label={t('content.fields.publishedAt')}
          className="md:col-span-2"
        >
          <Input
            {...register('publishedAt')}
            type="datetime-local"
            disabled={actionsDisabled}
            required={statusValue === 'published'}
          />
        </StudioField>
        <StudioField
          {...payloadField}
          label={t('content.fields.payload')}
          className="md:col-span-2"
        >
          <Textarea
            {...register('payloadText')}
            disabled={actionsDisabled}
            className="min-h-[22rem] font-mono text-xs"
          />
        </StudioField>
      </StudioFieldGroup>
    </form>
  );
};
