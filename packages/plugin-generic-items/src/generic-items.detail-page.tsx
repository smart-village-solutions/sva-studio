import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioDetailPageTemplate,
  StudioFormSummary,
  StudioFormSummaryErrors,
  StudioLoadingState,
} from '@sva/studio-ui-react';
import React from 'react';

import { createDefaultGenericItemsDetailFormValues } from './generic-items.detail-form.js';
import { createGenericItemsDetailLabels } from './generic-items.detail-page.labels.js';
import {
  useGenericItemsCategoryOptions,
  useGenericItemsDetailActions,
  useGenericItemsDetailLoader,
  useGenericItemsMediaAssets,
  type StatusMessage,
} from './generic-items.detail-page.state.js';
import { GenericItemsDetailTabs } from './generic-items.detail-page.tabs.js';
import { genericItemsDetailFormSchema, type GenericItemsDetailFormValues } from './generic-items.validation.js';

const createSummaryErrors = (errors: ReturnType<typeof useForm<GenericItemsDetailFormValues>>['formState']['errors']) => {
  const entries = [
    errors.title ? { field: 'generic-item-title', message: String(errors.title.message) } : null,
    errors.genericType ? { field: 'generic-item-type', message: String(errors.genericType.message) } : null,
    errors.categories ? { field: 'generic-item-categories', message: String(errors.categories.message) } : null,
    errors.payloadText ? { field: 'generic-item-payload', message: String(errors.payloadText.message) } : null,
  ];

  return entries.filter((entry): entry is { field: string; message: string } => entry !== null);
};

const DetailPageActions = ({
  disableActions,
  mode,
  deleting,
  onDelete,
  onSubmit,
  pt,
}: Readonly<{
  disableActions: boolean;
  deleting: boolean;
  mode: 'create' | 'edit';
  onDelete: () => Promise<void>;
  onSubmit: () => Promise<void>;
  pt: (key: string) => string;
}>) => (
  <div className="flex gap-2">
    <Button asChild variant="outline">
      <Link to="/admin/generic-items">{pt('actions.back')}</Link>
    </Button>
    {mode === 'edit' ? (
      <Button type="button" variant="outline" disabled={disableActions || deleting} onClick={() => void onDelete()}>
        {pt('actions.delete')}
      </Button>
    ) : null}
    <Button type="button" disabled={disableActions} onClick={() => void onSubmit()}>
      {mode === 'create' ? pt('actions.create') : pt('actions.update')}
    </Button>
  </div>
);

export function GenericItemsDetailPage({
  mode,
  contentId,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
}>) {
  const pt = usePluginTranslation('genericItems');
  const navigate = useNavigate();
  const labels = React.useMemo(() => createGenericItemsDetailLabels(pt), [pt]);
  const methods = useForm<GenericItemsDetailFormValues>({
    resolver: zodResolver(genericItemsDetailFormSchema),
    defaultValues: createDefaultGenericItemsDetailFormValues(),
  });
  const summaryErrors = React.useMemo(() => createSummaryErrors(methods.formState.errors), [methods.formState.errors]);
  const [status, setStatus] = React.useState<StatusMessage | null>(null);
  const { mediaAssets, uploadMediaFile } = useGenericItemsMediaAssets();
  const { categoryOptions, categoryOptionsError, categoryOptionsLoading } = useGenericItemsCategoryOptions(pt);
  const loading = useGenericItemsDetailLoader({ contentId, methods, mode, pt, setStatus });
  const { activeTab, deleting, handleDelete, onSubmit, setActiveTab } = useGenericItemsDetailActions({
    contentId,
    methods,
    mode,
    navigate,
    pt,
    setStatus,
  });

  if (loading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  return (
    <FormProvider {...methods}>
      <StudioDetailPageTemplate
        title={mode === 'create' ? pt('editor.createTitle') : pt('editor.editTitle')}
        description={mode === 'create' ? pt('editor.createDescription') : pt('editor.editDescription')}
        actions={
          <DetailPageActions
            disableActions={methods.formState.isSubmitting}
            deleting={deleting}
            mode={mode}
            onDelete={handleDelete}
            onSubmit={onSubmit}
            pt={pt}
          />
        }
      >
        <StudioFormSummaryErrors errors={summaryErrors} />
        {status ? (
          <StudioFormSummary data-testid="generic-items-status" kind={status.kind}>
            {status.text}
          </StudioFormSummary>
        ) : null}
        <GenericItemsDetailTabs
          activeTab={activeTab}
          categoryOptions={categoryOptions}
          categoryOptionsError={categoryOptionsError}
          categoryOptionsLoading={categoryOptionsLoading}
          labels={labels}
          mediaAssets={mediaAssets}
          onTabChange={setActiveTab}
          onUploadFile={uploadMediaFile}
          pt={pt}
        />
      </StudioDetailPageTemplate>
    </FormProvider>
  );
}
