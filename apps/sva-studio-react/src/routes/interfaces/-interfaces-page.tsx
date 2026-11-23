import React from 'react';

import {
  Button,
  StudioDataTable,
  StudioDestructiveActionDialog,
  StudioPageTitle,
  StudioPersistentActionResult,
} from '@sva/studio-ui-react';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  createStudioDataTableLabels,
  createStudioDataTableSortingLabels,
} from '../../components/studio-data-table-labels';
import { t } from '../../i18n';
import { instanceInterfaceTypeMeta, type InstanceInterface } from '../../lib/instance-interfaces';
import {
  draftFromEntry,
  type EditState,
  useInterfacesPageController,
} from './-interfaces-page.controller';
import { InterfaceForm, TypePickerDialog } from './-interfaces-page.dialogs';
import { createInterfaceColumns } from './-interfaces-page.columns';

const renderInterfaceRowActions = (
  row: InstanceInterface,
  setEditState: React.Dispatch<React.SetStateAction<EditState>>,
  requestDelete: (entry: InstanceInterface) => void,
  onTestMail: (entry: InstanceInterface) => void,
  mailTestPendingId: string | null
) => (
  <>
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={() => setEditState({ mode: 'edit', entry: row, draft: draftFromEntry(row) })}
    >
      {t('admin.users.actions.edit')}
    </Button>
    {row.type === 'mailTransport' && row.config.transportType === 'smtp' ? (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={!row.enabled || mailTestPendingId !== null}
        onClick={() => onTestMail(row)}
      >
        {t(
          mailTestPendingId === row.id
            ? 'interfaces.mailTest.sending'
            : 'interfaces.mailTest.action'
        )}
      </Button>
    ) : null}
    <Button type="button" size="sm" variant="destructive" onClick={() => requestDelete(row)}>
      {t('interfaces.edit.deleteAction')}
    </Button>
  </>
);

const getEditCardTitle = (editState: Exclude<EditState, { mode: 'closed' }>): string =>
  editState.mode === 'create'
    ? t(instanceInterfaceTypeMeta[editState.type].titleKey)
    : t('interfaces.edit.title');

export const InterfacesPage = () => {
  const deleteFocusFallbackRef = React.useRef<HTMLButtonElement>(null);
  const {
    deepLChecking,
    onCheckDeepL,
    onRetryForm,
    availableTypes,
    cancelDelete,
    deleteErrorMessage,
    deletePending,
    deleteResultMessage,
    mailTestPendingId,
    mailTestResult,
    dismissDeleteResult,
    editState,
    errorMessage,
    instanceId,
    interfaces,
    isLoading,
    markDraftDirty,
    pendingDelete,
    pickerOpen,
    pickerType,
    refresh,
    requestDelete,
    setEditState,
    setPickerOpen,
    setPickerType,
    saveErrorMessage,
    saveStatus,
    onConfirmDelete,
    onTestMail,
    onConfirmType,
    onSaveDraft,
  } = useInterfacesPageController();
  const labels = createStudioDataTableLabels();
  const sortingLabels = createStudioDataTableSortingLabels();

  React.useEffect(() => {
    if (deleteResultMessage) {
      deleteFocusFallbackRef.current?.focus();
    }
  }, [deleteResultMessage]);

  const columns = React.useMemo(createInterfaceColumns, []);

  const hasLoadedInterfacesContext = instanceId.length > 0 || interfaces.length > 0;
  const showBlockingLoadError = errorMessage !== null && !isLoading && !hasLoadedInterfacesContext;
  const blockingLoadErrorDescription =
    errorMessage === t('interfaces.messages.loadError') ? null : errorMessage;

  return (
    <div className="flex flex-col gap-6 text-foreground">
      <header className="flex flex-col gap-2">
        <StudioPageTitle withAccessory className="text-2xl">
          {t('interfaces.page.title')}
        </StudioPageTitle>
        <p className="text-sm text-muted-foreground">{t('interfaces.page.subtitle')}</p>
        {instanceId ? (
          <p className="text-xs text-muted-foreground">
            {t('interfaces.status.instanceLabel')}:{' '}
            <span className="font-medium">{instanceId}</span>
          </p>
        ) : null}
      </header>

      {errorMessage && !showBlockingLoadError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {showBlockingLoadError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertTitle>{t('interfaces.messages.loadError')}</AlertTitle>
          <AlertDescription className="mt-3">
            <div className="space-y-3">
              {blockingLoadErrorDescription ? <p>{blockingLoadErrorDescription}</p> : null}
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={() => void refresh()}>
                  {t('interfaces.actions.reload')}
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <StudioDataTable
          ariaLabel={t('interfaces.table.ariaLabel')}
          labels={labels}
          caption={t('interfaces.table.caption')}
          data={interfaces}
          columns={columns}
          sorting={{ mode: 'client', labels: sortingLabels }}
          getRowId={(row) => row.id}
          selectionMode="none"
          isLoading={isLoading}
          loadingState={t('interfaces.messages.loading')}
          emptyState={
            <p className="text-sm text-muted-foreground">{t('interfaces.table.emptyState')}</p>
          }
          toolbarStart={
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('interfaces.table.countLabel', { count: interfaces.length })}
            </p>
          }
          toolbarEnd={
            <Button ref={deleteFocusFallbackRef} type="button" onClick={() => setPickerOpen(true)}>
              {t('interfaces.create.action')}
            </Button>
          }
          rowActions={(row) =>
            renderInterfaceRowActions(
              row,
              setEditState,
              requestDelete,
              onTestMail,
              mailTestPendingId
            )
          }
        />
      )}

      {mailTestResult ? (
        <Alert
          role={mailTestResult.kind === 'error' ? 'alert' : 'status'}
          className={
            mailTestResult.kind === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : undefined
          }
        >
          <AlertDescription>{mailTestResult.message}</AlertDescription>
        </Alert>
      ) : null}

      {deleteResultMessage ? (
        <StudioPersistentActionResult
          kind="success"
          title={t('interfaces.messages.deleteSuccessTitle')}
          description={deleteResultMessage}
          dismissLabel={t('interfaces.actions.dismiss')}
          onDismiss={dismissDeleteResult}
        />
      ) : null}

      {editState.mode !== 'closed' ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
              {getEditCardTitle(editState)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InterfaceForm
              draft={editState.draft}
              deepLEntry={
                editState.mode === 'edit' && editState.entry.type === 'deepl'
                  ? editState.entry
                  : undefined
              }
              deepLChecking={deepLChecking}
              onCheckDeepL={() => void onCheckDeepL()}
              hasStoredMapApiKey={
                editState.mode === 'edit' &&
                editState.entry.type === 'mapGeocoding' &&
                editState.entry.apiKeyConfigured
              }
              saveStatus={saveStatus}
              saveErrorMessage={saveErrorMessage}
              onChange={(next) => {
                markDraftDirty();
                setEditState((current) =>
                  current.mode === 'closed' ? current : { ...current, draft: next }
                );
              }}
              onCancel={() => setEditState({ mode: 'closed' })}
              onSubmit={() => void onSaveDraft()}
              onRetry={() => void onRetryForm()}
            />
          </CardContent>
        </Card>
      ) : null}

      <TypePickerDialog
        open={pickerOpen}
        availableTypes={availableTypes}
        selectedType={pickerType}
        onSelectType={setPickerType}
        onCancel={() => setPickerOpen(false)}
        onConfirm={onConfirmType}
      />

      <StudioDestructiveActionDialog
        open={pendingDelete !== null}
        title={t('interfaces.edit.deleteConfirmTitle')}
        description={t('interfaces.edit.deleteConfirmDescription', {
          name: pendingDelete?.name ?? '',
        })}
        confirmLabel={t('interfaces.edit.deleteConfirm')}
        pendingLabel={t('interfaces.edit.deletePending')}
        cancelLabel={t('interfaces.edit.cancel')}
        pending={deletePending}
        errorMessage={deleteErrorMessage}
        fallbackFocusRef={deleteFocusFallbackRef}
        onCancel={cancelDelete}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  );
};
