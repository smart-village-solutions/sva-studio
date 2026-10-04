import { Link } from '@tanstack/react-router';
import {
  Button,
  ContentOwnershipSaveHint,
  StudioDetailPageTemplate,
  StudioSaveButton,
} from '@sva/studio-ui-react';
import {
  GenericItemsMediaPickerView,
  GenericItemsStatusView,
  GenericItemsDeleteDialogView,
  type GenericItemsDetailPageViewModel,
} from './generic-items.detail-page.view-content.js';
import { GenericItemsEditorTabsView } from './generic-items.detail-page.view-tabs.js';
import type { useGenericItemsPageSave } from './generic-items.detail-page.save.js';

const genericItemsListLink = {
  to: '/admin/content',
  search: { type: 'generic-items.generic-item' },
} as const;

const DetailPageActions = ({
  canDelete,
  disableActions,
  mode,
  deleting,
  onDelete,
  pt,
}: Readonly<{
  canDelete: boolean;
  disableActions: boolean;
  deleting: boolean;
  mode: 'create' | 'edit';
  onDelete: () => void;
  pt: (key: string) => string;
}>) => (
  <div className="flex gap-2">
    <Button asChild variant="secondary">
      <Link {...genericItemsListLink}>{pt('actions.back')}</Link>
    </Button>
    {mode === 'edit' && canDelete ? (
      <Button
        type="button"
        variant="secondary"
        disabled={disableActions || deleting}
        onClick={onDelete}
      >
        {pt('actions.delete')}
      </Button>
    ) : null}
  </div>
);

export const GenericItemsDetailPageView = ({
  view,
  canSave,
  mediaSavePhaseKey,
  onSubmit,
}: Readonly<{
  view: GenericItemsDetailPageViewModel;
  canSave: boolean;
  mediaSavePhaseKey: string | null;
  onSubmit: ReturnType<typeof useGenericItemsPageSave>;
}>) => {
  const {
    mode,
    pt,
    saveFeedback,
    accessCapabilities,
    methods,
    deleting,
    setStatus,
    setDeleteDialogOpen,
  } = view;
  return (
    <StudioDetailPageTemplate
      title={mode === 'create' ? pt('editor.createTitle') : pt('editor.editTitle')}
      description={
        mode === 'create' ? pt('editor.createDescription') : pt('editor.editDescription')
      }
      primaryAction={
        canSave ? (
          <div className="flex flex-col items-end gap-1">
            <ContentOwnershipSaveHint />
            <StudioSaveButton
              type="button"
              status={saveFeedback.status}
              onClick={() => void onSubmit()}
              labels={{
                idle: mode === 'create' ? pt('actions.create') : pt('actions.update'),
                saving: mediaSavePhaseKey ? pt(mediaSavePhaseKey) : pt('actions.saving'),
                saved: pt('actions.saved'),
              }}
            />
          </div>
        ) : undefined
      }
      actions={
        <DetailPageActions
          canDelete={accessCapabilities.canDelete}
          disableActions={methods.formState.isSubmitting}
          deleting={deleting}
          mode={mode}
          onDelete={() => {
            setStatus(null);
            setDeleteDialogOpen(true);
          }}
          pt={pt}
        />
      }
    >
      <GenericItemsMediaPickerView view={view} />
      <GenericItemsStatusView view={view} />
      <GenericItemsEditorTabsView view={view} />
      <GenericItemsDeleteDialogView view={view} />
    </StudioDetailPageTemplate>
  );
};
