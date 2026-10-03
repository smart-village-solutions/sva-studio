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
      <StudioField id="cockpit-card-heading" label={pt('fields.heading')}>
        <Input
          id="cockpit-card-heading"
          aria-invalid={Boolean(form.formState.errors.heading)}
          {...form.register('heading')}
        />
      </StudioField>
      <StudioField id="cockpit-card-language" label={pt('fields.languageCode')}>
        <Input
          id="cockpit-card-language"
          aria-invalid={Boolean(form.formState.errors.languageCode)}
          {...form.register('languageCode')}
        />
      </StudioField>
      <StudioField id="cockpit-card-category" label={pt('fields.category')}>
        <Select
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
      <StudioDetailCard title={pt('fields.link')}>
        <StudioField id="cockpit-card-link" label={pt('fields.link')}>
          <Input
            id="cockpit-card-link"
            type="url"
            aria-invalid={Boolean(form.formState.errors.link)}
            {...form.register('link')}
          />
        </StudioField>
        <StudioField id="cockpit-card-link-text" label={pt('fields.linkText')}>
          <Input
            id="cockpit-card-link-text"
            disabled={!link.trim()}
            {...form.register('linkText')}
          />
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
      <StudioField id="cockpit-card-publication" label={pt('fields.publicationDate')}>
        <Input id="cockpit-card-publication" {...form.register('publicationDate')} />
      </StudioField>
      <StudioField id="cockpit-card-weight" label={pt('fields.sortWeight')}>
        <Input
          id="cockpit-card-weight"
          type="number"
          aria-invalid={Boolean(form.formState.errors.sortWeight)}
          {...form.register('sortWeight', { valueAsNumber: true })}
        />
      </StudioField>
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
    </div>
  );
}
