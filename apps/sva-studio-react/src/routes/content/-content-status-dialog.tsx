import type { IamContentListItem, IamContentStatus } from '@sva/core';
import type { MainserverPrincipalType } from '@sva/studio-ui-react';
import React from 'react';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
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

const statusVariantByValue = {
  draft: 'outline',
  in_review: 'secondary',
  approved: 'default',
  published: 'default',
  archived: 'destructive',
} as const;

const statusClassNameByValue = {
  draft: 'border-slate-400 bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  in_review: 'border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  approved: 'border-sky-400 bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  published:
    'border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  archived: 'border-rose-400 bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
} as const;

const statusLabelKeyByValue = {
  draft: 'content.status.draft',
  in_review: 'content.status.inReview',
  approved: 'content.status.approved',
  published: 'content.status.published',
  archived: 'content.status.archived',
} as const;

export const ContentStatusBadge = ({ status }: { readonly status: IamContentStatus }) => (
  <Badge variant={statusVariantByValue[status]} className={statusClassNameByValue[status]}>
    {t(statusLabelKeyByValue[status])}
  </Badge>
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
          <ContentStatusBadge status={item.status} />
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
              variant="outline"
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
            variant="outline"
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
