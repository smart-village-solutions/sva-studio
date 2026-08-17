import type { IamContentListItem, IamContentStatus } from '@sva/core';
import {
  Button,
  type MainserverPrincipalType,
  StudioStatusBadge,
  type StudioStatusTone,
} from '@sva/studio-ui-react';
import React from 'react';

import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { t } from '../../i18n';
import {
  getSupportedQuickStatuses,
  updateMainserverContentStatus,
} from '../../lib/content-status-mutation';

const statusToneByValue: Readonly<Record<IamContentStatus, StudioStatusTone>> = {
  draft: 'neutral',
  in_review: 'warning',
  approved: 'info',
  published: 'success',
  archived: 'danger',
};

const statusLabelKeyByValue = {
  draft: 'content.status.draft',
  in_review: 'content.status.inReview',
  approved: 'content.status.approved',
  published: 'content.status.published',
  archived: 'content.status.archived',
} as const;

export const ContentStatusBadge = ({
  status,
  editable = false,
}: {
  readonly status: IamContentStatus;
  readonly editable?: boolean;
}) => (
  <StudioStatusBadge tone={statusToneByValue[status]} editable={editable}>
    {t(statusLabelKeyByValue[status])}
  </StudioStatusBadge>
);

type ContentStatusDialogProps = Readonly<{
  item: IamContentListItem;
  canUpdate: boolean;
  actingPrincipalType: MainserverPrincipalType;
  onUpdated: () => Promise<void>;
}>;

export const ContentStatusDialog = ({
  item,
  canUpdate,
  actingPrincipalType,
  onUpdated,
}: ContentStatusDialogProps) => {
  const [open, setOpen] = React.useState(false);
  const [pendingStatus, setPendingStatus] = React.useState<IamContentStatus | null>(null);
  const [error, setError] = React.useState(false);
  const supportedStatuses = getSupportedQuickStatuses(item.contentType);
  const interactive = canUpdate && supportedStatuses.length > 0;

  if (!interactive) {
    return <ContentStatusBadge status={item.status} />;
  }

  const updateStatus = async (status: IamContentStatus) => {
    if (status === item.status) {
      setOpen(false);
      return;
    }

    setPendingStatus(status);
    setError(false);
    try {
      await updateMainserverContentStatus(item, status, actingPrincipalType);
      await onUpdated();
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setPendingStatus(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={t('content.statusDialog.open', { title: item.title })}
        >
          <ContentStatusBadge status={item.status} editable />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('content.statusDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('content.statusDialog.description', { title: item.title })}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert className="mt-4 border-destructive/40 bg-destructive/5 text-destructive">
            <AlertDescription>{t('content.statusDialog.error')}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-5 grid gap-2">
          {supportedStatuses.map((status) => (
            <Button
              key={status}
              type="button"
              variant="secondary"
              className="h-auto justify-start py-3"
              disabled={pendingStatus !== null}
              aria-pressed={status === item.status}
              onClick={() => void updateStatus(status)}
            >
              <ContentStatusBadge status={status} />
              {status === item.status ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t('content.statusDialog.current')}
                </span>
              ) : null}
            </Button>
          ))}
        </div>

        <DialogFooter className="mt-5">
          <Button
            type="button"
            variant="secondary"
            disabled={pendingStatus !== null}
            onClick={() => setOpen(false)}
          >
            {t('content.actions.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
