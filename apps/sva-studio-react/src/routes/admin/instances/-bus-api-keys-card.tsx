/** Instance-scoped Bus management; raw keys exist only in this mounted component. */
import React from 'react';
import {
  instanceBusKeyExpiresAt,
  type InstanceBusKey,
  type InstanceBusKeyCreated,
  type InstanceStatus,
} from '@sva/core';
import { Button } from '@sva/studio-ui-react';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../components/ui/dialog';
import { t } from '../../../i18n';
import {
  createInstanceBusKey,
  listInstanceBusKeys,
  mutateInstanceBusKey,
} from '../../../lib/iam-api-instances';
import { IamHttpError } from '../../../lib/iam-http-client';

type Props = { instanceId: string; displayName: string; status: InstanceStatus };
const prefix = 'admin.instances.busKeys.';
const errorKeys: Readonly<Record<string, string>> = {
  reauth_required: 'reauth',
  bus_not_configured: 'notConfigured',
  bus_unavailable: 'unavailable',
  invalid_request: 'invalid',
  bus_instance_inactive: 'inactive',
  bus_key_not_activatable: 'notActivatable',
  bus_key_not_found: 'keyNotFound',
  unauthorized: 'accessDenied',
  forbidden: 'accessDenied',
};
const yearEnd = () =>
  `${new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(new Date())}-12-31`;
const keyStatus = (key: InstanceBusKey) =>
  key.expiresAt && Date.parse(key.expiresAt) <= Date.now()
    ? 'expired'
    : key.revoked
      ? 'revoked'
      : 'active';
const inclusiveDate = (value: string) => {
  const date = new Date(value);
  if (date.toISOString().slice(11) !== '00:00:00.000Z') return undefined;
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

// A keyed child also discards secrets on A → B → A navigation and invalidates every old promise.
export const BusApiKeysCard = (props: Props) => (
  <BusApiKeysContent key={props.instanceId} {...props} />
);

const BusApiKeysContent = ({ instanceId, displayName, status }: Props) => {
  const mounted = React.useRef(false);
  const pending = React.useRef(false);
  const createButtonRef = React.useRef<HTMLButtonElement>(null);
  const reloadButtonRef = React.useRef<HTMLButtonElement>(null);
  const revokeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const pendingFocusRef = React.useRef<HTMLButtonElement | null>(null);
  const [keys, setKeys] = React.useState<InstanceBusKey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [auditWarning, setAuditWarning] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [secret, setSecret] = React.useState<InstanceBusKeyCreated | null>(null);
  const displayedSecretRef = React.useRef(secret);
  displayedSecretRef.current = secret;
  const [revoking, setRevoking] = React.useState<string | null>(null);
  const [contact, setContact] = React.useState('');
  const [createdBy, setCreatedBy] = React.useState('');
  const [validThrough, setValidThrough] = React.useState(yearEnd);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [requestId, setRequestId] = React.useState<string | undefined>();
  const expiresAt = instanceBusKeyExpiresAt(validThrough);

  const focusAction = (preferred: HTMLButtonElement | null) => {
    const target = [preferred, createButtonRef.current, reloadButtonRef.current].find(
      (button) => button?.isConnected && !button.disabled
    );
    pendingFocusRef.current = target ? null : preferred;
    target?.focus();
  };
  const restoreActionFocus = (event: Event, preferred: HTMLButtonElement | null) => {
    event.preventDefault();
    focusAction(preferred);
  };
  React.useEffect(() => {
    if (!busy && !loading && pendingFocusRef.current) focusAction(pendingFocusRef.current);
  }, [busy, loading]);

  const load = async () => {
    try {
      const { data } = await listInstanceBusKeys(instanceId);
      if (mounted.current) setKeys(data.filter((key) => key.label === instanceId));
    } catch (failure) {
      if (mounted.current)
        setError(
          (existing) =>
            existing ??
            (failure instanceof IamHttpError && failure.code === 'bus_not_configured'
              ? 'notConfigured'
              : 'loadError')
        );
    } finally {
      if (mounted.current) setLoading(false);
    }
  };
  React.useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
    // This child is remounted for every instance; no cross-instance request can update it.
  }, [instanceId]);

  const mutate = async (action: 'create' | 'revoke' | 'activate', keyId?: string) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setAuditWarning(false);
    setRequestId(undefined);
    try {
      if (action === 'create') {
        if (
          !expiresAt ||
          Date.parse(expiresAt) <= Date.now() ||
          !/^[\p{L}\p{M}]{1,32}$/u.test(createdBy.trim()) ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(contact.trim())
        ) {
          setError('invalid');
          return;
        }
        const { data, requestId: correlation } = await createInstanceBusKey(instanceId, {
          contact: contact.trim(),
          createdBy: createdBy.trim(),
          validThrough,
        });
        if (!mounted.current) return;
        setFormOpen(false);
        setSecret(data);
        setCopied(false);
        setCopyError(false);
        setAuditWarning(!data.auditRecorded);
        setRequestId(correlation);
      } else {
        if (!keyId) return;
        const { data, requestId: correlation } = await mutateInstanceBusKey(
          instanceId,
          keyId,
          action
        );
        if (!mounted.current) return;
        setRevoking(null);
        setAuditWarning(!data.auditRecorded);
        setRequestId(correlation);
      }
    } catch (failure) {
      if (!mounted.current) return;
      setFormOpen(false);
      setRevoking(null);
      const failureKey =
        failure instanceof IamHttpError
          ? (errorKeys[failure.code] ?? 'outcomeUnknown')
          : 'outcomeUnknown';
      setError(
        failureKey === 'outcomeUnknown' && action !== 'create'
          ? `${action}OutcomeUnknown`
          : failureKey
      );
      setRequestId(failure instanceof IamHttpError ? failure.requestId : undefined);
    } finally {
      if (mounted.current) {
        await load();
        if (mounted.current) setBusy(false);
      }
      pending.current = false;
    }
  };

  const copy = async () => {
    if (!secret) return;
    const copyingSecret = secret;
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(secret.apiKey);
      if (mounted.current && displayedSecretRef.current === copyingSecret) setCopied(true);
    } catch {
      if (mounted.current && displayedSecretRef.current === copyingSecret) setCopyError(true);
    }
  };

  const handleSecretClose = () => {
    if (copied) {
      setSecret(null);
      setCopied(false);
      setConfirmClose(false);
    } else {
      setConfirmClose((confirming) => !confirming);
    }
  };

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
            <>{' '}
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
      {loading ? (
        <p role="status">{t(`${prefix}loading`)}</p>
      ) : (
        <>
          {keys.length === 0 ? (
            <p>{t(`${prefix}empty`)}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t(`${prefix}title`)}</caption>
                <thead>
                  <tr>
                    {[
                      'keyId',
                      'contact',
                      'createdBy',
                      'createdAt',
                      'validThrough',
                      'status',
                      'actions',
                    ].map((field) => (
                      <th key={field} scope="col" className="p-2">
                        {t(`${prefix}${field}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.keyId} className="border-t border-border">
                      <th scope="row" className="p-2 font-mono font-normal">
                        {key.keyId}
                      </th>
                      <td className="p-2">{key.contact ?? t(`${prefix}missing`)}</td>
                      <td className="p-2">{key.createdBy ?? t(`${prefix}missing`)}</td>
                      <td className="p-2">
                        <time dateTime={key.createdAt}>{key.createdAt}</time>
                      </td>
                      <td className="p-2">
                        {key.expiresAt ? (
                          <>
                            {inclusiveDate(key.expiresAt) ? (
                              <span className="block">{inclusiveDate(key.expiresAt)}</span>
                            ) : null}
                            <time
                              dateTime={key.expiresAt}
                              className="text-xs text-muted-foreground"
                            >
                              {key.expiresAt}
                            </time>
                          </>
                        ) : (
                          t(`${prefix}noExpiry`)
                        )}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">{t(`${prefix}${keyStatus(key)}`)}</Badge>
                      </td>
                      <td className="p-2">
                        {key.revoked ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy || status !== 'active' || keyStatus(key) === 'expired'}
                            onClick={() => void mutate('activate', key.keyId)}
                          >
                            {t(`${prefix}activate`)}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={busy}
                            variant="destructive"
                            onClick={(event) => {
                              revokeButtonRef.current = event.currentTarget;
                              setRevoking(key.keyId);
                            }}
                          >
                            {t(`${prefix}revoke`)}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
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
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!busy) setFormOpen(open);
        }}
      >
        <DialogContent onCloseAutoFocus={(event) => {
          // The successful form hands focus to the one-time key dialog.
          if (displayedSecretRef.current) event.preventDefault();
          else restoreActionFocus(event, createButtonRef.current);
        }}>
          <DialogTitle>{t(`${prefix}create`)}</DialogTitle>
          <DialogDescription>{t(`${prefix}formDescription`)}</DialogDescription>
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void mutate('create');
            }}
          >
            <p>
              {displayName} · {instanceId}
            </p>
            <div className="space-y-2">
              <Label htmlFor="bus-contact">{t(`${prefix}contact`)}</Label>
              <Input
                id="bus-contact"
                type="email"
                required
                maxLength={254}
                disabled={busy}
                value={contact}
                onChange={(event) => setContact(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bus-created-by">{t(`${prefix}createdBy`)}</Label>
              <Input
                id="bus-created-by"
                required
                maxLength={32}
                disabled={busy}
                value={createdBy}
                onChange={(event) => setCreatedBy(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bus-valid-through">{t(`${prefix}validThrough`)}</Label>
              <Input
                id="bus-valid-through"
                type="date"
                required
                disabled={busy}
                value={validThrough}
                aria-describedby="bus-expiry-help"
                onChange={(event) => setValidThrough(event.target.value)}
              />
              <p id="bus-expiry-help" className="text-sm text-muted-foreground">
                {t(`${prefix}utcExplanation`)} {expiresAt ?? t(`${prefix}invalid`)}
              </p>
            </div>
            {error ? (
              <p role="alert" className="text-destructive">
                {t(`${prefix}${error}`)}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setFormOpen(false)}
              >
                {t(`${prefix}cancel`)}
              </Button>
              <Button type="submit" disabled={busy}>
                {t(`${prefix}create`)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={secret !== null}
        onOpenChange={(open) => {
          if (!open) {
            handleSecretClose();
          }
        }}
      >
        <DialogContent
          role={confirmClose ? 'alertdialog' : 'dialog'}
          onCloseAutoFocus={(event) => restoreActionFocus(event, createButtonRef.current)}
        >
          <DialogTitle>{t(`${prefix}${confirmClose ? 'closeTitle' : 'oneTimeTitle'}`)}</DialogTitle>
          <DialogDescription>
            {t(`${prefix}${confirmClose ? 'closeDescription' : 'oneTimeDescription'}`)}
          </DialogDescription>
          {confirmClose ? (
            <DialogFooter className="mt-4">
              <Button
                autoFocus
                onClick={() => {
                  setSecret(null);
                  setCopied(false);
                  setConfirmClose(false);
                }}
              >
                {t(`${prefix}closeCopied`)}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmClose(false)}
              >
                {t(`${prefix}returnToCopy`)}
              </Button>
            </DialogFooter>
          ) : (
            <>
              <code className="my-4 block break-all rounded border border-border p-3">
                {secret?.apiKey}
              </code>
              <DialogFooter className="items-center">
                <p
                  role={copyError ? 'alert' : 'status'}
                  className={`min-w-0 flex-1 text-sm${copyError ? ' text-destructive' : ''}`}
                >
                  {copyError ? t(`${prefix}copyError`) : copied ? t(`${prefix}copied`) : (
                    <span className="invisible" aria-hidden="true">{t(`${prefix}copied`)}</span>
                  )}
                </p>
                <Button onClick={() => void copy()}>{t(`${prefix}copy`)}</Button>
                <Button variant="secondary" onClick={handleSecretClose}>
                  {t(`${prefix}close`)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setRevoking(null);
        }}
      >
        <DialogContent onCloseAutoFocus={(event) => restoreActionFocus(event, revokeButtonRef.current)}>
          <DialogTitle>{t(`${prefix}revoke`)}</DialogTitle>
          <DialogDescription>{t(`${prefix}revokeConfirmation`)}</DialogDescription>
          <p className="my-4">
            <strong>{t(`${prefix}keyId`)}:</strong>{' '}
            <span className="font-mono">{revoking}</span>
          </p>
          <DialogFooter>
            <Button variant="secondary" disabled={busy} onClick={() => setRevoking(null)}>
              {t(`${prefix}cancel`)}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (revoking) void mutate('revoke', revoking);
              }}
            >
              {t(`${prefix}confirmRevoke`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
