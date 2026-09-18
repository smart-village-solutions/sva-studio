import React from 'react';
import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  translatePluginKey,
} from '@sva/plugin-sdk';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  StudioDataTable,
  StudioDestructiveActionDialog,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  type StudioColumnDef,
  type StudioDataTableLabels,
} from '@sva/studio-ui-react';

import {
  deleteCategory,
  flattenCategoryManagementForTable,
  listCategoryManagement,
  saveCategory,
  type CategoryManagementItem,
  type CategoryTableRow,
} from './categories.api.js';
import type { CategorySaveInput } from './categories.types.js';

type Translator = (key: string, variables?: Readonly<Record<string, string | number>>) => string;
export type CategoryDataTypeOption = Readonly<{ value: string; label: string }>;
type Draft = CategorySaveInput;
type PageState = {
  categories: readonly CategoryManagementItem[];
  rows: readonly CategoryTableRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const tableLabels = (pt: Translator): StudioDataTableLabels => ({
  selectionColumn: pt('fields.actions'),
  actionsColumn: pt('fields.actions'),
  loading: pt('messages.loading'),
  selectAllRows: (label) => label,
  selectRow: ({ label }) => label,
  selectMobileRow: ({ label }) => label,
});
const initialDraft = (parentId: string | null = null): Draft => ({
  name: '',
  active: true,
  parentId,
  position: null,
  iconName: null,
  email: null,
  dataTypes: [],
});
const categoryDraft = (item: CategoryManagementItem): Draft => ({
  name: item.name,
  active: item.active,
  parentId: item.parent?.id ?? null,
  position: item.position ?? null,
  iconName: item.iconName ?? null,
  email: item.email ?? null,
  dataTypes: item.dataTypes,
});
const useTranslator = (): Translator =>
  React.useCallback((key, variables) => translatePluginKey('categories', key, variables), []);
const messageFor = (error: unknown, pt: Translator) => {
  const code =
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : '';
  switch (code) {
    case 'missing_credentials':
    case 'organization_mainserver_credentials_missing':
      return pt('messages.loadErrorMissingCredentials');
    case 'integration_disabled':
      return pt('messages.loadErrorIntegrationDisabled');
    case 'config_not_found':
      return pt('messages.loadErrorConfigMissing');
    case 'forbidden':
      return pt('messages.loadErrorForbidden');
    case 'category_management_invalid_response':
      return pt('messages.contractError');
    default:
      return pt('messages.loadError');
  }
};
const descendantsOf = (item: CategoryManagementItem, items: readonly CategoryManagementItem[]) => {
  const result = new Set<string>();
  const pending = [item.id];
  while (pending.length) {
    const parentId = pending.pop();
    for (const candidate of items)
      if (candidate.parent?.id === parentId && !result.has(candidate.id)) {
        result.add(candidate.id);
        pending.push(candidate.id);
      }
  }
  return result;
};
const usePageState = (pt: Translator): PageState => {
  const [categories, setCategories] = React.useState<readonly CategoryManagementItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCategories(await listCategoryManagement());
    } catch (caught) {
      setCategories([]);
      setError(messageFor(caught, pt));
    } finally {
      setLoading(false);
    }
  }, [pt]);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  return {
    categories,
    rows: flattenCategoryManagementForTable(categories),
    loading,
    error,
    reload,
  };
};

function CategoryEditor({
  category,
  parentId,
  categories,
  options,
  pt,
  onClose,
  onSaved,
}: Readonly<{
  category: CategoryManagementItem | null;
  parentId: string | null;
  categories: readonly CategoryManagementItem[];
  options: readonly CategoryDataTypeOption[];
  pt: Translator;
  onClose: () => void;
  onSaved: () => Promise<void>;
}>) {
  const [draft, setDraft] = React.useState<Draft>(() =>
    category ? categoryDraft(category) : initialDraft(parentId)
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setDraft(category ? categoryDraft(category) : initialDraft(parentId));
    setError(null);
  }, [category, parentId]);
  const excluded = category ? descendantsOf(category, categories) : new Set<string>();
  if (category) excluded.add(category.id);
  const unknown = draft.dataTypes.filter(
    (value) => !options.some((option) => option.value === value)
  );
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError(pt('messages.nameRequired'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await saveCategory({
        id: category?.id,
        idempotencyKey: category ? undefined : crypto.randomUUID(),
        category: {
          ...draft,
          name: draft.name.trim(),
          email: draft.email?.trim() || null,
          iconName: draft.iconName?.trim() || null,
        },
      });
      if (!result.category || result.errors.length) {
        setError(result.errors[0]?.message ?? pt('messages.mutationError'));
        return;
      }
      await onSaved();
      onClose();
    } catch (caught) {
      setError(messageFor(caught, pt));
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle>{category ? pt('form.editTitle') : pt('form.createTitle')}</DialogTitle>
            <DialogDescription>{pt('form.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <StudioField id="category-name" label={pt('fields.name')}>
              <Input
                id="category-name"
                value={draft.name}
                disabled={pending}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </StudioField>
            <StudioField id="category-parent" label={pt('fields.parent')}>
              <Select
                id="category-parent"
                value={draft.parentId ?? ''}
                disabled={pending}
                onChange={(event) => setDraft({ ...draft, parentId: event.target.value || null })}
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
            <StudioField id="category-position" label={pt('fields.position')}>
              <Input
                id="category-position"
                type="number"
                min="0"
                value={draft.position ?? ''}
                disabled={pending}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    position: event.target.value === '' ? null : Number(event.target.value),
                  })
                }
              />
            </StudioField>
            <StudioField id="category-icon" label={pt('fields.icon')}>
              <Input
                id="category-icon"
                value={draft.iconName ?? ''}
                disabled={pending}
                onChange={(event) => setDraft({ ...draft, iconName: event.target.value || null })}
              />
            </StudioField>
            <StudioField id="category-email" label={pt('fields.email')}>
              <Input
                id="category-email"
                type="email"
                value={draft.email ?? ''}
                disabled={pending}
                onChange={(event) => setDraft({ ...draft, email: event.target.value || null })}
              />
            </StudioField>
            <StudioField id="category-types" label={pt('fields.dataTypes')}>
              <Select
                id="category-types"
                multiple
                value={draft.dataTypes}
                disabled={pending}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    dataTypes: Array.from(
                      event.currentTarget.selectedOptions,
                      (option) => option.value
                    ),
                  })
                }
              >
                {[
                  ...options,
                  ...unknown.map((value) => ({
                    value,
                    label: pt('values.unavailableType', { value }),
                  })),
                ].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </StudioField>
            <label className="flex min-h-11 items-center gap-2">
              <Checkbox
                checked={draft.active}
                disabled={pending}
                onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
              />
              <span>{pt('fields.active')}</span>
            </label>
            {error ? <StudioFormSummary kind="error">{error}</StudioFormSummary> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              {pt('actions.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? pt('actions.saving') : pt('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoriesPage({
  dataTypeOptions = [],
}: Readonly<{ dataTypeOptions?: readonly CategoryDataTypeOption[] }>) {
  const pt = useTranslator();
  const access = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const state = usePageState(pt);
  const [editing, setEditing] = React.useState<CategoryManagementItem | null>(null);
  const [creatingParent, setCreatingParent] = React.useState<string | null | undefined>(undefined);
  const [deleting, setDeleting] = React.useState<CategoryManagementItem | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const can = (action: string) => access.permissionActions.includes(action);
  const columns = React.useMemo<readonly StudioColumnDef<CategoryTableRow>[]>(
    () => [
      {
        id: 'active',
        header: pt('fields.status'),
        cell: (row) => (row.active === false ? pt('values.inactive') : pt('values.active')),
      },
      { id: 'name', header: pt('fields.name'), cell: (row) => row.name },
      { id: 'hierarchy', header: pt('fields.hierarchy'), cell: (row) => row.hierarchyLabel },
      {
        id: 'position',
        header: pt('fields.position'),
        cell: (row) => row.position ?? pt('values.notAvailable'),
      },
      {
        id: 'tags',
        header: pt('fields.dataTypes'),
        cell: (row) => row.tags.join(', ') || pt('values.notAvailable'),
      },
    ],
    [pt]
  );
  const remove = async () => {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const result = await deleteCategory(deleting.id);
      if (!result.deletedCategoryId || result.errors.length) {
        setDeleteError(result.errors[0]?.message ?? pt('messages.deleteBlocked'));
        return;
      }
      await state.reload();
      setDeleting(null);
    } catch (caught) {
      setDeleteError(messageFor(caught, pt));
    } finally {
      setDeletePending(false);
    }
  };
  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      toolbar={
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {pt('table.countLabel', { count: state.rows.length })}
          </span>
          {can('categories.create') ? (
            <Button type="button" onClick={() => setCreatingParent(null)}>
              {pt('actions.create')}
            </Button>
          ) : null}
        </div>
      }
    >
      {state.loading ? (
        <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>
      ) : state.error ? (
        <div className="space-y-3">
          <StudioErrorState>{state.error}</StudioErrorState>
          <Button type="button" variant="secondary" onClick={() => void state.reload()}>
            {pt('actions.reload')}
          </Button>
        </div>
      ) : state.rows.length === 0 ? (
        <StudioEmptyState>
          <h2 className="text-lg font-medium">{pt('empty.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{pt('empty.description')}</p>
        </StudioEmptyState>
      ) : (
        <StudioDataTable
          sorting={{ mode: 'disabled' }}
          ariaLabel={pt('table.ariaLabel')}
          caption={pt('table.caption')}
          labels={tableLabels(pt)}
          data={state.rows}
          columns={columns}
          rowActions={(row) => {
            const item = state.categories.find((candidate) => candidate.id === row.id);
            return (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!item || !can('categories.update')}
                  onClick={() => item && setEditing(item)}
                >
                  {pt('actions.edit')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!item || !can('categories.create')}
                  onClick={() => item && setCreatingParent(item.id)}
                >
                  {pt('actions.createChild')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={!item || !can('categories.delete')}
                  onClick={() => item && setDeleting(item)}
                >
                  {pt('actions.delete')}
                </Button>
              </div>
            );
          }}
          emptyState={null}
          getRowId={(row) => row.id}
          selectionMode="none"
        />
      )}
      {editing || creatingParent !== undefined ? (
        <CategoryEditor
          category={editing}
          parentId={creatingParent ?? null}
          categories={state.categories}
          options={dataTypeOptions}
          pt={pt}
          onClose={() => {
            setEditing(null);
            setCreatingParent(undefined);
          }}
          onSaved={state.reload}
        />
      ) : null}
      <StudioDestructiveActionDialog
        open={deleting !== null}
        title={pt('deleteDialog.title')}
        description={pt('deleteDialog.description', { target: deleting?.name ?? '' })}
        confirmLabel={pt('deleteDialog.confirm')}
        pendingLabel={pt('deleteDialog.pending')}
        cancelLabel={pt('actions.cancel')}
        pending={deletePending}
        errorMessage={deleteError}
        onConfirm={() => void remove()}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
      />
    </StudioOverviewPageTemplate>
  );
}
