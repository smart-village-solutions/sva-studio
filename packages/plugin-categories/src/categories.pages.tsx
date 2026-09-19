import React from 'react';
import { readSessionAccessSnapshot, subscribeSessionAccessSnapshot } from '@sva/plugin-sdk';
import { Button, StudioFormSummary, StudioOverviewPageTemplate } from '@sva/studio-ui-react';

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

export function CategoriesPage({
  dataTypeOptions = [],
}: Readonly<{ dataTypeOptions?: readonly CategoryDataTypeOption[] }>) {
  const pt = useTranslator();
  const access = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const state = useCategoryPageState(pt);
  const selection = usePageSelection();
  const [notice, setNotice] = React.useState<string | null>(null);
  const can = (action: string) => access.permissionActions.includes(action);
  const reloadAfterSave = async (affectedIds: readonly string[]) => {
    const reloaded = await state.reload();
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
          onUncertainCreate={async () => {
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
