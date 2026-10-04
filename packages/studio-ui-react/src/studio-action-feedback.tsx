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
import { Button } from './button.js';
import { cn } from './utils.js';

export type StudioDestructiveActionDialogProps = Readonly<{
  open: boolean;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: React.ReactNode;
  pendingLabel: React.ReactNode;
  cancelLabel: React.ReactNode;
  onConfirm: (detachLinkedContent?: boolean) => void;
  onCancel: () => void;
  pending?: boolean;
  confirmDisabled?: boolean;
  errorMessage?: React.ReactNode;
  children?: React.ReactNode;
  fallbackFocusRef?: React.RefObject<HTMLElement | null>;
  linkedContent?: Readonly<{
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

export function StudioDestructiveActionDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  pending = false,
  confirmDisabled = false,
  errorMessage,
  children,
  fallbackFocusRef,
  linkedContent,
}: StudioDestructiveActionDialogProps) {
  const [deletionImpact, setDeletionImpact] = React.useState<DeletionImpact | null>(null);
  const [previewedKey, setPreviewedKey] = React.useState<string | null>(null);
  const [impactError, setImpactError] = React.useState(false);
  const [impactLoading, setImpactLoading] = React.useState(false);
  const basePath = linkedContent?.basePath;
  const contentId = linkedContent?.contentId;
  const actingPrincipalType = linkedContent?.actingPrincipalType;
  const loadLinkedContent = linkedContent?.load;
  const previewKey =
    basePath && contentId && actingPrincipalType
      ? JSON.stringify([basePath, contentId, actingPrincipalType])
      : null;
  React.useEffect(() => {
    if (
      !open ||
      !basePath ||
      !contentId ||
      !actingPrincipalType ||
      !loadLinkedContent ||
      !previewKey
    ) {
      setPreviewedKey(null);
      return;
    }
    let active = true;
    setDeletionImpact(null);
    setPreviewedKey(null);
    setImpactError(false);
    setImpactLoading(true);
    void loadLinkedContent({ basePath, contentId, actingPrincipalType })
      .then((impact) => {
        if (!active) return;
        if (validDeletionImpact(impact)) {
          setDeletionImpact(impact);
          setPreviewedKey(previewKey);
        } else {
          setImpactError(true);
        }
      })
      .catch(() => {
        if (active) setImpactError(true);
      })
      .finally(() => {
        if (active) setImpactLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, basePath, contentId, actingPrincipalType, loadLinkedContent, previewKey]);
  const impactReady = previewedKey === previewKey && deletionImpact !== null;
  const hasLinkedContent = Boolean(
    impactReady &&
    deletionImpact &&
    deletionImpact.eventRecordsCount +
      deletionImpact.newsItemsCount +
      deletionImpact.genericItemsCount >
      0
  );
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);
  const wasOpenRef = React.useRef(false);
  if (open && !wasOpenRef.current && typeof document !== 'undefined') {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpenRef.current = open;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !pending) {
      onCancel();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        aria-busy={pending}
        onCloseAutoFocus={(event) => {
          const restoreTarget = restoreFocusRef.current;
          const focusTarget = restoreTarget?.isConnected
            ? restoreTarget
            : fallbackFocusRef?.current?.isConnected
              ? fallbackFocusRef.current
              : null;
          restoreFocusRef.current = null;
          if (!focusTarget) return;
          event.preventDefault();
          focusTarget.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children ? <div className="mt-4">{children}</div> : null}
        {linkedContent && impactLoading ? (
          <p role="status">{linkedContent.translate('actions.linkedContentLoading')}</p>
        ) : null}
        {linkedContent && impactError ? (
          <p role="alert">{linkedContent.translate('actions.linkedContentError')}</p>
        ) : null}
        {hasLinkedContent && deletionImpact ? (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p>{linkedContent?.translate('actions.linkedContentIntro')}</p>
            <ul className="list-disc pl-5">
              {deletionImpact.eventRecordsCount > 0 ? (
                <li>
                  {linkedContent?.translate(
                    deletionImpact.eventRecordsCount === 1
                      ? 'actions.linkedEvent'
                      : 'actions.linkedEvents',
                    { count: deletionImpact.eventRecordsCount }
                  )}
                </li>
              ) : null}
              {deletionImpact.newsItemsCount > 0 ? (
                <li>
                  {linkedContent?.translate(
                    deletionImpact.newsItemsCount === 1
                      ? 'actions.linkedNewsItem'
                      : 'actions.linkedNewsItems',
                    { count: deletionImpact.newsItemsCount }
                  )}
                </li>
              ) : null}
              {deletionImpact.genericItemsCount > 0 ? (
                <li>
                  {linkedContent?.translate(
                    deletionImpact.genericItemsCount === 1
                      ? 'actions.linkedGenericItem'
                      : 'actions.linkedGenericItems',
                    { count: deletionImpact.genericItemsCount }
                  )}
                </li>
              ) : null}
            </ul>
            <p className="mt-2">{linkedContent?.translate('actions.linkedContentOutro')}</p>
          </div>
        ) : null}
        {errorMessage ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {errorMessage}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={
              pending ||
              confirmDisabled ||
              (Boolean(linkedContent) && (impactLoading || impactError || !impactReady))
            }
            onClick={(event) => {
              event.preventDefault();
              if (!pending) onConfirm(hasLinkedContent);
            }}
          >
            {pending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type StudioPersistentActionResultProps = Readonly<{
  kind: 'success' | 'error';
  title: React.ReactNode;
  description?: React.ReactNode;
  dismissLabel?: React.ReactNode;
  onDismiss?: () => void;
  actions?: React.ReactNode;
  className?: string;
}>;

export function StudioPersistentActionResult({
  kind,
  title,
  description,
  dismissLabel,
  onDismiss,
  actions,
  className,
}: StudioPersistentActionResultProps) {
  const isError = kind === 'error';

  return (
    <section
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'rounded-xl border p-4 text-sm',
        isError
          ? 'border-destructive/40 bg-destructive/5 text-destructive'
          : 'border-primary/30 bg-primary/5 text-foreground',
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-semibold">{title}</h2>
          {description ? (
            <p className={isError ? undefined : 'text-muted-foreground'}>{description}</p>
          ) : null}
        </div>
        {actions || (dismissLabel && onDismiss) ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {actions}
            {dismissLabel && onDismiss ? (
              <Button type="button" size="sm" variant="secondary" onClick={onDismiss}>
                {dismissLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
