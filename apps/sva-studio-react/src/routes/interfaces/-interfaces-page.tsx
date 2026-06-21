import React from 'react';

import {
  StudioDataTable,
  type StudioColumnDef,
} from '@sva/studio-ui-react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { createStudioDataTableLabels } from '../../components/studio-data-table-labels';
import { t } from '../../i18n';
import { formatEditorDateTime } from '../../lib/editor-date-time';
import { instanceInterfaceTypeMeta, type InstanceInterface } from '../../lib/instance-interfaces';
import {
  draftFromEntry,
  type EditState,
  useInterfacesPageController,
} from './-interfaces-page.controller';
import { InterfaceForm, TypePickerDialog } from './-interfaces-page.dialogs';

const statusBadgeClass: Record<InstanceInterface['status'], string> = {
  connected: 'border-primary/40 bg-primary/15 text-primary',
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
  disabled: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  unknown: 'border-secondary/40 bg-secondary/10 text-secondary',
};

const statusTranslationKey: Record<InstanceInterface['status'], string> = {
  connected: 'interfaces.status.connected',
  error: 'interfaces.status.error',
  disabled: 'interfaces.status.disabled',
  unknown: 'interfaces.status.unknown',
};

const getInterfaceEndpoint = (entry: InstanceInterface): string => {
  if (entry.type === 'mainserver') return entry.config.graphqlBaseUrl || '-';
  if (entry.type === 's3') {
    const { endpoint, bucket } = entry.config;
    return endpoint && bucket ? `${endpoint}/${bucket}` : endpoint || '-';
  }
  if (entry.type === 'supabase') {
    return entry.config.projectUrl || '-';
  }
  if (entry.type === 'mapGeocoding') {
    return entry.config.suggestEndpoint || entry.config.geocodeEndpoint || entry.config.styleUrl || '-';
  }
  return entry.config.host || '-';
};

const renderInterfaceRowActions = (
  row: InstanceInterface,
  setEditState: React.Dispatch<React.SetStateAction<EditState>>,
  setPendingDelete: React.Dispatch<React.SetStateAction<InstanceInterface | null>>
) => (
  <>
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => setEditState({ mode: 'edit', entry: row, draft: draftFromEntry(row) })}
    >
      {t('admin.users.actions.edit')}
    </Button>
    <Button type="button" size="sm" variant="destructive" onClick={() => setPendingDelete(row)}>
      {t('interfaces.edit.deleteAction')}
    </Button>
  </>
);

const getEditCardTitle = (editState: Exclude<EditState, { mode: 'closed' }>): string =>
  editState.mode === 'create' ? t(instanceInterfaceTypeMeta[editState.type].titleKey) : t('interfaces.edit.title');

export const InterfacesPage = () => {
  const {
    availableTypes,
    editState,
    errorMessage,
    instanceId,
    interfaces,
    isLoading,
    isSaving,
    pendingDelete,
    pickerOpen,
    pickerType,
    refresh,
    setEditState,
    setPendingDelete,
    setPickerOpen,
    setPickerType,
    statusMessage,
    onConfirmDelete,
    onConfirmType,
    onSaveDraft,
  } = useInterfacesPageController();
  const labels = createStudioDataTableLabels();

  const columns = React.useMemo<readonly StudioColumnDef<InstanceInterface>[]>(
    () => [
      {
        id: 'name',
        header: t('interfaces.table.headerName'),
        cell: (row) => row.name,
        sortable: true,
        sortValue: (row) => row.name.toLowerCase(),
      },
      {
        id: 'type',
        header: t('interfaces.table.headerType'),
        cell: (row) => t(instanceInterfaceTypeMeta[row.type].titleKey),
        sortable: true,
        sortValue: (row) => row.type,
      },
      {
        id: 'endpoint',
        header: t('interfaces.table.headerEndpoint'),
        cell: (row) => (
          <span className="break-all font-mono text-xs text-muted-foreground">
            {getInterfaceEndpoint(row)}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('interfaces.table.headerStatus'),
        cell: (row) => (
          <div className="flex max-w-sm flex-col gap-1">
            <Badge className={`w-fit rounded-full ${statusBadgeClass[row.status]}`} variant="outline">
              {t(statusTranslationKey[row.status])}
            </Badge>
            {row.statusMessage ? (
              <span className="text-xs leading-snug text-muted-foreground">{row.statusMessage}</span>
            ) : null}
          </div>
        ),
        sortable: true,
        sortValue: (row) => row.status,
      },
      {
        id: 'lastChecked',
        header: t('interfaces.table.headerLastChecked'),
        cell: (row) => (row.lastCheckedAt ? formatEditorDateTime(row.lastCheckedAt) ?? row.lastCheckedAt : '-'),
        sortable: true,
        sortValue: (row) => row.lastCheckedAt ?? '',
      },
    ],
    []
  );

  const hasLoadedInterfacesContext = instanceId.length > 0 || interfaces.length > 0;
  const showBlockingLoadError = errorMessage !== null && !isLoading && !hasLoadedInterfacesContext;
  const blockingLoadErrorDescription =
    errorMessage === t('interfaces.messages.loadError') ? null : errorMessage;

  return (
    <div className="flex flex-col gap-6 text-foreground">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('interfaces.page.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('interfaces.page.subtitle')}</p>
        {instanceId ? (
          <p className="text-xs text-muted-foreground">
            {t('interfaces.status.instanceLabel')}: <span className="font-medium">{instanceId}</span>
          </p>
        ) : null}
      </header>

      {statusMessage ? (
        <Alert className="border-primary/40 bg-primary/10 text-primary">
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      ) : null}
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
                <Button type="button" variant="outline" onClick={() => void refresh()}>
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
            <Button type="button" onClick={() => setPickerOpen(true)}>
              {t('interfaces.create.action')}
            </Button>
          }
          rowActions={(row) => renderInterfaceRowActions(row, setEditState, setPendingDelete)}
        />
      )}

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
              isSaving={isSaving}
              onChange={(next) =>
                setEditState((current) =>
                  current.mode === 'closed' ? current : { ...current, draft: next }
                )
              }
              onCancel={() => setEditState({ mode: 'closed' })}
              onSubmit={() => void onSaveDraft()}
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('interfaces.edit.deleteConfirmTitle')}
        description={t('interfaces.edit.deleteConfirmDescription', {
          name: pendingDelete?.name ?? '',
        })}
        confirmLabel={t('interfaces.edit.deleteConfirm')}
        cancelLabel={t('interfaces.edit.cancel')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  );
};
