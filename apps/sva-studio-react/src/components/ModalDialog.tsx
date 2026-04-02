import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as React from 'react';

import { cn } from '@/lib/utils';

type ModalDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly role?: 'dialog' | 'alertdialog';
  readonly onClose: () => void;
  readonly children: React.ReactNode;
};

export const ModalDialog = ({
  open,
  title,
  description,
  role = 'dialog',
  onClose,
  children,
}: ModalDialogProps) => {
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const previousOpenRef = React.useRef(false);
  const overlayCloseRef = React.useRef(false);

  React.useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;

    if (open && !wasOpen) {
      triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return;
    }

    if (!open && wasOpen && triggerRef.current?.isConnected) {
      triggerRef.current.focus();
    }
  }, [open]);

  const handleCloseAutoFocus = React.useCallback((event: Event) => {
    if (!triggerRef.current?.isConnected) {
      return;
    }
    event.preventDefault();
    triggerRef.current.focus();
  }, []);

  const requestClose = React.useCallback(() => {
    overlayCloseRef.current = true;
    onClose();
  }, [onClose]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        overlayCloseRef.current = false;
        return;
      }
      if (overlayCloseRef.current) {
        overlayCloseRef.current = false;
        return;
      }
      onClose();
    },
    [onClose]
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]"
          onClick={requestClose}
        />
        <DialogPrimitive.Content
          role={role}
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl focus-visible:outline-none'
          )}
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          <header className="mb-4">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description> : null}
          </header>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
