import { Button } from '@sva/studio-ui-react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../components/ui/dialog';
import { t } from '../../../i18n';
import type { BusKeysModel } from './-bus-api-keys-state';
const prefix = 'admin.instances.busKeys.';

export const BusKeyCreateDialog = ({ model }: { model: BusKeysModel }) => {
  const {
    formOpen,
    busy,
    setFormOpen,
    displayedSecretRef,
    restoreActionFocus,
    createButtonRef,
    displayName,
    instanceId,
    contact,
    setContact,
    createdBy,
    setCreatedBy,
    validThrough,
    setValidThrough,
    expiresAt,
    error,
    mutate,
  } = model;
  return (
    <Dialog
      open={formOpen}
      onOpenChange={(open) => {
        if (!busy) setFormOpen(open);
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          // The successful form hands focus to the one-time key dialog.
          if (displayedSecretRef.current) event.preventDefault();
          else restoreActionFocus(event, createButtonRef.current);
        }}
      >
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
  );
};

export const BusKeySecretDialog = ({ model }: { model: BusKeysModel }) => {
  const {
    secret,
    handleSecretClose,
    confirmClose,
    restoreActionFocus,
    createButtonRef,
    setSecret,
    setCopied,
    setConfirmClose,
    copyError,
    copied,
    copy,
  } = model;
  return (
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
            <Button variant="secondary" onClick={() => setConfirmClose(false)}>
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
                {copyError ? (
                  t(`${prefix}copyError`)
                ) : copied ? (
                  t(`${prefix}copied`)
                ) : (
                  <span className="invisible" aria-hidden="true">
                    {t(`${prefix}copied`)}
                  </span>
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
  );
};

export const BusKeyRevokeDialog = ({ model }: { model: BusKeysModel }) => {
  const { revoking, busy, setRevoking, restoreActionFocus, revokeButtonRef, mutate } = model;
  return (
    <Dialog
      open={revoking !== null}
      onOpenChange={(open) => {
        if (!open && !busy) setRevoking(null);
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => restoreActionFocus(event, revokeButtonRef.current)}
      >
        <DialogTitle>{t(`${prefix}revoke`)}</DialogTitle>
        <DialogDescription>{t(`${prefix}revokeConfirmation`)}</DialogDescription>
        <p className="my-4">
          <strong>{t(`${prefix}keyId`)}:</strong> <span className="font-mono">{revoking}</span>
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
  );
};
