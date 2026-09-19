import { Checkbox, Input, Select, StudioField } from '@sva/studio-ui-react';

import type { Draft, DraftErrors, DraftField, Translator } from './categories.page-support.js';
import type { CategoryDataTypeOption, CategoryManagementItem } from './categories.types.js';

export const categoryFieldIds: Record<DraftField, string> = {
  name: 'category-name',
  parentId: 'category-parent',
  position: 'category-position',
  iconName: 'category-icon',
  email: 'category-email',
  dataTypes: 'category-types',
};

type FieldProps = Readonly<{
  draft: Draft;
  errors: DraftErrors;
  pending: boolean;
  pt: Translator;
  update: (change: Partial<Draft>) => void;
  control: (field: DraftField) => {
    id: string;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
  };
}>;

export function CategoryIdentityFields({
  draft,
  errors,
  pending,
  pt,
  update,
  control,
  categories,
  excluded,
}: FieldProps &
  Readonly<{
    categories: readonly CategoryManagementItem[];
    excluded: ReadonlySet<string>;
  }>) {
  return (
    <>
      <StudioField
        id={categoryFieldIds.name}
        label={pt('fields.name')}
        required
        error={errors.name}
        controlProps={control('name')}
      >
        <Input
          value={draft.name}
          disabled={pending}
          onChange={(event) => update({ name: event.target.value })}
        />
      </StudioField>
      <StudioField
        id={categoryFieldIds.parentId}
        label={pt('fields.parent')}
        error={errors.parentId}
        controlProps={control('parentId')}
      >
        <Select
          value={draft.parentId ?? ''}
          disabled={pending}
          onChange={(event) => update({ parentId: event.target.value || null })}
        >
          <option value="">{pt('values.root')}</option>
          {categories
            .filter((item) => !excluded.has(item.id))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </Select>
      </StudioField>
      <StudioField
        id={categoryFieldIds.position}
        label={pt('fields.position')}
        error={errors.position}
        controlProps={control('position')}
      >
        <Input
          type="number"
          min="0"
          step="1"
          value={draft.position ?? ''}
          disabled={pending}
          onChange={(event) =>
            update({ position: event.target.value === '' ? null : Number(event.target.value) })
          }
        />
      </StudioField>
    </>
  );
}

export function CategoryOptionalFields({
  draft,
  errors,
  pending,
  pt,
  update,
  control,
}: FieldProps) {
  return (
    <>
      <StudioField
        id={categoryFieldIds.iconName}
        label={pt('fields.icon')}
        error={errors.iconName}
        controlProps={control('iconName')}
      >
        <Input
          value={draft.iconName ?? ''}
          disabled={pending}
          onChange={(event) => update({ iconName: event.target.value || null })}
        />
      </StudioField>
      <StudioField
        id={categoryFieldIds.email}
        label={pt('fields.email')}
        error={errors.email}
        controlProps={control('email')}
      >
        <Input
          type="email"
          value={draft.email ?? ''}
          disabled={pending}
          onChange={(event) => update({ email: event.target.value || null })}
        />
      </StudioField>
      <StudioField id="category-active" label={pt('fields.active')}>
        <Checkbox
          id="category-active"
          checked={draft.active}
          disabled={pending}
          onChange={(event) => update({ active: event.target.checked })}
        />
      </StudioField>
    </>
  );
}

export function CategoryDataTypeField({
  draft,
  errors,
  pending,
  pt,
  update,
  control,
  options,
}: FieldProps & Readonly<{ options: readonly CategoryDataTypeOption[] }>) {
  return (
    <StudioField
      id={categoryFieldIds.dataTypes}
      label={pt('fields.dataTypes')}
      error={errors.dataTypes}
      controlProps={control('dataTypes')}
    >
      <Select
        multiple
        value={draft.dataTypes}
        disabled={pending}
        onChange={(event) =>
          update({
            dataTypes: Array.from(event.currentTarget.selectedOptions, (option) => option.value),
          })
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </StudioField>
  );
}
