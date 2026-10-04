import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog.js';

export type StudioConfirmDialogProps = Readonly<{
  open: boolean;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: React.ReactNode;
  cancelLabel: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
}>;

export function StudioConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  children,
  confirmDisabled = false,
  cancelDisabled = false,
}: StudioConfirmDialogProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !cancelDisabled) {
      onCancel();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children ? <div className="mt-4">{children}</div> : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={cancelDisabled}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type LinkedContentDeletionPreview = Readonly<{
  basePath: string;
  contentId: string;
  actingPrincipalType: 'organization' | 'user';
  load: (input: {
    basePath: string;
    contentId: string;
    actingPrincipalType: 'organization' | 'user';
  }) => Promise<unknown>;
  translate: (key: string, values?: Readonly<Record<string, string | number>>) => string;
}>;

type DeletionImpact = Readonly<{
  eventRecordsCount: number;
  newsItemsCount: number;
  genericItemsCount: number;
}>;

const validDeletionImpact = (value: unknown): value is DeletionImpact => {
  if (typeof value !== 'object' || value === null) return false;
  const counts = value as Record<string, unknown>;
  return ['eventRecordsCount', 'newsItemsCount', 'genericItemsCount'].every(
    (key) => Number.isSafeInteger(counts[key]) && (counts[key] as number) >= 0
  );
};

const deletionPreviewKey = (linkedContent?: LinkedContentDeletionPreview): string | null =>
  linkedContent?.basePath && linkedContent.contentId && linkedContent.actingPrincipalType
    ? JSON.stringify([
        linkedContent.basePath,
        linkedContent.contentId,
        linkedContent.actingPrincipalType,
      ])
    : null;

export const useLinkedContentDeletionPreview = (
  open: boolean,
  linkedContent?: LinkedContentDeletionPreview
) => {
  const [impact, setImpact] = React.useState<DeletionImpact | null>(null);
  const [previewedKey, setPreviewedKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const basePath = linkedContent?.basePath;
  const contentId = linkedContent?.contentId;
  const actingPrincipalType = linkedContent?.actingPrincipalType;
  const load = linkedContent?.load;
  const key = deletionPreviewKey(linkedContent);

  React.useEffect(() => {
    if (!open || !key || !basePath || !contentId || !actingPrincipalType || !load) {
      setPreviewedKey(null);
      return;
    }
    let active = true;
    setImpact(null);
    setPreviewedKey(null);
    setError(false);
    setLoading(true);
    void load({ basePath, contentId, actingPrincipalType })
      .then((value) => {
        if (!active) return;
        if (validDeletionImpact(value)) {
          setImpact(value);
          setPreviewedKey(key);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, key, basePath, contentId, actingPrincipalType, load]);

  const ready = previewedKey === key && impact !== null;
  const hasLinks = Boolean(
    ready &&
    impact &&
    impact.eventRecordsCount + impact.newsItemsCount + impact.genericItemsCount > 0
  );
  return { impact, loading, error, ready, hasLinks };
};

export const renderLinkedContentDeletionWarning = (
  linkedContent: LinkedContentDeletionPreview | undefined,
  preview: ReturnType<typeof useLinkedContentDeletionPreview>
): React.ReactNode => {
  if (!linkedContent) return null;
  const t = linkedContent.translate;
  if (preview.loading) return <p role="status">{t('actions.linkedContentLoading')}</p>;
  if (preview.error) return <p role="alert">{t('actions.linkedContentError')}</p>;
  if (!preview.hasLinks || !preview.impact) return null;
  const counts = preview.impact;
  return (
    <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p>{t('actions.linkedContentIntro')}</p>
      <ul className="list-disc pl-5">
        {counts.eventRecordsCount > 0 ? (
          <li>
            {t(counts.eventRecordsCount === 1 ? 'actions.linkedEvent' : 'actions.linkedEvents', {
              count: counts.eventRecordsCount,
            })}
          </li>
        ) : null}
        {counts.newsItemsCount > 0 ? (
          <li>
            {t(counts.newsItemsCount === 1 ? 'actions.linkedNewsItem' : 'actions.linkedNewsItems', {
              count: counts.newsItemsCount,
            })}
          </li>
        ) : null}
        {counts.genericItemsCount > 0 ? (
          <li>
            {t(
              counts.genericItemsCount === 1
                ? 'actions.linkedGenericItem'
                : 'actions.linkedGenericItems',
              { count: counts.genericItemsCount }
            )}
          </li>
        ) : null}
      </ul>
      <p className="mt-2">{t('actions.linkedContentOutro')}</p>
    </div>
  );
};
