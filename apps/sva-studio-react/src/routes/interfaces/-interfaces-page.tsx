import { useServerFn } from '@tanstack/react-start';
import React from 'react';
import { formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';

import {
  StudioDataTable,
  type StudioColumnDef,
} from '@sva/studio-ui-react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { createStudioDataTableLabels } from '../../components/studio-data-table-labels';
import { t } from '../../i18n';
import { readErrorMessage } from '../../lib/error-message-utils';
import {
  deleteInstanceInterfaceServerFn,
  listInstanceInterfacesServerFn,
  saveSvaMainserverInterfaceSettings,
  upsertInstanceInterfaceServerFn,
} from '../../lib/interfaces-api';
import { createEmptyInstanceInterfaceDraft, instanceInterfaceTypeMeta, type InstanceInterface, type InstanceInterfaceDraft, type InstanceInterfaceType } from '../../lib/instance-interfaces';
import { InterfaceForm, TypePickerDialog } from './-interfaces-page.dialogs';

const DEFAULT_AVAILABLE_TYPES: readonly InstanceInterfaceType[] = ['mainserver', 's3'];

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
  return entry.config.projectUrl || '-';
};

type EditState =
  | { mode: 'closed' }
  | { mode: 'create'; type: InstanceInterfaceType; draft: InstanceInterfaceDraft }
  | { mode: 'edit'; entry: InstanceInterface; draft: InstanceInterfaceDraft };

const draftFromEntry = (entry: InstanceInterface): InstanceInterfaceDraft => {
  if (entry.type === 'mainserver') {
    return {
      type: 'mainserver',
      name: entry.name,
      enabled: entry.enabled,
      config: entry.config,
    };
  }
  if (entry.type === 's3') {
    return {
      type: 's3',
      name: entry.name,
      enabled: entry.enabled,
      config: { ...entry.config, secretAccessKey: '' },
    };
  }
  return {
    type: 'supabase',
    name: entry.name,
    enabled: entry.enabled,
    config: { ...entry.config, serviceRoleKey: '' },
  };
};

const translateInterfacesErrorMessage = (error: unknown, fallback: string): string => {
  const message = readErrorMessage(error, fallback);

  switch (message) {
    case 'custom_interfaces_not_supported':
      return t('interfaces.errors.customInterfacesNotSupported');
    case 'interface_not_found':
      return t('interfaces.errors.interfaceNotFound');
    case 'interface_instance_mismatch':
      return t('interfaces.errors.interfaceInstanceMismatch');
    case 'interface_type_change_not_supported':
      return t('interfaces.errors.interfaceTypeChangeNotSupported');
    case 'supabase_requires_waste_management_module':
      return t('interfaces.errors.supabaseRequiresWasteManagementModule');
    case 'secret_unreadable':
      return t('interfaces.errors.secretUnreadable');
    case 'forbidden':
      return t('interfaces.errors.forbidden');
    case 'invalid_config':
      return t('interfaces.errors.invalidConfig');
    default:
      return message;
  }
};

const buildUpsertPayload = (
  instanceId: string,
  editState: Extract<EditState, { mode: 'create' | 'edit' }>
) => ({
  instanceId,
  draft: editState.draft,
  ...(editState.mode === 'edit' && editState.entry.type !== 'mainserver'
    ? { existingId: editState.entry.id }
    : {}),
});

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
    {row.type === 'mainserver' ? null : (
      <Button type="button" size="sm" variant="destructive" onClick={() => setPendingDelete(row)}>
        {t('interfaces.edit.deleteAction')}
      </Button>
    )}
  </>
);

const getEditCardTitle = (editState: Exclude<EditState, { mode: 'closed' }>): string =>
  editState.mode === 'create' ? t(instanceInterfaceTypeMeta[editState.type].titleKey) : t('interfaces.edit.title');

export const InterfacesPage = () => {
  const listInterfaces = useServerFn(listInstanceInterfacesServerFn);
  const saveMainserver = useServerFn(saveSvaMainserverInterfaceSettings);
  const upsertInterface = useServerFn(upsertInstanceInterfaceServerFn);
  const deleteInterface = useServerFn(deleteInstanceInterfaceServerFn);
  const listInterfacesRef = React.useRef(listInterfaces);
  const saveMainserverRef = React.useRef(saveMainserver);
  const upsertInterfaceRef = React.useRef(upsertInterface);
  const deleteInterfaceRef = React.useRef(deleteInterface);
  listInterfacesRef.current = listInterfaces;
  saveMainserverRef.current = saveMainserver;
  upsertInterfaceRef.current = upsertInterface;
  deleteInterfaceRef.current = deleteInterface;

  const labels = createStudioDataTableLabels();

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [instanceId, setInstanceId] = React.useState('');
  const [interfaces, setInterfaces] = React.useState<readonly InstanceInterface[]>([]);
  const [availableTypes, setAvailableTypes] = React.useState<readonly InstanceInterfaceType[]>(DEFAULT_AVAILABLE_TYPES);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerType, setPickerType] = React.useState<InstanceInterfaceType>('s3');
  const [editState, setEditState] = React.useState<EditState>({ mode: 'closed' });
  const [pendingDelete, setPendingDelete] = React.useState<InstanceInterface | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await listInterfacesRef.current();
      const nextAvailableTypes =
        result.availableTypes.length > 0 ? result.availableTypes : DEFAULT_AVAILABLE_TYPES;
      setInstanceId(result.instanceId);
      setInterfaces(result.entries);
      setAvailableTypes(nextAvailableTypes);
      setPickerType((current) => (nextAvailableTypes.includes(current) ? current : nextAvailableTypes[0] ?? 's3'));
    } catch (error) {
      setErrorMessage(translateInterfacesErrorMessage(error, t('interfaces.messages.loadError')));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onConfirmType = () => {
    setEditState({
      mode: 'create',
      type: pickerType,
      draft: createEmptyInstanceInterfaceDraft(pickerType),
    });
    setPickerOpen(false);
  };

  const onSaveDraft = async () => {
    if (editState.mode === 'closed') return;
    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const draft = editState.draft;
      if (draft.type === 'mainserver') {
        await saveMainserverRef.current({
          data: {
            graphqlBaseUrl: draft.config.graphqlBaseUrl,
            oauthTokenUrl: draft.config.oauthTokenUrl,
            enabled: draft.enabled,
          },
        });
      } else {
        await upsertInterfaceRef.current({
          data: buildUpsertPayload(instanceId, editState),
        });
      }
      setStatusMessage(t('interfaces.messages.saveSuccess'));
      setEditState({ mode: 'closed' });
      await refresh();
    } catch (error) {
      setErrorMessage(translateInterfacesErrorMessage(error, t('interfaces.messages.saveError')));
    } finally {
      setIsSaving(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!pendingDelete || pendingDelete.type === 'mainserver') {
      setPendingDelete(null);
      return;
    }
    setErrorMessage(null);
    try {
      const result = await deleteInterfaceRef.current({
        data: { instanceId, id: pendingDelete.id },
      });
      if (!result.deleted) {
        throw new Error('interface_not_found');
      }
      setPendingDelete(null);
      await refresh();
    } catch (error) {
      setErrorMessage(translateInterfacesErrorMessage(error, t('interfaces.messages.saveError')));
      setPendingDelete(null);
    }
  };

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
        cell: (row) => (row.lastCheckedAt ? formatDateTimeInEditorTimeZone(row.lastCheckedAt) : '-'),
        sortable: true,
        sortValue: (row) => row.lastCheckedAt ?? '',
      },
    ],
    []
  );

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
      {errorMessage ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

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
        rowActions={(row) => (
          renderInterfaceRowActions(row, setEditState, setPendingDelete)
        )}
      />

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
