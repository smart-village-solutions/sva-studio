import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioDetailCard } from '@sva/studio-ui-react';
import { emptyJobCompany, type JobInput } from './contract.js';
import { JobMap } from './jobs.map.js';
import type { JobFormProps } from './jobs.form.js';
import { TextField, ContactFields } from './jobs.contact-fields.js';

export function CompanyFields({ draft, change, errors, disabled }: JobFormProps) {
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
            <CompanyAddressFields
              company={company}
              index={index}
              errors={errors}
              disabled={disabled}
              update={update}
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
function CompanyAddressFields({
  company,
  index,
  errors,
  disabled,
  update,
}: Readonly<{
  company: JobInput['companies'][number];
  index: number;
  errors: readonly string[];
  disabled: boolean;
  update: (company: JobInput['companies'][number]) => void;
}>) {
  const pt = usePluginTranslation('jobs');
  return (
    <>
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
    </>
  );
}
