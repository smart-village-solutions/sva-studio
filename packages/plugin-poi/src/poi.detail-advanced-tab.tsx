import { Button, Input, StudioField, StudioFieldGroup, Textarea, getStudioFormFieldProps } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext, useWatch, type FieldError } from 'react-hook-form';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';

const translatePayloadError = (payloadError: FieldError | undefined, pt: (key: string) => string) =>
  payloadError && typeof payloadError.message === 'string'
    ? ({ ...payloadError, message: pt(`validation.${payloadError.message}`) } as FieldError)
    : payloadError;

function PoiAdvancedMetaFields({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const { register } = useFormContext<PoiDetailFormValues>();

  return (
    <StudioFieldGroup columns={2}>
      <StudioField id="poi-external-id" label={pt('fields.externalId')}>
        <Input id="poi-external-id" {...register('settings.externalId')} />
      </StudioField>
      <StudioField id="poi-keywords" label={pt('fields.keywords')}>
        <Input id="poi-keywords" {...register('settings.keywords')} />
      </StudioField>
    </StudioFieldGroup>
  );
}

function PoiCertificateFields({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const { control, register } = useFormContext<PoiDetailFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'content.certificates' });

  return (
    <>
      {fields.map((field, index) => (
        <div key={field.id} className="rounded-xl border border-border/60 p-4">
          <StudioField id={`poi-certificate-name-${index}`} label={pt('fields.certificateName')}>
            <Input id={`poi-certificate-name-${index}`} {...register(`content.certificates.${index}.name`)} />
          </StudioField>
          {fields.length > 1 ? (
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" onClick={() => remove(index)}>
                {pt('actions.remove')}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => append({ name: '' })}>
        {pt('actions.add')}
      </Button>
    </>
  );
}

export function PoiDetailAdvancedTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<PoiDetailFormValues>();
  const payloadText = useWatch({ control, name: 'content.payloadText' }) ?? '{}';
  const tagsText = useWatch({ control, name: 'content.tagsText' }) ?? '';
  const accessibility = useWatch({ control, name: 'content.accessibilityInformation' }) ?? {};
  const payloadField = getStudioFormFieldProps({
    id: 'poi-payload',
    error: translatePayloadError(errors.content?.payloadText, pt),
  });

  return (
    <PoiDetailSectionCard title={pt('cards.advanced.payload.title')} description={pt('cards.advanced.payload.description')}>
      <PoiAdvancedMetaFields pt={pt} />

      <StudioField id="poi-tags" label={pt('fields.tags')}>
        <Input id="poi-tags" value={tagsText} onChange={(event) => setValue('content.tagsText', event.target.value, { shouldDirty: true })} />
      </StudioField>

      <StudioFieldGroup columns={2}>
        <StudioField id="poi-accessibility-description" label={pt('fields.accessibilityDescription')}>
          <Input
            id="poi-accessibility-description"
            value={accessibility.description ?? ''}
            onChange={(event) =>
              setValue('content.accessibilityInformation.description', event.target.value, { shouldDirty: true })
            }
          />
        </StudioField>
        <StudioField id="poi-accessibility-types" label={pt('fields.accessibilityTypes')}>
          <Input
            id="poi-accessibility-types"
            value={accessibility.types ?? ''}
            onChange={(event) => setValue('content.accessibilityInformation.types', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
      </StudioFieldGroup>

      <PoiCertificateFields pt={pt} />

      <StudioField {...payloadField} label={pt('fields.payload')}>
        <Textarea
          {...payloadField.controlProps}
          rows={8}
          value={payloadText}
          onChange={(event) => setValue('content.payloadText', event.target.value, { shouldDirty: true })}
        />
      </StudioField>
    </PoiDetailSectionCard>
  );
}
