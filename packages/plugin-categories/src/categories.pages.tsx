import React from 'react';
import { readSessionAccessSnapshot, subscribeSessionAccessSnapshot } from '@sva/plugin-sdk';
import {
  Button,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
} from '@sva/studio-ui-react';

import { CategoryDeleteDialog } from './categories.delete-dialog.js';
import { CategoryEditor } from './categories.editor.js';
import { useCategoryPageState } from './categories.page-state.js';
import { useTranslator, type Translator } from './categories.page-support.js';
import { CategoriesTableView } from './categories.table.js';
import type { CategoryDataTypeOption, CategoryManagementItem } from './categories.types.js';

export type { CategoryDataTypeOption } from './categories.types.js';

const Toolbar = ({
  count,
  canCreate,
  pt,
  onCreate,
}: Readonly<{
  count: number;
  canCreate: boolean;
  pt: Translator;
  onCreate: () => void;
}>) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-muted-foreground">{pt('table.countLabel', { count })}</span>
    {canCreate ? (
      <Button type="button" onClick={onCreate}>
        {pt('actions.create')}
      </Button>
    ) : null}
  </div>
);

const MutationActionsStatus = ({
  error,
  loading,
  pt,
  onReload,
}: Readonly<{
  error: boolean;
  loading: boolean;
  pt: Translator;
  onReload: (() => void) | undefined;
}>) => {
  if (loading)
    return <StudioLoadingState>{pt('messages.mutationActionsLoading')}</StudioLoadingState>;
  if (!error) return null;
  return (
    <div className="space-y-3">
      <StudioFormSummary kind="error">{pt('messages.mutationActionsLoadError')}</StudioFormSummary>
      {onReload ? (
        <Button type="button" variant="secondary" onClick={onReload}>
          {pt('actions.reload')}
        </Button>
      ) : null}
    </div>
  );
};

const usePageSelection = () => {
  const [editing, setEditing] = React.useState<CategoryManagementItem | null>(null);
  const [creatingParent, setCreatingParent] = React.useState<string | null | undefined>(undefined);
  const [deleting, setDeleting] = React.useState<CategoryManagementItem | null>(null);
  const closeEditor = () => {
    setEditing(null);
    setCreatingParent(undefined);
  };
  return {
    editing,
    creatingParent,
    deleting,
    setEditing,
    setDeleting,
    createRoot: () => setCreatingParent(null),
    createChild: (item: CategoryManagementItem) => setCreatingParent(item.id),
    closeEditor,
  };
};

const useCategoryMutationAccess = (enabledMutationActions?: readonly string[]) => {
  const access = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  return (action: string) =>
    access.permissionActions.includes(action) &&
    (enabledMutationActions === undefined || enabledMutationActions.includes(action));
};

export function CategoriesPage({
  dataTypeOptions = [],
  enabledMutationActions,
  mutationActionsError = false,
  mutationActionsLoading = false,
  onReloadMutationActions,
}: Readonly<{
  dataTypeOptions?: readonly CategoryDataTypeOption[];
  enabledMutationActions?: readonly string[];
  mutationActionsError?: boolean;
  mutationActionsLoading?: boolean;
  onReloadMutationActions?: () => void;
}>) {
  const pt = useTranslator();
  const can = useCategoryMutationAccess(enabledMutationActions);
  const state = useCategoryPageState(pt);
  const selection = usePageSelection();
  const [notice, setNotice] = React.useState<string | null>(null);
  const reloadAfterSave = async (affectedIds: readonly string[]) => {
    const reloaded = (await state.reload()) !== null;
    const key = reloaded
      ? affectedIds.length
        ? 'messages.savedWithDescendants'
        : 'messages.saved'
      : 'messages.savedReloadFailed';
    setNotice(pt(key, { count: affectedIds.length }));
  };
  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      toolbar={
        <Toolbar
          count={state.rows.length}
          canCreate={can('categories.create')}
          pt={pt}
          onCreate={selection.createRoot}
        />
      }
    >
      {notice ? <StudioFormSummary kind="success">{notice}</StudioFormSummary> : null}
      <MutationActionsStatus
        error={mutationActionsError}
        loading={mutationActionsLoading}
        pt={pt}
        onReload={onReloadMutationActions}
      />
      <CategoriesTableView
        {...state}
        can={can}
        pt={pt}
        onReload={() => void state.reload()}
        onEdit={selection.setEditing}
        onCreateChild={selection.createChild}
        onDelete={selection.setDeleting}
      />
      {selection.editing || selection.creatingParent !== undefined ? (
        <CategoryEditor
          category={selection.editing}
          parentId={selection.creatingParent ?? null}
          categories={state.categories}
          options={dataTypeOptions}
          pt={pt}
          onClose={selection.closeEditor}
          onSaved={reloadAfterSave}
          onUncertainSave={async () => {
            await state.reload();
          }}
        />
      ) : null}
      <CategoryDeleteDialog
        category={selection.deleting}
        pt={pt}
        reload={state.reload}
        onClose={() => selection.setDeleting(null)}
        onNotice={setNotice}
      />
    </StudioOverviewPageTemplate>
  );
}
