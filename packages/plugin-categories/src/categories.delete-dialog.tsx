import React from 'react';
import { StudioDestructiveActionDialog } from '@sva/studio-ui-react';

import { deleteCategory } from './categories.api.js';
import { messageFor, type Translator } from './categories.page-support.js';
import type { CategoryManagementItem, CategoryUsage } from './categories.types.js';

const usageEntries = (usage: CategoryUsage, pt: Translator) =>
  [
    [pt('deleteDialog.usage.children'), usage.children],
    [pt('deleteDialog.usage.resourceAssignments'), usage.resourceAssignments],
    [pt('deleteDialog.usage.externalServiceAssignments'), usage.externalServiceAssignments],
    [pt('deleteDialog.usage.dataResourceSettings'), usage.dataResourceSettings],
    [pt('deleteDialog.usage.notificationConfigurations'), usage.notificationConfigurations],
  ] as const;

const useDeleteController = (
  props: Readonly<{
    category: CategoryManagementItem | null;
    pt: Translator;
    reload: () => Promise<boolean>;
    onClose: () => void;
    onNotice: (notice: string) => void;
  }>
) => {
  const [error, setError] = React.useState<string | null>(null);
  const [usage, setUsage] = React.useState<CategoryUsage | null>(null);
  const [pending, setPending] = React.useState(false);
  const close = () => {
    setError(null);
    setUsage(null);
    props.onClose();
  };
  const remove = async () => {
    if (!props.category) return;
    setPending(true);
    setError(null);
    setUsage(null);
    try {
      const result = await deleteCategory(props.category.id);
      if (!result.deletedCategoryId || result.errors.length) {
        if (result.errors.some((entry) => entry.code === 'CATEGORY_NOT_FOUND')) {
          await props.reload();
        }
        setError(result.errors[0]?.message ?? props.pt('messages.deleteBlocked'));
        setUsage(result.usage);
        return;
      }
      const reloaded = await props.reload();
      props.onNotice(props.pt(reloaded ? 'messages.deleted' : 'messages.deletedReloadFailed'));
      close();
    } catch (caught) {
      await props.reload();
      setError(messageFor(caught, props.pt));
    } finally {
      setPending(false);
    }
  };
  return { error, usage, pending, close, remove };
};

export function CategoryDeleteDialog(
  props: Readonly<{
    category: CategoryManagementItem | null;
    pt: Translator;
    reload: () => Promise<boolean>;
    onClose: () => void;
    onNotice: (notice: string) => void;
  }>
) {
  const state = useDeleteController(props);
  return (
    <StudioDestructiveActionDialog
      open={props.category !== null}
      title={props.pt('deleteDialog.title')}
      description={props.pt('deleteDialog.description', { target: props.category?.name ?? '' })}
      confirmLabel={props.pt('deleteDialog.confirm')}
      pendingLabel={props.pt('deleteDialog.pending')}
      cancelLabel={props.pt('actions.cancel')}
      pending={state.pending}
      errorMessage={state.error}
      onConfirm={() => void state.remove()}
      onCancel={state.close}
    >
      {state.usage ? (
        <dl className="space-y-1 text-sm">
          {usageEntries(state.usage, props.pt).map(([label, count]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt>{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </StudioDestructiveActionDialog>
  );
}
