import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Input,
  Select,
  StudioDetailCard,
  StudioField,
  StudioSwitch,
  RichTextHtmlEditor,
} from '@sva/studio-ui-react';
import { emptyJobCompany, emptyJobContact, type JobInput } from './contract.js';
import { JobMap } from './jobs.map.js';
import { JobMediaFields } from './jobs.form-media.js';
import { jobFieldId, type JobFormProps } from './jobs.form.js';
export { jobFieldId } from './jobs.form.js';
function TextField({
  path,
  label,
  value,
  onChange,
  errors,
  required = false,
  type = 'text',
}: Readonly<{
  path: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  errors: readonly string[];
  required?: boolean;
  type?: string;
}>) {
  const pt = usePluginTranslation('jobs');
  const id = jobFieldId(path);
  const invalid = errors.includes(path);
  return (
    <StudioField
      id={id}
      label={label}
      required={required}
      controlProps={{
        id,
        ...(invalid ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {}),
      }}
      error={invalid ? pt('validation.invalid') : undefined}
    >
      <Input
        id={id}
        type={type}
        step={type === 'number' ? 'any' : undefined}
        value={value}
        required={required}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </StudioField>
  );
}
export function JobBasisFields({
  draft,
  change,
  errors,
  categories,
  categoriesLoading,
  categoryError,
  canPublish,
}: JobFormProps) {
  const pt = usePluginTranslation('jobs');
  const obsolete =
    draft.employmentType && !categories.some((item) => item.name === draft.employmentType);
  return (
    <div className="space-y-6">
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
function ContactFields({
  value,
  onChange,
  path,
  errors,
}: Readonly<{
  value: JobInput['contacts'][number];
  onChange: (value: JobInput['contacts'][number]) => void;
  path: string;
  errors: readonly string[];
}>) {
  const pt = usePluginTranslation('jobs');
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {(['firstName', 'lastName', 'email', 'phone', 'fax'] as const).map((key) => (
          <TextField
            key={key}
            path={`${path}.${key}`}
            label={pt(`fields.${key}`)}
            type={key === 'email' ? 'email' : key === 'phone' || key === 'fax' ? 'tel' : 'text'}
            value={value[key]}
            errors={errors}
            onChange={(text) => onChange({ ...value, [key]: text })}
          />
        ))}
      </div>
      {value.webUrls.map((url, index) => (
        <div key={index} className="grid gap-4 sm:grid-cols-2">
          <TextField
            path={`${path}.webUrls.${index}.url`}
            label={pt('fields.url')}
            type="url"
            value={url.url}
            errors={errors}
            onChange={(text) =>
              onChange({
                ...value,
                webUrls: value.webUrls.map((item, position) =>
                  position === index ? { ...item, url: text } : item
                ),
              })
            }
          />
          <TextField
            path={`${path}.webUrls.${index}.description`}
            label={pt('fields.urlDescription')}
            value={url.description}
            errors={errors}
            onChange={(text) =>
              onChange({
                ...value,
                webUrls: value.webUrls.map((item, position) =>
                  position === index ? { ...item, description: text } : item
                ),
              })
            }
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onChange({
                ...value,
                webUrls: value.webUrls.filter((_, position) => position !== index),
              })
            }
          >
            {pt('actions.removeUrl')}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          onChange({ ...value, webUrls: [...value.webUrls, { url: '', description: '' }] })
        }
      >
        {pt('actions.addUrl')}
      </Button>
    </div>
  );
}
function CompanyFields({ draft, change, errors, disabled }: JobFormProps) {
  const pt = usePluginTranslation('jobs');
  return (
    <StudioDetailCard title={pt('fields.companies')} description={pt('editor.companyHelp')}>
      {draft.companies.map((company, index) => {
        const update = (next: typeof company) =>
          change(
            'companies',
            draft.companies.map((item, position) => (position === index ? next : item))
          );
        return (
          <fieldset
            key={company.sourceIndex ?? `new-${index}`}
            className="mb-6 space-y-4 rounded-md border border-border p-4"
          >
            <legend className="px-1 font-medium">
              {pt(index === 0 ? 'fields.primaryCompany' : 'fields.additionalCompany', {
                number: index + 1,
              })}
            </legend>
            <TextField
              path={`companies.${index}.name`}
              label={pt('fields.companyName')}
              value={company.name}
              onChange={(name) => update({ ...company, name })}
              errors={errors}
            />
            <fieldset className="space-y-4">
              <legend className="font-medium">{pt('fields.companyContact')}</legend>
              <ContactFields
                value={company.contact}
                path={`companies.${index}.contact`}
                errors={errors}
                onChange={(contact) => update({ ...company, contact })}
              />
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['addition', 'street', 'zip', 'city'] as const).map((key) => (
                <TextField
                  key={key}
                  path={`companies.${index}.address.${key}`}
                  label={pt(`fields.${key}`)}
                  value={company.address[key]}
                  errors={errors}
                  onChange={(text) =>
                    update({ ...company, address: { ...company.address, [key]: text } })
                  }
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{pt('editor.coordinatesHelp')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['latitude', 'longitude'] as const).map((key) => (
                <TextField
                  key={key}
                  path={`companies.${index}.address.${key}`}
                  label={pt(`fields.${key}`)}
                  type="number"
                  value={company.address[key] === null ? '' : String(company.address[key])}
                  errors={errors}
                  onChange={(text) =>
                    update({
                      ...company,
                      address: { ...company.address, [key]: text === '' ? null : Number(text) },
                    })
                  }
                />
              ))}
            </div>
            <JobMap
              latitude={company.address.latitude}
              longitude={company.address.longitude}
              disabled={disabled}
              onChange={(latitude, longitude) =>
                update({ ...company, address: { ...company.address, latitude, longitude } })
              }
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                change(
                  'companies',
                  draft.companies.filter((_, position) => position !== index)
                )
              }
            >
              {pt('actions.removeCompany', { number: index + 1 })}
            </Button>
          </fieldset>
        );
      })}
      <Button
        type="button"
        variant="secondary"
        onClick={() => change('companies', [...draft.companies, emptyJobCompany()])}
      >
        {pt('actions.addCompany')}
      </Button>
    </StudioDetailCard>
  );
}
function Contacts({ draft, change, errors }: JobFormProps) {
  const pt = usePluginTranslation('jobs');
  return (
    <StudioDetailCard title={pt('fields.contacts')} description={pt('editor.contactHelp')}>
      {draft.contacts.map((contact, index) => (
        <fieldset
          key={contact.sourceIndex ?? `new-${index}`}
          className="mb-6 space-y-4 rounded-md border border-border p-4"
        >
          <legend className="px-1 font-medium">
            {pt(index === 0 ? 'fields.primaryContact' : 'fields.additionalContact', {
              number: index + 1,
            })}
          </legend>
          <ContactFields
            value={contact}
            path={`contacts.${index}`}
            errors={errors}
            onChange={(next) =>
              change(
                'contacts',
                draft.contacts.map((item, position) => (position === index ? next : item))
              )
            }
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              change(
                'contacts',
                draft.contacts.filter((_, position) => position !== index)
              )
            }
          >
            {pt('actions.removeContact', { number: index + 1 })}
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => change('contacts', [...draft.contacts, emptyJobContact()])}
      >
        {pt('actions.addContact')}
      </Button>
    </StudioDetailCard>
  );
}
function DescriptionFields({ draft, change, errors, disabled }: JobFormProps) {
  const pt = usePluginTranslation('jobs');
  const toolbarLabels = {
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
  };
  return (
    <StudioDetailCard title={pt('fields.description')} description={pt('editor.optional')}>
      {draft.contentBlocks.map((block, index) => (
        <RichTextHtmlEditor
          key={block.sourceIndex ?? `new-${index}`}
          disabled={disabled}
          id={jobFieldId(`contentBlocks.${index}.body`)}
          value={block.body}
          ariaInvalid={errors.includes(`contentBlocks.${index}.body`)}
          onChange={(body) =>
            change(
              'contentBlocks',
              draft.contentBlocks.map((item, position) =>
                index === position ? { ...item, body } : item
              )
            )
          }
          blockTypeOptions={[
            { value: 'paragraph', label: pt('richText.paragraph') },
            { value: 'heading-2', label: pt('richText.heading2') },
            { value: 'heading-3', label: pt('richText.heading3') },
          ]}
          toolbarLabels={toolbarLabels}
          labelId="job-description-label"
        />
      ))}
      <span id="job-description-label" className="sr-only">
        {pt('fields.description')}
      </span>
      {!draft.contentBlocks.length ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => change('contentBlocks', [{ body: '' }])}
        >
          {pt('actions.add')}
        </Button>
      ) : null}
    </StudioDetailCard>
  );
}

export function JobContentFields(props: JobFormProps) {
  const pt = usePluginTranslation('jobs');
  return (
    <div className="space-y-6">
      <DescriptionFields {...props} />
      <CompanyFields {...props} />
      <Contacts {...props} />
      <details id="job-mediaContents">
        <summary id="job-mediaContents-summary">
          {pt('fields.media')} ({props.draft.mediaContents.length})
        </summary>
        <p className="my-3 text-sm text-muted-foreground">{pt('messages.mediaPrimary')}</p>
        {props.draft.mediaContents.map((item, index) => (
          <StudioField
            key={item.sourceIndex ?? index}
            id={`job-media-type-${index}`}
            label={pt('fields.mediaType')}
          >
            <Select
              id={`job-media-type-${index}`}
              value={item.contentType}
              onChange={(event) =>
                props.change(
                  'mediaContents',
                  props.draft.mediaContents.map((entry, position) =>
                    position === index
                      ? {
                          ...entry,
                          contentType: event.currentTarget.value as typeof entry.contentType,
                        }
                      : entry
                  )
                )
              }
            >
              {(['image', 'audio', 'video', 'logo', 'attachement'] as const).map((type) => (
                <option key={type} value={type}>
                  {pt(`mediaTypes.${type}`)}
                </option>
              ))}
            </Select>
          </StudioField>
        ))}
        <JobMediaFields {...props} />
      </details>
    </div>
  );
}
