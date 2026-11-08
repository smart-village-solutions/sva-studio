import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, StudioDetailCard, StudioField } from '@sva/studio-ui-react';
import { emptyJobContact, type JobInput } from './contract.js';
import { jobFieldId, type JobFormProps } from './jobs.form.js';

export function TextField({
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
export function ContactFields({
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
          {(['url', 'description'] as const).map((key) => (
            <TextField
              key={key}
              path={`${path}.webUrls.${index}.${key}`}
              label={pt(key === 'url' ? 'fields.url' : 'fields.urlDescription')}
              type={key === 'url' ? 'url' : 'text'}
              value={url[key]}
              errors={errors}
              onChange={(text) =>
                onChange({
                  ...value,
                  webUrls: value.webUrls.map((item, position) =>
                    position === index ? { ...item, [key]: text } : item
                  ),
                })
              }
            />
          ))}
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
export function Contacts({ draft, change, errors }: JobFormProps) {
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
