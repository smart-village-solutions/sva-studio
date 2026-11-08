import { usePluginTranslation } from '@sva/plugin-sdk';
import { Select, StudioDetailCard, StudioField, StudioSwitch } from '@sva/studio-ui-react';
import { TextField } from './jobs.contact-fields.js';
import type { JobFormProps } from './jobs.form.js';

export function JobBasisFields(props: JobFormProps) {
  const { draft, change, canPublish, errors } = props;
  const pt = usePluginTranslation('jobs');
  return (
    <div className="space-y-6">
      {identityFields(props, pt)}
      {dateFields({ draft, change, errors }, pt)}
      <StudioDetailCard title={pt('fields.visible')}>
        <div className="flex items-center gap-3">
          <StudioSwitch
            id="job-visible"
            aria-describedby="job-visible-description"
            checked={draft.visible}
            disabled={!canPublish}
            onCheckedChange={(value) => change('visible', value)}
          />
          <label htmlFor="job-visible" className="text-sm text-foreground">
            {pt('fields.visible')}
          </label>
        </div>
        <p id="job-visible-description" className="text-sm text-muted-foreground">
          {pt(draft.visible ? 'editor.visibleEffect' : 'editor.hiddenEffect')}
        </p>
      </StudioDetailCard>
    </div>
  );
}
function dateFields(
  { draft, change, errors }: Pick<JobFormProps, 'draft' | 'change' | 'errors'>,
  pt: ReturnType<typeof usePluginTranslation>
) {
  return (
    <StudioDetailCard title={pt('fields.dates')} description={pt('editor.datesHelp')}>
      <TextField
        path="publicationDate"
        label={pt('fields.publicationDate')}
        value={draft.publicationDate}
        type="date"
        errors={errors}
        required
        onChange={(value) => change('publicationDate', value)}
      />
      {draft.dates.map((date, index) => (
        <TextField
          key={date.sourceIndex ?? `new-${index}`}
          path={`dates.${index}.dateEnd`}
          label={pt(index === 0 ? 'fields.dateEnd' : 'fields.additionalDateEnd', {
            number: index + 1,
          })}
          type="date"
          value={date.dateEnd}
          required={index === 0}
          errors={errors}
          onChange={(value) =>
            change(
              'dates',
              draft.dates.map((item, position) =>
                position === index ? { ...item, dateEnd: value } : item
              )
            )
          }
        />
      ))}
    </StudioDetailCard>
  );
}

function identityFields(
  { draft, change, errors, categories, categoriesLoading, categoryError }: JobFormProps,
  pt: ReturnType<typeof usePluginTranslation>
) {
  const obsolete =
    draft.employmentType && !categories.some((item) => item.name === draft.employmentType);
  return (
    <StudioDetailCard title={pt('tabs.basis')}>
      <TextField
        path="title"
        label={pt('fields.title')}
        value={draft.title}
        onChange={(value) => change('title', value)}
        errors={errors}
        required
      />
      <TextField
        path="externalId"
        label={pt('fields.externalId')}
        value={draft.externalId}
        onChange={(value) => change('externalId', value)}
        errors={errors}
      />
      <StudioField
        id="job-employmentType"
        label={pt('fields.employmentType')}
        required
        controlProps={{
          id: 'job-employmentType',
          ...(errors.includes('employmentType')
            ? { 'aria-invalid': true as const, 'aria-describedby': 'job-employmentType-error' }
            : {}),
        }}
        error={errors.includes('employmentType') ? pt('validation.invalid') : undefined}
      >
        <Select
          id="job-employmentType"
          value={draft.employmentType}
          required
          aria-invalid={errors.includes('employmentType')}
          onChange={(event) => change('employmentType', event.currentTarget.value)}
        >
          <option value="">{pt('fields.employmentPlaceholder')}</option>
          {obsolete ? (
            <option value={draft.employmentType}>
              {pt('fields.employmentObsolete', { name: draft.employmentType })}
            </option>
          ) : null}
          {categories.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
      </StudioField>
      {categoriesLoading ? (
        <p role="status">{pt('messages.categoriesLoading')}</p>
      ) : categoryError ? (
        <p role="status">{pt('messages.categoryError')}</p>
      ) : categories.length === 0 ? (
        <p role="status">{pt('messages.employmentEmpty')}</p>
      ) : null}
    </StudioDetailCard>
  );
}
