import { useServerFn } from '@tanstack/react-start';
import React from 'react';

import {
  StudioDataTable,
  type StudioColumnDef,
} from '@sva/studio-ui-react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { createStudioDataTableLabels } from '../../components/studio-data-table-labels';
import { t } from '../../i18n';
import { readErrorMessage } from '../../lib/error-message-utils';
import {
  deleteInstanceInterfaceServerFn,
  listInstanceInterfacesServerFn,
  saveSvaMainserverInterfaceSettings,
  upsertInstanceInterfaceServerFn,
} from '../../lib/interfaces-api';
import {
  createEmptyInstanceInterfaceDraft,
  instanceInterfaceTypeMeta,
  type InstanceInterface,
  type InstanceInterfaceDraft,
  type InstanceInterfaceType,
} from '../../lib/instance-interfaces';

const interfaceTypes: readonly InstanceInterfaceType[] = ['mainserver', 's3', 'supabase'];

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
      setInstanceId(result.instanceId);
      setInterfaces(result.entries);
    } catch (error) {
      setErrorMessage(readErrorMessage(error, t('interfaces.messages.loadError')));
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
          data: {
            instanceId,
            draft,
            ...(editState.mode === 'edit' && editState.entry.type !== 'mainserver'
              ? { existingId: editState.entry.id }
              : {}),
          },
        });
      }
      setStatusMessage(t('interfaces.messages.saveSuccess'));
      setEditState({ mode: 'closed' });
      await refresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error, t('interfaces.messages.saveError')));
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
      await deleteInterfaceRef.current({
        data: { instanceId, id: pendingDelete.id },
      });
      setPendingDelete(null);
      await refresh();
    } catch (error) {
      setErrorMessage(readErrorMessage(error, t('interfaces.messages.saveError')));
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
          <Badge className={`rounded-full ${statusBadgeClass[row.status]}`} variant="outline">
            {t(statusTranslationKey[row.status])}
          </Badge>
        ),
        sortable: true,
        sortValue: (row) => row.status,
      },
      {
        id: 'lastChecked',
        header: t('interfaces.table.headerLastChecked'),
        cell: (row) => (row.lastCheckedAt ? new Date(row.lastCheckedAt).toLocaleString() : '-'),
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
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditState({ mode: 'edit', entry: row, draft: draftFromEntry(row) })}
            >
              {t('admin.users.actions.edit')}
            </Button>
            {row.type !== 'mainserver' ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setPendingDelete(row)}
              >
                {t('interfaces.edit.deleteAction')}
              </Button>
            ) : null}
          </>
        )}
      />

      {editState.mode !== 'closed' ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
              {editState.mode === 'create'
                ? t(instanceInterfaceTypeMeta[editState.type].titleKey)
                : t('interfaces.edit.title')}
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

type TypePickerDialogProps = Readonly<{
  open: boolean;
  selectedType: InstanceInterfaceType;
  onSelectType: (type: InstanceInterfaceType) => void;
  onCancel: () => void;
  onConfirm: () => void;
}>;

const TypePickerDialog = ({ open, selectedType, onSelectType, onCancel, onConfirm }: TypePickerDialogProps) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('interfaces.create.dialogTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-shell">
        <h2 className="text-lg font-semibold">{t('interfaces.create.dialogTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('interfaces.create.dialogDescription')}</p>
        <div className="mt-4 grid gap-3">
          {interfaceTypes.map((type) => {
            const meta = instanceInterfaceTypeMeta[type];
            const inputId = `interface-type-${type}`;
            return (
              <label
                key={type}
                htmlFor={inputId}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  selectedType === type
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <input
                  id={inputId}
                  type="radio"
                  name="interface-type"
                  className="mt-1"
                  checked={selectedType === type}
                  onChange={() => onSelectType(type)}
                />
                <div>
                  <div className="font-medium text-foreground">{t(meta.titleKey)}</div>
                  <p className="text-xs text-muted-foreground">{t(meta.descriptionKey)}</p>
                </div>
              </label>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('interfaces.create.cancel')}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {t('interfaces.create.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
};

type InterfaceFormProps = Readonly<{
  draft: InstanceInterfaceDraft;
  isSaving: boolean;
  onChange: (next: InstanceInterfaceDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
}>;

const InterfaceForm = ({ draft, isSaving, onChange, onCancel, onSubmit }: InterfaceFormProps) => {
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="interface-name">{t('interfaces.edit.commonName')}</Label>
        <Input
          id="interface-name"
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.currentTarget.value })}
        />
      </div>

      {draft.type === 'mainserver' ? (
        <MainserverFields draft={draft} onChange={onChange} />
      ) : draft.type === 's3' ? (
        <S3Fields draft={draft} onChange={onChange} />
      ) : (
        <SupabaseFields draft={draft} onChange={onChange} />
      )}

      <Label htmlFor="interface-enabled" className="flex items-center gap-3">
        <Checkbox
          id="interface-enabled"
          checked={draft.enabled}
          onChange={(event) => onChange({ ...draft, enabled: event.currentTarget.checked })}
        />
        <span>{t('interfaces.edit.commonEnabled')}</span>
      </Label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? t('interfaces.actions.saving') : t('interfaces.actions.save')}
        </Button>
        <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>
          {t('interfaces.edit.cancel')}
        </Button>
      </div>
    </form>
  );
};

const MainserverFields = ({
  draft,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'mainserver' }>;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => (
  <>
    <div className="grid gap-2">
      <Label htmlFor="mainserver-graphql">{t('interfaces.form.graphqlBaseUrl')}</Label>
      <Input
        id="mainserver-graphql"
        type="url"
        value={draft.config.graphqlBaseUrl}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, graphqlBaseUrl: event.currentTarget.value } })
        }
      />
    </div>
    <div className="grid gap-2">
      <Label htmlFor="mainserver-oauth">{t('interfaces.form.oauthTokenUrl')}</Label>
      <Input
        id="mainserver-oauth"
        type="url"
        value={draft.config.oauthTokenUrl}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, oauthTokenUrl: event.currentTarget.value } })
        }
      />
    </div>
  </>
);

const S3Fields = ({
  draft,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 's3' }>;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => (
  <>
    <p className="rounded-md border border-secondary/40 bg-secondary/10 p-2 text-xs text-secondary">
      {t('interfaces.forms.s3.notImplemented')}
    </p>
    <div className="grid gap-2">
      <Label htmlFor="s3-endpoint">{t('interfaces.forms.s3.endpoint')}</Label>
      <Input
        id="s3-endpoint"
        type="url"
        value={draft.config.endpoint}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, endpoint: event.currentTarget.value } })
        }
      />
    </div>
    <div className="grid gap-2 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="s3-region">{t('interfaces.forms.s3.region')}</Label>
        <Input
          id="s3-region"
          value={draft.config.region}
          onChange={(event) =>
            onChange({ ...draft, config: { ...draft.config, region: event.currentTarget.value } })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="s3-bucket">{t('interfaces.forms.s3.bucket')}</Label>
        <Input
          id="s3-bucket"
          value={draft.config.bucket}
          onChange={(event) =>
            onChange({ ...draft, config: { ...draft.config, bucket: event.currentTarget.value } })
          }
        />
      </div>
    </div>
    <div className="grid gap-2">
      <Label htmlFor="s3-access-key">{t('interfaces.forms.s3.accessKeyId')}</Label>
      <Input
        id="s3-access-key"
        value={draft.config.accessKeyId}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, accessKeyId: event.currentTarget.value } })
        }
      />
    </div>
    <div className="grid gap-2">
      <Label htmlFor="s3-secret-key">{t('interfaces.forms.s3.secretAccessKey')}</Label>
      <Input
        id="s3-secret-key"
        type="password"
        value={draft.config.secretAccessKey}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, secretAccessKey: event.currentTarget.value } })
        }
      />
    </div>
    <Label htmlFor="s3-path-style" className="flex items-center gap-3">
      <Checkbox
        id="s3-path-style"
        checked={draft.config.forcePathStyle}
        onChange={(event) =>
          onChange({
            ...draft,
            config: { ...draft.config, forcePathStyle: event.currentTarget.checked },
          })
        }
      />
      <span>{t('interfaces.forms.s3.forcePathStyle')}</span>
    </Label>
  </>
);

const SupabaseFields = ({
  draft,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'supabase' }>;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => (
  <>
    <p className="rounded-md border border-secondary/40 bg-secondary/10 p-2 text-xs text-secondary">
      {t('interfaces.forms.supabase.notImplemented')}
    </p>
    <div className="grid gap-2">
      <Label htmlFor="supabase-project">{t('interfaces.forms.supabase.projectUrl')}</Label>
      <Input
        id="supabase-project"
        type="url"
        value={draft.config.projectUrl}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, projectUrl: event.currentTarget.value } })
        }
      />
    </div>
    <div className="grid gap-2 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="supabase-schema">{t('interfaces.forms.supabase.schemaName')}</Label>
        <Input
          id="supabase-schema"
          value={draft.config.schemaName}
          onChange={(event) =>
            onChange({ ...draft, config: { ...draft.config, schemaName: event.currentTarget.value } })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="supabase-db">{t('interfaces.forms.supabase.databaseUrl')}</Label>
        <Input
          id="supabase-db"
          value={draft.config.databaseUrl}
          onChange={(event) =>
            onChange({ ...draft, config: { ...draft.config, databaseUrl: event.currentTarget.value } })
          }
        />
      </div>
    </div>
    <div className="grid gap-2">
      <Label htmlFor="supabase-key">{t('interfaces.forms.supabase.serviceRoleKey')}</Label>
      <Input
        id="supabase-key"
        type="password"
        value={draft.config.serviceRoleKey}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, serviceRoleKey: event.currentTarget.value } })
        }
      />
    </div>
  </>
);
