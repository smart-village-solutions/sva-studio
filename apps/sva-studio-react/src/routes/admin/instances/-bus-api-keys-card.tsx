/** Instance-scoped Bus management; raw keys exist only in this mounted component. */
import React from 'react';
import { Button } from '@sva/studio-ui-react';
import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import { useBusKeys, type BusKeysProps } from './-bus-api-keys-state';
import { BusKeysTable } from './-bus-api-keys-table';
import {
  BusKeyCreateDialog,
  BusKeySecretDialog,
  BusKeyRevokeDialog,
} from './-bus-api-keys-dialogs';
const prefix = 'admin.instances.busKeys.';

// A keyed child also discards secrets on A → B → A navigation and invalidates every old promise.
export const BusApiKeysCard = (props: BusKeysProps) => (
  <BusApiKeysContent key={props.instanceId} {...props} />
);

const BusApiKeysContent = (props: BusKeysProps) => {
  const model = useBusKeys(props);
  const {
    loading,
    busy,
    displayName,
    instanceId,
    error,
    auditWarning,
    requestId,
    createButtonRef,
    status,
    setContact,
    setCreatedBy,
    setValidThrough,
    yearEnd,
    setError,
    setFormOpen,
    reloadButtonRef,
    setRequestId,
    setLoading,
    load,
  } = model;
  return (
    <Card className="space-y-4 p-4" aria-busy={loading || busy}>
      <h3 className="font-semibold">{t(`${prefix}title`)}</h3>
      <p className="text-sm text-muted-foreground">{t(`${prefix}rotation`)}</p>
      <p>
        {displayName} <span className="font-mono text-sm">{instanceId}</span>
      </p>
      {error ? (
        <p role="alert" className="text-destructive">
          {t(`${prefix}${error}`)}
          {error === 'reauth' ? (
            <>
              {' '}
              <a
                href={`/auth/login?${new URLSearchParams({
                  reauth: '1',
                  returnTo: `/admin/instances/${encodeURIComponent(instanceId)}`,
                })}`}
                className="font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                {t(`${prefix}reauthAction`)}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {auditWarning ? <p role="status">{t(`${prefix}auditWarning`)}</p> : null}
      {(auditWarning || error) && requestId ? (
        <p className="text-sm">
          {t(`${prefix}requestId`)} <code>{requestId}</code>
        </p>
      ) : null}
      <BusKeysTable model={model} />
      <div className="flex flex-wrap gap-3">
        <Button
          ref={createButtonRef}
          disabled={status !== 'active' || busy || loading || error === 'notConfigured'}
          onClick={() => {
            setContact('');
            setCreatedBy('');
            setValidThrough(yearEnd());
            setError(null);
            setFormOpen(true);
          }}
        >
          {t(`${prefix}create`)}
        </Button>
        {!loading ? (
          <Button
            ref={reloadButtonRef}
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setError(null);
              setRequestId(undefined);
              setLoading(true);
              void load();
            }}
          >
            {t(`${prefix}reload`)}
          </Button>
        ) : null}
      </div>
      <BusKeyCreateDialog model={model} />
      <BusKeySecretDialog model={model} />
      <BusKeyRevokeDialog model={model} />
    </Card>
  );
};
