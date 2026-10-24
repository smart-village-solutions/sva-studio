import {
  Checkbox,
  ContentOwnershipPanelSlot,
  Input,
  Select,
  StudioDetailCard,
  StudioField,
} from '@sva/studio-ui-react';
import { Controller, type UseFormReturn } from 'react-hook-form';

import type { CockpitCardFormValues } from './cockpit-cards.types.js';

type Translate = (key: string) => string;

export function BasisFields({
  form,
  pt,
  mode,
  options,
  categoriesState,
}: Readonly<{
  form: UseFormReturn<CockpitCardFormValues>;
  pt: Translate;
  mode: 'create' | 'edit';
  options: readonly { id: string; name: string }[];
  categoriesState: 'loading' | 'error' | 'ready';
}>) {
  return (
    <div className="space-y-4">
      {mode === 'edit' ? <ContentOwnershipPanelSlot /> : null}
      <HeadingField form={form} pt={pt} />
      <LanguageField form={form} pt={pt} />
      <CategoryField form={form} pt={pt} options={options} categoriesState={categoriesState} />
    </div>
  );
}

export function SettingsFields({
  form,
  pt,
  link,
}: Readonly<{
  form: UseFormReturn<CockpitCardFormValues>;
  pt: Translate;
  link: string;
}>) {
  return (
    <div className="space-y-4">
      <LinkFields form={form} pt={pt} link={link} />
      <PublicationField form={form} pt={pt} />
      <WeightField form={form} pt={pt} />
      <VisibilityField form={form} pt={pt} />
    </div>
  );
}

type FieldProps = Readonly<{ form: UseFormReturn<CockpitCardFormValues>; pt: Translate }>;

export function HeadingField({ form, pt }: FieldProps) {
  return (
    <StudioField id="cockpit-card-heading" label={pt('fields.heading')} required>
      <Input
        aria-required="true"
        id="cockpit-card-heading"
        aria-invalid={Boolean(form.formState.errors.heading)}
        {...form.register('heading')}
      />
    </StudioField>
  );
}

function LanguageField({ form, pt }: FieldProps) {
  return (
    <StudioField
      id="cockpit-card-language"
      label={pt('fields.languageCode')}
      description={pt('create.languageHelp')}
    >
      <Input
        id="cockpit-card-language"
        aria-describedby="cockpit-card-language-description"
        aria-invalid={Boolean(form.formState.errors.languageCode)}
        {...form.register('languageCode')}
      />
    </StudioField>
  );
}

function PublicationField({ form, pt }: FieldProps) {
  return (
    <StudioField
      id="cockpit-card-publication"
      label={pt('fields.publicationDate')}
      description={pt('create.dateHelp')}
    >
      <Input
        aria-describedby="cockpit-card-publication-description"
        id="cockpit-card-publication"
        {...form.register('publicationDate')}
      />
    </StudioField>
  );
}

function WeightField({ form, pt }: FieldProps) {
  return (
    <StudioField
      id="cockpit-card-weight"
      label={pt('fields.sortWeight')}
      required
      description={pt('create.weightHelp')}
    >
      <Input
        id="cockpit-card-weight"
        aria-required="true"
        aria-describedby="cockpit-card-weight-description"
        type="number"
        aria-invalid={Boolean(form.formState.errors.sortWeight)}
        {...form.register('sortWeight', { valueAsNumber: true })}
      />
    </StudioField>
  );
}

function VisibilityField({ form, pt }: FieldProps) {
  return (
    <StudioField id="cockpit-card-visible" label={pt('fields.visible')}>
      <Controller
        control={form.control}
        name="visible"
        render={({ field }) => (
          <Checkbox
            id="cockpit-card-visible"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
    </StudioField>
  );
}

function LinkFields({ form, pt, link }: FieldProps & Readonly<{ link: string }>) {
  return (
    <StudioDetailCard title={pt('fields.link')} description={pt('create.optional')}>
      <StudioField id="cockpit-card-link" label={pt('fields.link')}>
        <Input
          id="cockpit-card-link"
          type="url"
          aria-invalid={Boolean(form.formState.errors.link)}
          {...form.register('link')}
        />
      </StudioField>
      <StudioField id="cockpit-card-link-text" label={pt('fields.linkText')}>
        <Input id="cockpit-card-link-text" disabled={!link.trim()} {...form.register('linkText')} />
      </StudioField>
      <StudioField id="cockpit-card-open-new-tab" label={pt('fields.openInNewTab')}>
        <Controller
          control={form.control}
          name="openInNewTab"
          render={({ field }) => (
            <Checkbox
              id="cockpit-card-open-new-tab"
              checked={field.value}
              disabled={!link.trim()}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
            />
          )}
        />
      </StudioField>
    </StudioDetailCard>
  );
}

function CategoryField({
  form,
  pt,
  options,
  categoriesState,
}: FieldProps &
  Readonly<{
    options: readonly { id: string; name: string }[];
    categoriesState: 'loading' | 'error' | 'ready';
  }>) {
  return (
    <StudioField id="cockpit-card-category" label={pt('fields.category')} required>
      <Select
        aria-required="true"
        id="cockpit-card-category"
        aria-invalid={Boolean(form.formState.errors.category)}
        disabled={categoriesState === 'loading'}
        {...form.register('category')}
      >
        <option value="">
          {categoriesState === 'loading' ? pt('messages.categoriesLoading') : ''}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.name}>
            {option.name}
          </option>
        ))}
      </Select>
      {categoriesState === 'error' ? (
        <p role="alert" className="text-sm text-destructive">
          {pt('messages.categoriesError')}
        </p>
      ) : null}
    </StudioField>
  );
}

export function CockpitCardCreateSettings(
  props: FieldProps &
    Readonly<{
      link: string;
      options: readonly { id: string; name: string }[];
      categoriesState: 'loading' | 'error' | 'ready';
    }>
) {
  return (
    <div className="space-y-4">
      <details>
        <summary>{props.pt('fields.link')}</summary>
        <LinkFields {...props} />
      </details>
      <details>
        <summary>{props.pt('fields.category')}</summary>
        <CategoryField {...props} />
      </details>
      <LanguageField {...props} />
      <WeightField {...props} />
      <PublicationField {...props} />
      <VisibilityField {...props} />
    </div>
  );
}
