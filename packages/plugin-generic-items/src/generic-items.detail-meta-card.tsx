import {
  Input,
  InstantInput,
  StudioField,
  StudioFieldGroup,
  getStudioFormFieldProps,
} from '@sva/studio-ui-react';
import type { ReactNode } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

type MetaCardProps = Readonly<{
  children?: ReactNode;
  labels: Record<string, string>;
  createSection?: 'identity' | 'categories' | 'technical' | 'publication';
}>;

export const GenericItemsMetaCard = ({ labels, createSection, children }: MetaCardProps) => {
  const {
    register,
    formState: { errors },
  } = useFormContext<GenericItemsDetailFormValues>();
  const {
    field: { onChange: onPublishedAtChange, ...publishedAtInput },
  } = useController<GenericItemsDetailFormValues, 'publishedAt'>({ name: 'publishedAt' });
  const keywordsField = getStudioFormFieldProps({
    id: 'generic-item-keywords',
    hasDescription: true,
    error: errors.keywords,
  });
  const externalIdField = getStudioFormFieldProps({
    id: 'generic-item-external-id',
    error: errors.externalId,
  });
  const publicationDateField = getStudioFormFieldProps({
    id: 'generic-item-publication-date',
    hasDescription: true,
    error: errors.publicationDate,
  });
  const publishedAtField = getStudioFormFieldProps({
    id: 'generic-item-published-at',
    hasDescription: true,
    error: errors.publishedAt,
  });

  return (
    <GenericItemsDetailCard
      title={createSection === 'publication' ? labels.publicationDate : labels.metaTitle}
      description={
        createSection === 'publication' ? labels.publicationDateHelp : labels.metaDescription
      }
    >
      {!createSection || createSection === 'technical' ? (
        <StudioFieldGroup columns={2}>
          <StudioField {...keywordsField} label={labels.keywords} description={labels.keywordsHelp}>
            <Input {...keywordsField.controlProps} {...register('keywords')} />
          </StudioField>
        </StudioFieldGroup>
      ) : null}
      <StudioFieldGroup columns={2}>
        {!createSection || createSection === 'technical' ? (
          <StudioField {...externalIdField} label={labels.externalId}>
            <Input {...externalIdField.controlProps} {...register('externalId')} />
          </StudioField>
        ) : null}
        {!createSection || createSection === 'publication' ? (
          <StudioField
            {...publicationDateField}
            label={labels.publicationDate}
            description={labels.publicationDateHelp}
          >
            <Input {...publicationDateField.controlProps} {...register('publicationDate')} />
          </StudioField>
        ) : null}
      </StudioFieldGroup>
      {!createSection || createSection === 'publication' ? (
        <StudioField
          {...publishedAtField}
          label={labels.publishedAt}
          description={labels.publishedAtHelp}
        >
          <InstantInput
            label={labels.publishedAt}
            {...publishedAtField.controlProps}
            value={publishedAtInput.value}
            onBlur={publishedAtInput.onBlur}
            ref={publishedAtInput.ref}
            onValueChange={onPublishedAtChange}
          />
        </StudioField>
      ) : null}
      {children}
    </GenericItemsDetailCard>
  );
};
