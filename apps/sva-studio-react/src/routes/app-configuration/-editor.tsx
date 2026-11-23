import React from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Button, Select, useStudioEditorSuspended } from '@sva/studio-ui-react';
import type { AppConfigurationDocument, AppConfigurationRecord } from '@sva/sva-mainserver';
import { readAppConfiguration } from '../../lib/app-configuration-sync-api';
import { ContentEditorLeaveBoundary } from '../../routing/content-editor-leave-boundary';
import { useAuth } from '../../providers/auth-provider';
import { useEffectiveAccess } from '../../providers/effective-access-provider';
import {
  appConfigurationReadAccess,
  appConfigurationWriteAccess,
  appConfigurationVariantAccess,
} from '../../lib/app-configuration-access';
import { useOrganizationContext } from '../../hooks/use-organization-context';
import { t } from '../../i18n';
import { ConfigurationForm } from './-form';
import { VariantActions } from './-variants';

const DAY = 24 * 60 * 60 * 1000;
const text = (key: string) => t(`interfaces.appConfiguration.${key}`);
export const AppConfigurationEditor = () => (
  <ContentEditorLeaveBoundary protectContextChanges>
    <ContextEditor />
  </ContentEditorLeaveBoundary>
);

function ContextEditor() {
  const auth = useAuth();
  const access = useEffectiveAccess();
  const organization = useOrganizationContext();
  const suspended = useStudioEditorSuspended();
  const identity =
    auth.user &&
    !auth.isLoading &&
    !organization.isLoading &&
    !organization.isUpdating &&
    !organization.error &&
    access.decide(appConfigurationReadAccess).status === 'allowed'
      ? JSON.stringify([
          auth.user.id,
          auth.user.instanceId,
          organization.context?.activeOrganizationId,
        ])
      : undefined;
  const [bound, setBound] = React.useState(identity);
  const [dirty, setDirty] = React.useState(false);
  React.useEffect(() => {
    if (identity !== undefined && !dirty && !suspended) setBound(identity);
  }, [identity, dirty, suspended]);
  return (
    <ConfigurationPicker
      key={bound}
      ready={!!identity && identity === bound && !suspended}
      reportDirty={setDirty}
      canWrite={access.decide(appConfigurationWriteAccess).status === 'allowed'}
      canManageVariants={access.decide(appConfigurationVariantAccess).status === 'allowed'}
    />
  );
}

function ConfigurationPicker({
  ready,
  reportDirty,
  canWrite,
  canManageVariants,
}: {
  ready: boolean;
  reportDirty: (dirty: boolean) => void;
  canWrite: boolean;
  canManageVariants: boolean;
}) {
  const read = useServerFn(readAppConfiguration);
  const [rows, setRows] = React.useState<AppConfigurationRecord[]>([]);
  const [name, setName] = React.useState('');
  const [id, setId] = React.useState('');
  const [entry, setEntry] = React.useState<AppConfigurationDocument | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const loadedAt = React.useRef(0);
  const cache = React.useRef(new Map<string, { at: number; entry: AppConfigurationDocument }>());
  const report = React.useCallback(
    (value: boolean) => {
      setDirty(value);
      reportDirty(value);
    },
    [reportDirty]
  );
  const refresh = React.useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await read({ data: {} });
      if (!result.ok || !Array.isArray(result.data)) throw new Error();
      loadedAt.current = Date.now();
      cache.current.clear();
      setRows(result.data);
      setId('');
      setEntry(null);
    } catch {
      setMessage('loadError');
    } finally {
      setBusy(false);
    }
  }, [read]);
  React.useEffect(() => {
    if (ready && Date.now() - loadedAt.current >= DAY && !dirty && !busy) {
      loadedAt.current = Date.now();
      void refresh();
    }
  }, [ready, dirty, busy, refresh]);
  const open = async (selected: string) => {
    setId(selected);
    setEntry(null);
    setMessage('');
    if (!selected) return;
    const cached = cache.current.get(selected);
    if (cached && Date.now() - cached.at < DAY) return setEntry(cached.entry);
    setBusy(true);
    try {
      const result = await read({ data: { id: selected } });
      if (!result.ok || Array.isArray(result.data) || !result.data) throw new Error();
      cache.current.set(selected, { at: Date.now(), entry: result.data });
      setEntry(result.data);
    } catch {
      setMessage('loadError');
    } finally {
      setBusy(false);
    }
  };
  const selectCreated = (document: AppConfigurationDocument) => {
    cache.current.set(document.id, { at: Date.now(), entry: document });
    setRows((previous) => [...previous.filter((row) => row.id !== document.id), document]);
    setId(document.id);
    setEntry(document);
  };

  const removeDeleted = (deletedId: string) => {
    cache.current.delete(deletedId);
    setRows((previous) => previous.filter((row) => row.id !== deletedId));
    setId('');
    setEntry(null);
  };

  const selectionLocked = dirty || busy;
  const names = [...new Set(rows.map((row) => row.name))].sort((a, b) => a.localeCompare(b));
  return (
    <section
      aria-labelledby="app-configuration-heading"
      className="space-y-4 rounded-lg border p-5"
    >
      <h2 id="app-configuration-heading" className="text-lg font-semibold">
        {text('title')}
      </h2>
      <fieldset hidden={!ready} disabled={!ready} className="space-y-4">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-1">
            <span>{text('file')}</span>
            <Select
              value={name}
              disabled={selectionLocked}
              onChange={(event) => {
                setName(event.target.value);
                setId('');
                setEntry(null);
              }}
            >
              <option value="">{text('selectFile')}</option>
              {names.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1">
            <span>{text('version')}</span>
            <Select
              value={id}
              disabled={!name || selectionLocked}
              onChange={(event) => void open(event.target.value)}
            >
              <option value="">{text('selectVersion')}</option>
              {rows
                .filter((row) => row.name === name)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.version || text('unversioned')} · {row.id}
                  </option>
                ))}
            </Select>
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={selectionLocked}
            onClick={() => void refresh()}
          >
            {text('refresh')}
          </Button>
        </div>
        {busy && <p role="status">{text('loading')}</p>}
        {message && <p role="alert">{text(message)}</p>}
        {ready && (
          <VariantActions
            entry={entry}
            enabled={canManageVariants && !selectionLocked}
            onCreated={selectCreated}
            onDeleted={removeDeleted}
          />
        )}
        {entry &&
          (entry.fields ? (
            <ConfigurationForm
              key={id}
              entry={entry}
              reportDirty={report}
              canWrite={canWrite}
              onSaved={(saved) => {
                setEntry(saved);
                cache.current.set(saved.id, { at: Date.now(), entry: saved });
                setRows((previous) => previous.map((row) => (row.id === saved.id ? saved : row)));
              }}
            />
          ) : (
            <p role="status">{text('noEditor')}</p>
          ))}
      </fieldset>
    </section>
  );
}
