import React from 'react';

import { saveCategory } from './categories.api.js';
import { categoryFieldIds } from './categories.editor-fields.js';
import {
  categoryDraft,
  descendantsOf,
  initialDraft,
  messageFor,
  normalizeDraft,
  selectableDataTypeOptions,
  type Draft,
  type DraftErrors,
  type DraftField,
  type Translator,
} from './categories.page-support.js';
import type { CategoryDataTypeOption, CategoryManagementItem } from './categories.types.js';

export type CategoryEditorProps = Readonly<{
  category: CategoryManagementItem | null;
  parentId: string | null;
  categories: readonly CategoryManagementItem[];
  options: readonly CategoryDataTypeOption[];
  pt: Translator;
  onClose: () => void;
  onSaved: (affectedDescendantIds: readonly string[]) => Promise<void>;
  onUncertainCreate: () => Promise<void>;
}>;

const errorField = (field?: string): DraftField | undefined => {
  if (field === 'parent') return 'parentId';
  return field && Object.prototype.hasOwnProperty.call(categoryFieldIds, field)
    ? (field as DraftField)
    : undefined;
};

const mappedErrors = (errors: readonly Readonly<{ field?: string; message: string }>[]) => {
  const fields: DraftErrors = {};
  for (const error of errors) {
    const field = errorField(error.field);
    if (field && !fields[field]) fields[field] = error.message;
  }
  return fields;
};

const attemptKey = (
  attempt: React.MutableRefObject<{ signature: string; key: string } | null>,
  value: Draft
) => {
  const signature = JSON.stringify(value);
  if (attempt.current?.signature !== signature)
    attempt.current = { signature, key: crypto.randomUUID() };
  return attempt.current.key;
};

const usePersistCategory = (input: {
  props: CategoryEditorProps;
  attempt: React.MutableRefObject<{ signature: string; key: string } | null>;
  setPending: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setFieldErrors: React.Dispatch<React.SetStateAction<DraftErrors>>;
}) =>
  React.useCallback(
    async (value: Draft) => {
      input.setPending(true);
      input.setError(null);
      input.setFieldErrors({});
      try {
        const result = await saveCategory({
          id: input.props.category?.id,
          idempotencyKey: input.props.category ? undefined : attemptKey(input.attempt, value),
          category: value,
        });
        if (!result.category || result.errors.length) {
          const fields = mappedErrors(result.errors);
          input.setFieldErrors(fields);
          input.setError(
            result.errors.find((error) => !errorField(error.field))?.message ??
              (Object.keys(fields).length ? null : input.props.pt('messages.mutationError'))
          );
          return;
        }
        input.attempt.current = null;
        await input.props.onSaved(result.affectedDescendantIds);
        input.props.onClose();
      } catch (caught) {
        if (!input.props.category) await input.props.onUncertainCreate();
        input.setError(messageFor(caught, input.props.pt));
      } finally {
        input.setPending(false);
      }
    },
    [input]
  );

export const useCategoryEditorController = (props: CategoryEditorProps) => {
  const [draft, setDraft] = React.useState<Draft>(() =>
    props.category ? categoryDraft(props.category) : initialDraft(props.parentId)
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<DraftErrors>({});
  const [confirmationDraft, setConfirmationDraft] = React.useState<Draft | null>(null);
  const attempt = React.useRef<{ signature: string; key: string } | null>(null);
  React.useEffect(() => {
    setDraft(props.category ? categoryDraft(props.category) : initialDraft(props.parentId));
    setError(null);
    setFieldErrors({});
    setConfirmationDraft(null);
    attempt.current = null;
  }, [props.category, props.parentId]);
  React.useEffect(() => {
    const field = (Object.keys(categoryFieldIds) as DraftField[]).find((key) => fieldErrors[key]);
    if (field) document.getElementById(categoryFieldIds[field])?.focus();
  }, [fieldErrors]);
  const descendants = props.category
    ? descendantsOf(props.category, props.categories)
    : new Set<string>();
  const excluded = new Set(descendants);
  if (props.category) excluded.add(props.category.id);
  const baseOptions = selectableDataTypeOptions(props.options, props.pt);
  const options = [
    ...baseOptions,
    ...draft.dataTypes
      .filter((value) => !baseOptions.some((option) => option.value === value))
      .map((value) => ({ value, label: props.pt('values.unavailableType', { value }) })),
  ];
  const persist = usePersistCategory({ props, attempt, setPending, setError, setFieldErrors });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeDraft(draft, props.pt);
    setFieldErrors(normalized.errors);
    setError(null);
    if (Object.keys(normalized.errors).length) return;
    if (props.category && normalized.value.active !== props.category.active && descendants.size)
      setConfirmationDraft(normalized.value);
    else void persist(normalized.value);
  };
  const control = (field: DraftField) => ({
    id: categoryFieldIds[field],
    ...(fieldErrors[field]
      ? { 'aria-invalid': true as const, 'aria-describedby': `${categoryFieldIds[field]}-error` }
      : {}),
  });
  return {
    draft,
    pending,
    error,
    fieldErrors,
    confirmationDraft,
    descendants,
    excluded,
    options,
    control,
    submit,
    update: (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change })),
    cancelConfirmation: () => setConfirmationDraft(null),
    confirm: () => {
      const value = confirmationDraft;
      setConfirmationDraft(null);
      if (value) void persist(value);
    },
  };
};
