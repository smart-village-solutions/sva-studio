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
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  confirmDisabled?: boolean;
  errorMessage?: React.ReactNode;
  children?: React.ReactNode;
  fallbackFocusRef?: React.RefObject<HTMLElement | null>;
}>;

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
}: StudioDestructiveActionDialogProps) {
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
            disabled={pending || confirmDisabled}
            onClick={(event) => {
              event.preventDefault();
              if (!pending) onConfirm();
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
